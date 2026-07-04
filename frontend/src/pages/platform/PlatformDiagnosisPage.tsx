import { DatabaseOutlined, DownloadOutlined, ExperimentOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Alert, Button, Col, Collapse, Empty, Row, Space, Spin, Tag, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { platformPathologyGrade, platformSavePathologyAnalysis, platformDownloadAnnotationDataset } from "../../api/platform";
import type { PathologyImagingGradeResult } from "../../api/platform";
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

const { Title, Paragraph, Text } = Typography;

function gradeColor(label: string): "red" | "green" | "blue" | "muted" {
  if (!label || label === "—" || label === "待判定") return "muted";
  if (label.includes("高")) return "red";
  if (label.includes("低")) return "green";
  return "blue";
}

function formatSingleCaseGrade(label: string): string {
  const t = label.trim();
  if (!t || t === "—" || t === "待判定") return "接口未返回本例分级";
  return t;
}

function splitMessageParts(message: string): string[] {
  return message
    .split(/[·•]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function PathologyResultPanel({ result }: { result: PathologyImagingGradeResult }) {
  const { message: msgApi } = App.useApp();
  const [downloading, setDownloading] = useState(false);
  const isError = result.status === "error";
  const isSkipped = result.status === "skipped";
  const messageParts = splitMessageParts(result.message || "");
  const selectedSlice =
    result.raw && "selected_slice_filename" in result.raw
      ? String((result.raw as Record<string, unknown>).selected_slice_filename)
      : "";

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
              单病例模式：展示本例病灶勾画；病理分级需接口返回或人工确认，非队列高/低对比。
            </Paragraph>
            {isError ? (
              <Alert type="error" message={result.message || "影像诊断分析接口调用失败"} showIcon />
            ) : isSkipped ? (
              <Alert type="warning" message={result.message} showIcon />
            ) : (
              <>
                <div className="pmp-diagnosis-grade-row">
                  <span className={`pmp-diagnosis-grade pmp-diagnosis-grade--${gradeColor(result.grade_label || "")}`}>
                    {formatSingleCaseGrade(result.grade_label || "")}
                  </span>
                  {result.confidence != null ? (
                    <span className="pmp-diagnosis-confidence">置信度 {(result.confidence * 100).toFixed(0)}%</span>
                  ) : null}
                </div>
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
        setResult(hydrated);
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
      setResult(res);
      const names = getPendingCaseFileNames();
      setFileNames(names);
      setPathologyImagingResult(res, names);
      setSavedToDb(Boolean(res.saved));
      if (res.status === "error") {
        message.error(res.message || "影像诊断分析接口调用失败");
      } else if (res.status === "skipped") {
        message.warning(res.message);
      } else {
        message.success("影像诊断分析完成，请确认加入病理库与影像库");
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

      {!loading && !hydrating && result ? <PathologyResultPanel result={result} /> : null}
    </div>
  );
}
