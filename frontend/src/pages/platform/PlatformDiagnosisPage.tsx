import { ExperimentOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Alert, Button, Col, Collapse, Empty, Row, Space, Spin, Tag, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { platformPathologyGrade } from "../../api/platform";
import type { PathologyImagingGradeResult } from "../../api/platform";
import {
  getPendingCaseFiles,
  getPendingCaseFileNames,
  hasPendingCaseFiles,
} from "../../lib/platformCaseUpload";
import {
  getPathologyImagingOrNull,
  loadPlatformSession,
  setPathologyImagingResult,
} from "../../lib/platformSession";

const { Title, Paragraph, Text } = Typography;

function gradeColor(label: string) {
  if (label.includes("高")) return "red";
  if (label.includes("低")) return "green";
  return "blue";
}

function PathologyResultPanel({ result }: { result: PathologyImagingGradeResult }) {
  const isError = result.status === "error";
  const isSkipped = result.status === "skipped";

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={10}>
        <div className="pmp-card" style={{ padding: 20 }}>
          <div className="pmp-panel-title">影像诊断分析结果</div>
          {isError ? (
            <Alert type="error" message={result.message || "影像诊断分析接口调用失败"} showIcon style={{ marginBottom: 12 }} />
          ) : isSkipped ? (
            <Alert type="warning" message={result.message} showIcon style={{ marginBottom: 12 }} />
          ) : (
            <>
              <Tag color={gradeColor(result.grade_label || "—")} style={{ fontSize: 16, padding: "6px 14px", marginBottom: 12 }}>
                {result.grade_label || "待判定"}
              </Tag>
              {result.confidence != null ? (
                <Paragraph style={{ marginBottom: 8 }}>
                  置信度 <Text strong>{(result.confidence * 100).toFixed(0)}%</Text>
                </Paragraph>
              ) : null}
              <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
                {result.message || "分析完成"}
              </Paragraph>
            </>
          )}
          <Space wrap style={{ marginTop: 12 }}>
            <Tag>{result.dicom_count} 张 DICOM</Tag>
            <Tag color={isError ? "red" : isSkipped ? "orange" : "green"}>{result.status || "unknown"}</Tag>
          </Space>
        </div>
      </Col>

      <Col xs={24} lg={14}>
        <div className="pmp-card" style={{ padding: 16, minHeight: 280 }}>
          <div className="pmp-panel-title">可视化结果</div>
          {result.result_image_base64 ? (
            <img
              src={`data:image/png;base64,${result.result_image_base64}`}
              alt="影像诊断分析可视化"
              style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #e8edf5" }}
            />
          ) : (
            <Empty description="接口未返回可视化图像" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      </Col>

      {result.raw && Object.keys(result.raw).length > 0 ? (
        <Col xs={24}>
          <div className="pmp-card" style={{ padding: 16 }}>
            <Collapse
              items={[
                {
                  key: "raw",
                  label: "影像诊断分析接口原始返回（JSON）",
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
  );
}

export default function PlatformDiagnosisPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PathologyImagingGradeResult | null>(getPathologyImagingOrNull());
  const [fileNames, setFileNames] = useState<string[]>(loadPlatformSession().uploadedFileNames);
  const runningRef = useRef(false);
  const autoRanRef = useRef(false);

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
      if (res.status === "error") {
        message.error(res.message || "影像诊断分析接口调用失败");
      } else if (res.status === "skipped") {
        message.warning(res.message);
      } else {
        message.success("影像诊断分析完成");
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
    if (autoRanRef.current || !hasPendingCaseFiles()) return;
    autoRanRef.current = true;
    void runPathologyAnalysis();
    // 仅进入页面时自动分析一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasResult = Boolean(result);
  const showEmpty = !loading && !result && !hasPendingCaseFiles();

  return (
    <div className="pmp-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            <ExperimentOutlined style={{ marginRight: 8, color: "#1677ff" }} />
            智能分析 · 影像诊断分析
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            调用影像诊断分析接口处理 DICOM 影像，展示分析结果与可视化图像。
          </Paragraph>
        </div>
        <Space>
          <Link to="/workflow">
            <Button>返回工作台</Button>
          </Link>
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
          message={`已加载 ${fileNames.length} 个文件`}
          description={fileNames.join(" · ")}
        />
      ) : null}

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" tip="正在调用影像诊断分析接口，请稍候…" />
          <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
            分析通常需要约 5 分钟，请勿关闭页面；完成后将展示结果与可视化图像
          </Paragraph>
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

      {!loading && result ? <PathologyResultPanel result={result} /> : null}
    </div>
  );
}
