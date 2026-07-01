import { ExperimentOutlined, LeftOutlined, RightOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Col, Input, Row, Space, Tag, Typography, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MOCK_PATIENTS, WORKFLOW_STEPS } from "../../data/platformMock";
import { getPendingCaseFileNames, setPendingCaseFiles, toNativeFiles } from "../../lib/platformCaseUpload";

const { Title, Paragraph, Text } = Typography;

const ACCEPT = ".dcm,.dicom,.zip,.xlsx,.xls,.csv,.pdf,.doc,.docx,.json";

export default function PlatformWorkflowPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const patient = MOCK_PATIENTS[0];

  const activeStep = WORKFLOW_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === WORKFLOW_STEPS.length - 1;

  const goToStep = useCallback((index: number) => {
    const next = Math.max(0, Math.min(WORKFLOW_STEPS.length - 1, index));
    setStepIndex(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  function syncPendingFiles() {
    const files = toNativeFiles(uploadFiles);
    setPendingCaseFiles(files);
    return files;
  }

  useEffect(() => {
    setPendingCaseFiles(uploadFiles);
  }, [uploadFiles]);

  function goToAnalysis() {
    const files = syncPendingFiles();
    if (!files.length) {
      message.warning("请先上传病例文件（至少包含 DICOM 或 ZIP）");
      return;
    }
    message.success(`已加载 ${files.length} 个文件，正在前往智能分析…`);
    nav("/analysis");
  }

  return (
    <div className="pmp-workflow-page">
      <div className="pmp-step-bar pmp-step-bar--sticky">
        {WORKFLOW_STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`pmp-step-item${stepIndex === i ? " pmp-step-item--active" : ""}${i < stepIndex ? " pmp-step-item--done" : ""}`}
            onClick={() => goToStep(i)}
            onKeyDown={(e) => e.key === "Enter" && goToStep(i)}
            role="button"
            tabIndex={0}
          >
            {s.label}
          </div>
        ))}
      </div>

      <div className="pmp-workflow-body">
        {activeStep.key === "input" ? (
          <section className="pmp-section">
            <Title level={4}>
              <span className="pmp-section-num">1</span>
              工作台 · 上传病例
            </Title>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={14}>
                <div className="pmp-card" style={{ padding: 20 }}>
                  <Upload.Dragger
                    multiple
                    accept={ACCEPT}
                    fileList={uploadFiles}
                    beforeUpload={() => false}
                    onChange={({ fileList }) => setUploadFiles(fileList)}
                  >
                    <p className="ant-upload-drag-icon">
                      <UploadOutlined style={{ fontSize: 36, color: "#1677ff" }} />
                    </p>
                    <Paragraph>拖拽或点击上传病例文件</Paragraph>
                    <Text type="secondary">DICOM（.dcm）· ZIP · Excel · PDF · Word</Text>
                  </Upload.Dragger>
                  {uploadFiles.length > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      {uploadFiles.map((f) => (
                        <Tag key={f.uid} style={{ marginBottom: 4 }}>
                          {f.name}
                        </Tag>
                      ))}
                    </div>
                  ) : null}
                  <Button
                    type="primary"
                    size="large"
                    block
                    style={{ marginTop: 16 }}
                    icon={<ExperimentOutlined />}
                    onClick={goToAnalysis}
                  >
                    智能分析
                  </Button>
                  <Link to="/" style={{ display: "block", marginTop: 8, textAlign: "center" }}>
                    <Button block>或使用智能对话分析</Button>
                  </Link>
                </div>
              </Col>
              <Col xs={24} lg={10}>
                <div className="pmp-card" style={{ padding: 16 }}>
                  <div className="pmp-panel-title">说明</div>
                  <Paragraph type="secondary" style={{ fontSize: 13 }}>
                    上传含 DICOM 的 ZIP 或 .dcm 文件后，点击「智能分析」将调用影像诊断分析接口，并在本页展示分析结果与可视化图像。
                  </Paragraph>
                  {getPendingCaseFileNames().length > 0 ? (
                    <AlertLike text={`当前已缓存 ${getPendingCaseFileNames().length} 个文件，可直接进入智能分析`} />
                  ) : null}
                </div>
              </Col>
            </Row>
          </section>
        ) : null}

        {activeStep.key === "diagnosis" ? (
          <section className="pmp-section" style={{ background: "#f8fafc", borderRadius: 12 }}>
            <Title level={4}>
              <span className="pmp-section-num">2</span>
              智能分析 · 影像诊断分析
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              在工作台上传 DICOM 后，系统将调用影像诊断分析接口进行影像分析。
            </Paragraph>
            <Button type="primary" size="large" icon={<ExperimentOutlined />} onClick={goToAnalysis}>
              进入智能分析
            </Button>
          </section>
        ) : null}

        {activeStep.key === "database" ? (
          <section className="pmp-section">
            <Title level={4}>
              <span className="pmp-section-num">3</span>
              加入数据库
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              智能分析完成后，病例与影像数据可入库，可在数据库中浏览（只读）。
            </Paragraph>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <div className="pmp-card" style={{ padding: 16 }}>
                  <div className="pmp-panel-title">患者摘要</div>
                  <Paragraph>
                    {patient.name} · {patient.gender} · {patient.age}岁
                    <br />
                    {patient.diagnosis} · {patient.stage}
                  </Paragraph>
                  <Tag color="green">随访中</Tag>
                </div>
              </Col>
              <Col xs={24} md={16}>
                <div className="pmp-card" style={{ padding: 16 }}>
                  <Link to="/db/patients">
                    <Button type="primary">进入患者数据库</Button>
                  </Link>
                </div>
              </Col>
            </Row>
          </section>
        ) : null}

        {activeStep.key === "research" ? (
          <section className="pmp-section" style={{ background: "#f8fafc", borderRadius: 12 }}>
            <Title level={4}>
              <span className="pmp-section-num">4</span>
              科研延伸
            </Title>
            <Link to="/knowledge">
              <Button type="primary">进入科研延伸</Button>
            </Link>
          </section>
        ) : null}
      </div>

      <div className="pmp-workflow-footer">
        <Space>
          <Button icon={<LeftOutlined />} disabled={isFirst} onClick={() => goToStep(stepIndex - 1)}>
            上一步
          </Button>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {stepIndex + 1} / {WORKFLOW_STEPS.length} · {activeStep.label.replace(/^[①-⑨\d+\s]+/, "")}
          </Text>
          {!isLast ? (
            <Button type="primary" icon={<RightOutlined />} iconPosition="end" onClick={() => goToStep(stepIndex + 1)}>
              下一步
            </Button>
          ) : (
            <Link to="/knowledge">
              <Button type="primary">完成 · 进入科研延伸</Button>
            </Link>
          )}
        </Space>
      </div>
    </div>
  );
}

function AlertLike({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 12, padding: "8px 12px", background: "#e6f4ff", borderRadius: 8, fontSize: 12, color: "#1677ff" }}>
      {text}
    </div>
  );
}
