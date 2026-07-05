import { ExperimentOutlined, LeftOutlined, RightOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Col, Form, Input, InputNumber, Row, Select, Space, Tag, Typography, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MOCK_PATIENTS, WORKFLOW_STEPS } from "../../data/platformMock";
import { getPendingCaseFileNames, setPendingCaseFiles, toNativeFiles } from "../../lib/platformCaseUpload";
import { getWorkflowCase, saveClinicalFields } from "../../lib/workflowCase";

const { Title, Paragraph, Text } = Typography;

const ACCEPT = ".dcm,.dicom,.zip,.xlsx,.xls,.csv,.pdf,.doc,.docx,.json";

export default function PlatformWorkflowPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [clinicalForm] = Form.useForm();
  const patient = MOCK_PATIENTS[0];

  useEffect(() => {
    const wf = getWorkflowCase();
    const lab = wf.research_extensions?.lab_snapshot || {};
    clinicalForm.setFieldsValue({
      patientName: wf.patient_base_info.name,
      age: wf.patient_base_info.age || undefined,
      gender: wf.patient_base_info.gender || undefined,
      department: wf.patient_base_info.department,
      medicalRecordId: wf.patient_base_info.medical_record_id,
      clinicalDiagnosis: wf.interview_info.clinical_diagnosis,
      briefMedicalHistory: wf.interview_info.brief_medical_history,
      tnmStage: lab["TNM分期"] || "",
      cea: lab.CEA || "",
      ca125: lab.CA125 || "",
      ca19_9: lab["CA19-9"] || lab.CA199 || "",
      treatmentMethod: lab["治疗方式"] || "",
      surgeryNumber: lab["第几次手术"] || "",
      ivChemotherapy: lab["是否静脉化疗"] || "",
      ccScore: lab["CC评分"] || "",
    });
  }, [clinicalForm]);

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

  function persistClinicalFields() {
    const v = clinicalForm.getFieldsValue();
    saveClinicalFields({
      patientName: v.patientName,
      age: v.age,
      gender: v.gender,
      department: v.department,
      medicalRecordId: v.medicalRecordId,
      clinicalDiagnosis: v.clinicalDiagnosis,
      briefMedicalHistory: v.briefMedicalHistory,
      tnmStage: v.tnmStage,
      treatmentMethod: v.treatmentMethod,
      surgeryNumber: v.surgeryNumber,
      ivChemotherapy: v.ivChemotherapy,
      ccScore: v.ccScore,
      labSnapshot: {
        CEA: v.cea,
        CA125: v.ca125,
        "CA19-9": v.ca19_9,
      },
    });
  }

  function goToAnalysis() {
    persistClinicalFields();
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
                <div className="pmp-card" style={{ padding: 20, marginBottom: 16 }}>
                  <div className="pmp-panel-title">临床信息</div>
                  <Form form={clinicalForm} layout="vertical" size="middle" onValuesChange={() => persistClinicalFields()}>
                    <Row gutter={12}>
                      <Col xs={24} sm={12}>
                        <Form.Item name="patientName" label="姓名">
                          <Input placeholder="患者姓名" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="age" label="年龄">
                          <InputNumber min={0} max={120} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="gender" label="性别">
                          <Select allowClear options={[{ value: "男" }, { value: "女" }]} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="department" label="科室">
                          <Input placeholder="如 妇科肿瘤科" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="medicalRecordId" label="病历号">
                          <Input placeholder="院内病历号" />
                        </Form.Item>
                      </Col>
                      <Col xs={24}>
                        <Form.Item name="clinicalDiagnosis" label="临床诊断" rules={[{ required: true, message: "请填写临床诊断" }]}>
                          <Input placeholder="如 腹膜假粘液瘤（PMP）" />
                        </Form.Item>
                      </Col>
                      <Col xs={24}>
                        <Form.Item name="briefMedicalHistory" label="病史摘要">
                          <Input.TextArea rows={2} placeholder="主诉、既往史、手术史等" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item name="tnmStage" label="TNM 分期">
                          <Input placeholder="cT2N1M0" />
                        </Form.Item>
                      </Col>
                      <Col xs={24}>
                        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                          实验室指标
                        </Text>
                      </Col>
                      <Col xs={8} sm={8}>
                        <Form.Item name="cea" label="CEA">
                          <Input placeholder="ng/mL" />
                        </Form.Item>
                      </Col>
                      <Col xs={8} sm={8}>
                        <Form.Item name="ca125" label="CA125">
                          <Input placeholder="U/mL" />
                        </Form.Item>
                      </Col>
                      <Col xs={8} sm={8}>
                        <Form.Item name="ca19_9" label="CA19-9">
                          <Input placeholder="U/mL" />
                        </Form.Item>
                      </Col>
                      <Col xs={24}>
                        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                          治疗与手术信息
                        </Text>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="treatmentMethod" label="治疗方式">
                          <Select
                            allowClear
                            placeholder="选择或输入"
                            options={[
                              { value: "CRS+HIPEC" },
                              { value: "单纯CRS" },
                              { value: "新辅助化疗+手术" },
                              { value: "姑息化疗" },
                              { value: "观察随访" },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="surgeryNumber" label="第几次手术">
                          <Select
                            allowClear
                            options={[
                              { value: "第1次" },
                              { value: "第2次" },
                              { value: "第3次" },
                              { value: "≥第4次" },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="ivChemotherapy" label="是否静脉化疗">
                          <Select allowClear options={[{ value: "是" }, { value: "否" }]} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="ccScore" label="CC评分">
                          <Select
                            allowClear
                            options={[
                              { value: "CC-0" },
                              { value: "CC-1" },
                              { value: "CC-2" },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Form>
                </div>
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
                    填写临床信息与实验室指标（CEA、CA125、CA19-9）并上传 DICOM/ZIP 后进入智能分析：系统将输出影像分割、PCI 评分、综合报告、指南治疗建议，并可一键加入随访队列，再进入科研延伸。
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
              完成影像+临床联合分析后，平台将输出综合报告与 NCCN/CSCO 指南治疗建议，确认后可加入随访队列。
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
              分析完成并入队后，可在患者数据库（Excel 式总表，含临床/病理/影像）与随访队列查看；最新公开临床指标可在智能对话中通过 DeepSeek 检索。
            </Paragraph>
            <Space wrap style={{ marginBottom: 16 }}>
              <Link to="/db/follow-up">
                <Button>随访队列</Button>
              </Link>
              <Link to="/db/patients">
                <Button>患者数据库</Button>
              </Link>
            </Space>
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
