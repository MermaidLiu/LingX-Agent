import { DatabaseOutlined, DownloadOutlined, ExperimentOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Alert, Button, Col, Collapse, Empty, Row, Space, Spin, Table, Tag, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { platformPathologyGrade, platformRetryPci, platformSavePathologyAnalysis, platformDownloadAnnotationDataset } from "../../api/platform";
import type { PathologyImagingGradeResult, PciScoreResult } from "../../api/platform";
import {
  getPendingCaseFiles,
  getPendingCaseFileNames,
  hasPendingCaseFiles,
  pendingCaseFilesChanged,
} from "../../lib/platformCaseUpload";
import {
  getPathologyImagingOrNull,
  hasSuccessfulPathologyResult,
  hydratePathologyImagingResult,
  loadPlatformSession,
  setPathologyImagingResult,
  markSaved,
} from "../../lib/platformSession";
import { hasAnnotatedImage, imageSrcFromBase64 } from "../../lib/pathologyImage";
import { buildPciConclusion, normalizePciRegions, pciRegionScoreTone, sumPciRegions } from "../../lib/pciRegions";

const { Title, Paragraph, Text } = Typography;

function gradeColor(label: string): "red" | "green" | "blue" | "muted" {
  if (!label || label === "—" || label === "待判定") return "muted";
  if (label.includes("高")) return "red";
  if (label.includes("低")) return "green";
  return "blue";
}

function getPci(result: PathologyImagingGradeResult): PciScoreResult | undefined {
  return result.pci ?? (result.raw?.pci as PciScoreResult | undefined);
}

function formatPrimaryResult(result: PathologyImagingGradeResult): string {
  const pci = getPci(result);
  const regions = pci ? normalizePciRegions(pci) : [];
  const total = pci?.pci_score ?? (regions.length ? sumPciRegions(regions) : null);
  if (total != null) return `PCI ${total}/36`;
  if (pci?.slice_scores?.length) {
    const maxSc = Math.max(...pci.slice_scores.map((s) => s.sc ?? 0));
    return maxSc > 0 ? `sc 最高 ${maxSc}` : "sc 已加载";
  }
  if (pci?.status === "error") return "PCI 评分失败";
  if (pci?.status === "pending") return "分割完成 · PCI 待路径";
  if (pci?.status === "skipped") return "分割完成 · 待 PCI";
  if (pci?.status === "ok" && pci.pci_score == null) return "PCI 接口已响应";
  const grade = result.grade_label?.trim();
  if (grade && grade !== "—" && grade !== "待判定" && !grade.startsWith("PCI")) return grade;
  if (hasAnnotatedImage(result.result_image_base64)) return "分割完成 · 待 PCI";
  if (result.status === "error") return "分析失败";
  return "待评分";
}

function formatSingleCaseGrade(label: string, result?: PathologyImagingGradeResult): string {
  if (result) {
    const primary = formatPrimaryResult(result);
    if (primary !== "待评分") return primary;
  }
  const t = label.trim();
  if (!t || t === "—" || t === "待判定") return "分割完成 · 待 PCI";
  return t;
}

function primaryGradeColor(result: PathologyImagingGradeResult): "red" | "green" | "blue" | "muted" {
  const pci = getPci(result);
  if (pci?.pci_score != null) {
    if (pci.pci_score >= 20) return "red";
    if (pci.pci_score <= 10) return "green";
    return "blue";
  }
  return gradeColor(formatPrimaryResult(result));
}

function mergePciIntoResult(result: PathologyImagingGradeResult, pci: PciScoreResult): PathologyImagingGradeResult {
  const raw = { ...(result.raw ?? {}), pci, pci_paths_tried: pci.raw?.paths_tried ?? result.raw?.pci_paths_tried };
  const regions = normalizePciRegions(pci);
  const total = pci.pci_score ?? sumPciRegions(regions);
  const gradeLabel = total != null ? `PCI ${total}/36` : result.grade_label;
  return { ...result, pci, grade_label: gradeLabel, raw };
}

async function fetchMissingPci(result: PathologyImagingGradeResult, fileNames: string[]): Promise<PathologyImagingGradeResult> {
  const pci = getPci(result);
  if (pci && pci.status !== "pending") return result;
  if (result.status !== "ok") return result;
  const sessionId = String(result.raw?.sessionId ?? "");
  if (!result.annotation_dataset_id && !result.exam_id && !sessionId) return result;
  try {
    const retried = await platformRetryPci({
      annotationDatasetId: result.annotation_dataset_id,
      examId: result.exam_id,
      sessionId: sessionId || undefined,
      uploadNames: fileNames.length ? fileNames : undefined,
    });
    return mergePciIntoResult(result, retried);
  } catch {
    return result;
  }
}

function splitMessageParts(message: string): string[] {
  return message
    .split(/[·•]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(
      (s) =>
        !s.includes("接口未返回本例分级") &&
        !s.includes("未返回病例级") &&
        !s.includes("未返回本例分级字段"),
    );
}

function PciSliceScoresTable({ slices }: { slices: NonNullable<PciScoreResult["slice_scores"]> }) {
  const positiveCount = slices.filter((s) => (s.sc ?? 0) > 0).length;
  return (
    <div className="pmp-pci-slice-table">
      <div className="pmp-pci-report-title">
        逐层 sc 评分（{slices.length} 层 · {positiveCount} 层 sc&gt;0）
      </div>
      <Table
        size="small"
        pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "30", "50", "100"] }}
        rowKey={(row) => `${row.index}-${row.filename}`}
        dataSource={slices}
        columns={[
          { title: "#", dataIndex: "index", width: 64 },
          { title: "DICOM 文件名", dataIndex: "filename", ellipsis: true },
          {
            title: "区域",
            dataIndex: "region",
            width: 72,
            render: (v: number | null | undefined) => (v != null ? v : "—"),
          },
          {
            title: "sc",
            dataIndex: "sc",
            width: 72,
            sorter: (a, b) => (a.sc ?? -1) - (b.sc ?? -1),
            defaultSortOrder: "descend" as const,
            render: (v: number | null) => (
              <span className={`pmp-pci-region-score pmp-pci-region-score--${pciRegionScoreTone(v)}`}>{v ?? "—"}</span>
            ),
          },
        ]}
      />
    </div>
  );
}

function PciScorePanel({ pci, compact = false }: { pci: PciScoreResult; compact?: boolean }) {
  const fromCtSlices = pci.raw?.source === "ct_slices" || (pci.slice_scores?.length ?? 0) > 0;
  if (pci.status === "skipped") {
    return (
      <Alert type="warning" showIcon message="PCI 评分未执行" description={pci.message} />
    );
  }
  if (pci.status === "pending") {
    return (
      <Alert
        type="warning"
        showIcon
        message="分割已完成，PCI 等待服务端 DICOM 路径"
        description={pci.message}
      />
    );
  }
  if (pci.status === "error" && !fromCtSlices) {
    return (
      <Alert type="error" showIcon message="PCI 评分失败" description={pci.message} />
    );
  }

  const regions = normalizePciRegions(pci);
  const totalScore = pci.pci_score ?? sumPciRegions(regions);
  const partial = totalScore == null && pci.status === "ok" && !pci.slice_scores?.length;
  const conclusion = buildPciConclusion(pci);

  const summary = (
    <>
      {pci.status === "error" && fromCtSlices ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="genpci 路径不可用，已使用 CT 分割返回的 sc 字段"
          description={pci.message}
        />
      ) : null}
      <div className={`pmp-pci-summary${compact ? " pmp-pci-summary--compact" : ""}`}>
        <div className="pmp-pci-total">
          <span className="pmp-pci-total-value">{totalScore ?? "—"}</span>
          <span className="pmp-pci-total-label">PCI 总分 / 36</span>
        </div>
        <Space wrap size={[8, 8]}>
          {pci.is_positive != null ? (
            <Tag color={pci.is_positive ? "red" : "green"}>{pci.is_positive ? "阳性" : "阴性"}</Tag>
          ) : null}
          {pci.positive_rate != null ? (
            <Tag color="blue">
              阳性概率{" "}
              {pci.positive_rate > 1 ? pci.positive_rate.toFixed(1) : `${(pci.positive_rate * 100).toFixed(0)}%`}
            </Tag>
          ) : null}
          {pci.mesenteric_contracture != null ? (
            <Tag color={pci.mesenteric_contracture ? "orange" : "default"}>
              肠系膜挛缩 {pci.mesenteric_contracture ? "(+)" : "(-)"}
            </Tag>
          ) : null}
        </Space>
      </div>

      <div className="pmp-pci-report-section">
        <div className="pmp-pci-report-title">13 区 PCI 评分</div>
        <div className={`pmp-pci-regions${compact ? " pmp-pci-regions--compact" : ""}`}>
          {regions.map((r) => (
            <div key={r.key} className="pmp-pci-region-card">
              <div className="pmp-pci-region-label">{r.label}</div>
              <div className={`pmp-pci-region-score pmp-pci-region-score--${pciRegionScoreTone(r.score)}`}>
                {r.score ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pci.slice_scores?.length ? <PciSliceScoresTable slices={pci.slice_scores} /> : null}

      {conclusion ? (
        <div className="pmp-pci-conclusion">
          <div className="pmp-pci-conclusion-title">结论</div>
          <Paragraph style={{ marginBottom: 0, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {conclusion}
          </Paragraph>
        </div>
      ) : null}

      {pci.dcm_path_used ? (
        <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 8 }}>
          DICOM 路径：{pci.dcm_path_used}
        </Text>
      ) : null}
      {(pci.raw?.paths_tried as string[] | undefined)?.length ? (
        <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
          尝试路径：
          {(pci.raw?.paths_tried as string[])
            .slice(0, 3)
            .map((p) => (p.length > 80 ? `${p.slice(0, 77)}…` : p))
            .join(" → ")}
        </Text>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div className="pmp-pci-inline">
        {partial ? (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={pci.message} />
        ) : null}
        {summary}
      </div>
    );
  }

  return (
    <div className="pmp-card pmp-pci-panel" style={{ marginTop: 0 }}>
      <div className="pmp-panel-title">PCI 评分</div>
      {partial ? (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={pci.message} />
      ) : null}
      {summary}
    </div>
  );
}

function PathologyResultPanel({
  result,
  pciFetching = false,
}: {
  result: PathologyImagingGradeResult;
  pciFetching?: boolean;
}) {
  const { message: msgApi } = App.useApp();
  const [downloading, setDownloading] = useState(false);
  const isError = result.status === "error";
  const isSkipped = result.status === "skipped";
  const messageParts = splitMessageParts(result.message || "");
  const selectedSlice =
    result.raw && "selected_slice_filename" in result.raw
      ? String((result.raw as Record<string, unknown>).selected_slice_filename)
      : "";
  const pci = getPci(result);

  async function handleDownloadZip() {
    if (!result.annotation_dataset_id) return;
    setDownloading(true);
    try {
      msgApi.loading({ content: "正在打包标注数据集，501 层约需 1–2 分钟…", key: "ann-zip", duration: 0 });
      await platformDownloadAnnotationDataset(result.annotation_dataset_id);
      msgApi.success({ content: "标注数据集已开始下载", key: "ann-zip" });
    } catch (e: unknown) {
      let detail = "下载失败，请确认后端服务已启动";
      if (e && typeof e === "object" && "response" in e) {
        const resp = (e as { response?: { data?: Blob; status?: number } }).response;
        if (resp?.data instanceof Blob && resp.data.type?.includes("json")) {
          try {
            detail = JSON.parse(await resp.data.text())?.detail ?? detail;
          } catch {
            /* ignore */
          }
        } else if (resp?.status === 404) {
          detail = "标注数据集不存在，请重新运行智能分析";
        }
      } else if (e instanceof Error) {
        detail = e.message;
      }
      msgApi.error({ content: detail, key: "ann-zip" });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="pmp-diagnosis-results">
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
            <div className="pmp-card pmp-diagnosis-summary">
            <div className="pmp-panel-title">本例影像分析</div>
            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: -4, marginBottom: 12 }}>
              流程：DICOM 上传 → CT 分割勾画 → PCI 评分；病理分级需接口返回或人工确认。
            </Paragraph>
            {isError ? (
              <Alert type="error" message={result.message || "影像诊断分析接口调用失败"} showIcon />
            ) : isSkipped ? (
              <Alert type="warning" message={result.message} showIcon />
            ) : (
              <>
                <div className="pmp-diagnosis-grade-row">
                  <span className={`pmp-diagnosis-grade pmp-diagnosis-grade--${primaryGradeColor(result)}`}>
                    {formatSingleCaseGrade(result.grade_label || "", result)}
                  </span>
                  {result.confidence != null ? (
                    <span className="pmp-diagnosis-confidence">置信度 {(result.confidence * 100).toFixed(0)}%</span>
                  ) : null}
                </div>
                {pciFetching ? (
                  <div style={{ marginBottom: 12 }}>
                    <Spin size="small" />{" "}
                    <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
                      正在获取 PCI 评分…
                    </Text>
                  </div>
                ) : pci ? (
                  <PciScorePanel pci={pci} compact />
                ) : hasAnnotatedImage(result.result_image_base64) ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="分割已完成"
                    description="PCI（genpci）需在 CT 分割落盘并返回 dcm_path 后调用。请让同学在上传/分割接口响应中加入 dcm_path 字段。"
                  />
                ) : null}
                {messageParts.length > 0 ? (
                  <ul className="pmp-diagnosis-bullets">
                    {messageParts.map((part) => (
                      <li key={part}>{part}</li>
                    ))}
                  </ul>
                ) : (
                  <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
                    分析完成
                  </Paragraph>
                )}
              </>
            )}
            <div className="pmp-diagnosis-meta">
              <span className="pmp-diagnosis-meta-item">{result.dicom_count} 张 DICOM</span>
              <span className={`pmp-diagnosis-meta-item pmp-diagnosis-meta-item--${isError ? "err" : "ok"}`}>
                {result.status}
              </span>
              {result.saved ? <span className="pmp-diagnosis-meta-item">已入库</span> : null}
              {result.exam_id ? <span className="pmp-diagnosis-meta-item">{result.exam_id}</span> : null}
            </div>
          </div>
        </Col>

        <Col xs={24} xl={14}>
          <div className="pmp-card pmp-diagnosis-viewer">
            <div className="pmp-diagnosis-viewer-head">
              <div>
                <div className="pmp-panel-title" style={{ marginBottom: 4 }}>
                  标注可视化
                </div>
                {selectedSlice ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    代表切片 {selectedSlice}
                  </Text>
                ) : null}
              </div>
            </div>
            {hasAnnotatedImage(result.result_image_base64) ? (
              <div className="pmp-diagnosis-image-wrap">
                <img src={imageSrcFromBase64(result.result_image_base64)} alt="影像诊断标注图" />
              </div>
            ) : (
              <Empty description="接口未返回标注图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </Col>

        {result.annotation_dataset_id ? (
          <Col xs={24}>
            <div className="pmp-card pmp-annotation-dataset">
              <div className="pmp-annotation-dataset-head">
                <div>
                  <div className="pmp-panel-title">完整标注数据集</div>
                  <Paragraph type="secondary" style={{ fontSize: 13, margin: "6px 0 0" }}>
                    全部切片的勾画图、二值 mask 与 DICOM 空间元数据，可用于组学建模与分割训练。
                  </Paragraph>
                </div>
                <Button
                  type="primary"
                  size="large"
                  icon={<DownloadOutlined />}
                  loading={downloading}
                  onClick={() => void handleDownloadZip()}
                >
                  下载 ZIP
                </Button>
              </div>
              <div className="pmp-annotation-stats">
                <div className="pmp-annotation-stat">
                  <div className="pmp-annotation-stat-value">{result.annotation_slice_count ?? 0}</div>
                  <div className="pmp-annotation-stat-label">annotated PNG</div>
                </div>
                <div className="pmp-annotation-stat">
                  <div className="pmp-annotation-stat-value">{result.annotation_slices_with_mask ?? 0}</div>
                  <div className="pmp-annotation-stat-label">含病灶 mask</div>
                </div>
                <div className="pmp-annotation-stat pmp-annotation-stat--wide">
                  <div className="pmp-annotation-stat-label">数据集 ID</div>
                  <div className="pmp-annotation-stat-id">{result.annotation_dataset_id}</div>
                </div>
              </div>
            </div>
          </Col>
        ) : null}

        {result.raw && Object.keys(result.raw).length > 0 ? (
          <Col xs={24}>
            <div className="pmp-card" style={{ padding: 16 }}>
              <Collapse
                items={[
                  {
                    key: "raw",
                    label: "接口返回字段解析",
                    children: (
                      <pre className="pmp-kb-modal-pre" style={{ maxHeight: 360 }}>
                        {JSON.stringify(result.raw, null, 2)}
                      </pre>
                    ),
                  },
                ]}
              />
            </div>
          </Col>
        ) : null}
      </Row>
    </div>
  );
}

export default function PlatformDiagnosisPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [pciFetching, setPciFetching] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [result, setResult] = useState<PathologyImagingGradeResult | null>(null);
  const [fileNames, setFileNames] = useState<string[]>(loadPlatformSession().uploadedFileNames);
  const [savedToDb, setSavedToDb] = useState(Boolean(loadPlatformSession().savedExamId));
  const [saving, setSaving] = useState(false);
  const runningRef = useRef(false);
  const autoRanRef = useRef(false);

  async function joinDatabase() {
    if (!result || result.status !== "ok") {
      message.warning("请先完成成功的影像诊断分析");
      return;
    }
    setSaving(true);
    try {
      const res = await platformSavePathologyAnalysis(result, fileNames);
      markSaved(res.exam_id);
      setSavedToDb(true);
      const updated = { ...result, exam_id: res.exam_id, saved: true };
      setResult(updated);
      setPathologyImagingResult(updated, fileNames);
      message.success("已写入病理数据库与影像数据库");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "入库失败");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function restorePrevious() {
      const session = loadPlatformSession();
      if (pendingCaseFilesChanged(session.uploadedFileNames)) {
        setHydrating(false);
        return;
      }
      const stored = getPathologyImagingOrNull();
      if (!stored) {
        setHydrating(false);
        return;
      }
      const hydrated = await hydratePathologyImagingResult(stored);
      if (!cancelled && hydrated) {
        if (!getPci(hydrated) && hydrated.status === "ok") {
          setPciFetching(true);
          const withPci = await fetchMissingPci(hydrated);
          if (!cancelled) {
            setResult(withPci);
            if (getPci(withPci)) {
              setPathologyImagingResult(withPci, session.uploadedFileNames);
            }
          }
          if (!cancelled) setPciFetching(false);
        } else {
          setResult(hydrated);
        }
        setFileNames(session.uploadedFileNames);
      }
      if (!cancelled) setHydrating(false);
    }
    void restorePrevious();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runPathologyAnalysis(force = false) {
    const files = getPendingCaseFiles();
    if (!files.length) {
      if (force) {
        message.warning("请先在「工作台」上传含 DICOM 的病例文件（.dcm / .dicom / ZIP）");
      }
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setLoading(true);
    try {
      const res = await platformPathologyGrade(files);
      let finalRes = res;
      const names = getPendingCaseFileNames();
      if (res.status === "ok" && (!getPci(res) || getPci(res)?.status === "pending")) {
        setPciFetching(true);
        try {
          finalRes = await fetchMissingPci(res, names);
        } finally {
          setPciFetching(false);
        }
      }
      setResult(finalRes);
      setFileNames(names);
      setPathologyImagingResult(finalRes, names);
      setSavedToDb(Boolean(finalRes.saved));
      if (finalRes.status === "error") {
        message.error(finalRes.message || "影像诊断分析接口调用失败");
      } else if (finalRes.status === "skipped") {
        message.warning(finalRes.message);
      } else {
        const pci = getPci(finalRes);
        const pciTotal =
          pci?.pci_score ??
          (pci ? sumPciRegions(normalizePciRegions(pci)) : null);
        if (pciTotal != null) {
          message.success(`分割完成 · PCI ${pciTotal}/36`);
        } else if (pci?.status === "pending") {
          message.warning("分割完成；PCI 需 CT 返回 dcm_path 后再调 genpci");
        } else if (pci?.status === "error") {
          message.warning(`分割完成，但 PCI 失败：${pci.message}`);
        } else if (pci?.status === "skipped") {
          message.warning(`分割完成，但 PCI 未执行：${pci.message}`);
        } else {
          message.warning("分割完成，但 PCI 接口未返回 pciScore 总分");
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "分析失败，请检查后端服务是否启动";
      message.error(errMsg);
      setResult({
        status: "error",
        message: errMsg,
        grade_label: "",
        confidence: null,
        result_image_base64: "",
        dicom_count: 0,
      });
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoRanRef.current || hydrating || !hasPendingCaseFiles()) return;
    const session = loadPlatformSession();
    const isNewBatch = pendingCaseFilesChanged(session.uploadedFileNames);
    if (hasSuccessfulPathologyResult() && !isNewBatch) return;
    autoRanRef.current = true;
    void runPathologyAnalysis();
    // 仅首次进入且有待分析文件、尚无历史结果时自动分析
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrating]);

  const hasResult = Boolean(result);
  const showEmpty = !loading && !hydrating && !result && !hasPendingCaseFiles() && !hasSuccessfulPathologyResult();

  return (
    <div className="pmp-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            <ExperimentOutlined style={{ marginRight: 8, color: "#1677ff" }} />
            智能分析 · 影像诊断分析
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            上传本例 DICOM，调用 AI 接口完成病灶勾画与本例影像分析（非多例队列对比）。
          </Paragraph>
        </div>
        <Space>
          <Link to="/workflow">
            <Button>返回工作台</Button>
          </Link>
          {result?.saved || savedToDb ? (
            <Link to="/db/imaging">
              <Button>查看影像数据库</Button>
            </Link>
          ) : null}
          {!loading && result?.status === "ok" && !savedToDb ? (
            <Button type="primary" icon={<DatabaseOutlined />} loading={saving} onClick={() => void joinDatabase()}>
              加入病理库 + 影像库
            </Button>
          ) : null}
          {savedToDb ? <Tag color="green">已入库</Tag> : null}
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void runPathologyAnalysis(true)}
          >
            {hasResult ? "重新分析" : "开始分析"}
          </Button>
        </Space>
      </div>

      {fileNames.length > 0 ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`已选择 ${fileNames.length} 个上传文件${result?.dicom_count ? ` · 解析出 ${result.dicom_count} 张 DICOM` : ""}`}
          description={fileNames.length <= 8 ? fileNames.join(" · ") : `${fileNames.slice(0, 8).join(" · ")} … 等 ${fileNames.length} 个`}
        />
      ) : hasResult ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="已加载上次分析结果"
          description={
            result?.saved
              ? `记录 ${result.exam_id || "—"} 已写入影像数据库，可在「影像数据库」查看。`
              : "如需重新分析，请返回工作台上传新的 DICOM 文件。"
          }
        />
      ) : null}

      {hydrating || loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" tip={loading ? "正在调用影像诊断分析接口，请稍候…" : "正在加载上次分析结果…"} />
          {loading ? (
            <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
              分析通常需要约 5 分钟；完成后将展示结果，并自动保存全部切片标注数据与 mask（501 层约需额外 1–2 分钟）
            </Paragraph>
          ) : null}
        </div>
      ) : null}

      {showEmpty ? (
        <Empty description="请先在「工作台」上传患者病例（DICOM 或 ZIP），再进入本页分析">
          <Link to="/workflow">
            <Button type="primary" icon={<UploadOutlined />}>
              前往工作台上传
            </Button>
          </Link>
        </Empty>
      ) : null}

      {!loading && !hydrating && result ? (
        <PathologyResultPanel result={result} pciFetching={pciFetching} />
      ) : null}
    </div>
  );
}
