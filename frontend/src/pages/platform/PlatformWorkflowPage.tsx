import {
  ExperimentOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  LineChartOutlined,
  ReadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Col,
  Input,
  Progress,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import {
  MOCK_CORRELATIONS,
  MOCK_DIAGNOSIS,
  MOCK_PATIENTS,
  MOCK_RESEARCH_IDEAS,
  WORKFLOW_STEPS,
} from "../../data/platformMock";

const { Title, Paragraph, Text } = Typography;

export default function PlatformWorkflowPage() {
  const { message } = App.useApp();
  const [activeStep, setActiveStep] = useState("input");
  const patient = MOCK_PATIENTS[0];

  function scrollToStep(key: string) {
    setActiveStep(key);
    document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div className="pmp-step-bar">
        {WORKFLOW_STEPS.map((s) => (
          <div
            key={s.key}
            className={`pmp-step-item${activeStep === s.key ? " pmp-step-item--active" : ""}`}
            onClick={() => scrollToStep(s.key)}
            role="button"
            tabIndex={0}
          >
            {s.label}
          </div>
        ))}
      </div>

      {/* ① 多模态数据输入 */}
      <section id="section-input" className="pmp-section">
        <Title level={4}>
          <span className="pmp-section-num">1</span>
          多模态数据输入
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <div className="pmp-card" style={{ padding: 20 }}>
              <div className="pmp-upload-zone">
                <UploadOutlined style={{ fontSize: 36, color: "#1677ff", marginBottom: 12 }} />
                <Paragraph>拖拽或点击上传 DICOM / PDF / JPG / CSV 等文件</Paragraph>
                <Text type="secondary">支持 CT、MRI、PET-CT、病理切片、检验报告</Text>
              </div>
              <Button type="primary" size="large" block style={{ marginTop: 16 }} icon={<ExperimentOutlined />}>
                开始智能分析
              </Button>
            </div>
          </Col>
          <Col xs={24} lg={10}>
            <div className="pmp-card" style={{ padding: 16, marginBottom: 12 }}>
              <div className="pmp-panel-title">影像数据</div>
              <Space wrap>
                {["CT 05-18", "MRI 05-16", "PET-CT 05-15", "超声 05-10"].map((t) => (
                  <div key={t} className="pmp-data-thumb">
                    <FileImageOutlined style={{ fontSize: 22, color: "#1677ff" }} />
                    {t}
                  </div>
                ))}
              </Space>
            </div>
            <div className="pmp-card" style={{ padding: 16, marginBottom: 12 }}>
              <div className="pmp-panel-title">病理数据</div>
              <Space wrap>
                {["HE 染色", "Ki-67", "P53"].map((t) => (
                  <div key={t} className="pmp-data-thumb">
                    <span style={{ fontSize: 20 }}>🔬</span>
                    {t}
                  </div>
                ))}
              </Space>
            </div>
            <div className="pmp-card" style={{ padding: 16 }}>
              <div className="pmp-panel-title">检验数据</div>
              <Space wrap>
                {["血常规", "生化", "肿瘤标志物", "基因检测"].map((t) => (
                  <div key={t} className="pmp-data-thumb">
                    <FilePdfOutlined style={{ fontSize: 20, color: "#1677ff" }} />
                    {t}
                  </div>
                ))}
              </Space>
            </div>
          </Col>
        </Row>

        <div className="pmp-card" style={{ padding: 16, marginTop: 16 }}>
          <div className="pmp-panel-title">临床数据 / 病历输入</div>
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Text type="secondary">姓名</Text>
              <Input defaultValue={patient.name} style={{ marginTop: 4 }} />
            </Col>
            <Col xs={24} md={4}>
              <Text type="secondary">性别</Text>
              <Input defaultValue={patient.gender} style={{ marginTop: 4 }} />
            </Col>
            <Col xs={24} md={4}>
              <Text type="secondary">年龄</Text>
              <Input defaultValue={String(patient.age)} style={{ marginTop: 4 }} />
            </Col>
            <Col xs={24} md={10}>
              <Text type="secondary">住院号</Text>
              <Input defaultValue={patient.admissionId} style={{ marginTop: 4 }} />
            </Col>
            <Col xs={24} md={12} style={{ marginTop: 12 }}>
              <Text type="secondary">临床诊断</Text>
              <Input.TextArea rows={2} defaultValue={patient.diagnosis} style={{ marginTop: 4 }} />
            </Col>
            <Col xs={24} md={12} style={{ marginTop: 12 }}>
              <Text type="secondary">主诉 / 病史</Text>
              <Input.TextArea
                rows={2}
                defaultValue={`${patient.chiefComplaint}；${patient.pastHistory}`}
                style={{ marginTop: 4 }}
              />
            </Col>
          </Row>
          <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
            若未上传含 PET 的 DICOM，则不会显示 SUV 等代谢指标。
          </Paragraph>
        </div>
      </section>

      {/* ② 智能诊断与治疗建议 */}
      <section id="section-diagnosis" className="pmp-section" style={{ background: "#f8fafc" }}>
        <Title level={4}>
          <span className="pmp-section-num">2</span>
          智能诊断与治疗建议
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <div className="pmp-card" style={{ padding: 16 }}>
              <div className="pmp-panel-title">诊断结果</div>
              <Tag color="red" style={{ fontSize: 14, padding: "4px 10px" }}>
                {MOCK_DIAGNOSIS.title}
              </Tag>
              <Paragraph style={{ marginTop: 12, marginBottom: 8 }}>
                置信度 <Text strong>{(MOCK_DIAGNOSIS.confidence * 100).toFixed(0)}%</Text> · 病理分级：中分化 ·
                TNM：{MOCK_DIAGNOSIS.staging}
              </Paragraph>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                分子特征：EGFR L858R · PD-L1 30%
              </Paragraph>
              <Button
                type="primary"
                icon={<ExperimentOutlined />}
                style={{ marginTop: 12 }}
                onClick={() => message.info("诊断分析（演示）")}
              >
                生成诊断结果
              </Button>
              <Button
                style={{ marginTop: 12, marginLeft: 8 }}
                onClick={() => message.success("已加入随访队列（演示）")}
              >
                加入随访队列
              </Button>
            </div>
          </Col>
          <Col xs={24} lg={14}>
            <div className="pmp-card" style={{ padding: 16 }}>
              <div className="pmp-panel-title">概率分布 Top5</div>
              {MOCK_DIAGNOSIS.probabilities.map((p) => (
                <div key={p.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>{p.label}</span>
                    <span>{p.pct}%</span>
                  </div>
                  <Progress percent={p.pct} showInfo={false} strokeColor="#1677ff" size="small" />
                </div>
              ))}
            </div>
          </Col>
          <Col xs={24} lg={14}>
            <div className="pmp-card" style={{ padding: 16 }}>
              <Tabs
                items={[
                  {
                    key: "plan",
                    label: "治疗方案",
                    children: (
                      <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
                        {MOCK_DIAGNOSIS.treatments.map((t, i) => (
                          <li key={t}>
                            {t} {i === 0 ? <Tag color="blue">首选</Tag> : null}
                          </li>
                        ))}
                      </ol>
                    ),
                  },
                  { key: "drug", label: "用药建议", children: <Text type="secondary">奥希替尼 80mg qd（演示）</Text> },
                  { key: "follow", label: "随访建议", children: <Text type="secondary">每 3 个月 CT + 标志物（演示）</Text> },
                  { key: "trial", label: "临床试验", children: <Text type="secondary">暂无匹配试验（演示）</Text> },
                ]}
              />
            </div>
          </Col>
          <Col xs={24} lg={10}>
            <div className="pmp-card" style={{ padding: 16 }}>
              <div className="pmp-panel-title">预后预测</div>
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Text type="secondary">mPFS</Text>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{MOCK_DIAGNOSIS.prognosis.mpfs}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">mOS</Text>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{MOCK_DIAGNOSIS.prognosis.mos}</div>
                </Col>
                <Col span={8}>
                  <Text type="secondary">1 年生存</Text>
                  <div>{MOCK_DIAGNOSIS.prognosis.y1}</div>
                </Col>
                <Col span={8}>
                  <Text type="secondary">2 年生存</Text>
                  <div>{MOCK_DIAGNOSIS.prognosis.y2}</div>
                </Col>
                <Col span={8}>
                  <Text type="secondary">3 年生存</Text>
                  <div>{MOCK_DIAGNOSIS.prognosis.y3}</div>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>
      </section>

      {/* ③ PMP 数据库 */}
      <section id="section-database" className="pmp-section">
        <Title level={4}>
          <span className="pmp-section-num">3</span>
          PMP 数据库
        </Title>
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
              <div className="pmp-panel-title">数据概览</div>
              <div className="pmp-workflow-grid">
                {[
                  { label: "影像", count: 12 },
                  { label: "病理", count: 3 },
                  { label: "检验", count: 8 },
                  { label: "基因", count: 1 },
                  { label: "随访", count: 3 },
                ].map((d) => (
                  <div key={d.label} className="pmp-card" style={{ padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 600, color: "#1677ff" }}>{d.count}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{d.label}</div>
                  </div>
                ))}
              </div>
              <Button type="primary" style={{ marginTop: 16 }}>
                进入患者档案
              </Button>
            </div>
          </Col>
        </Row>
      </section>

      {/* ④ 知识延伸与分析 */}
      <section id="section-knowledge" className="pmp-section" style={{ background: "#f8fafc" }}>
        <Title level={4}>
          <span className="pmp-section-num">4</span>
          知识延伸分析
        </Title>
        <div className="pmp-card" style={{ padding: 16 }}>
          <Tabs
            items={[
              {
                key: "corr",
                label: "相关性分析",
                children: (
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="factor"
                    dataSource={MOCK_CORRELATIONS}
                    columns={[
                      { title: "因素", dataIndex: "factor" },
                      { title: "相关系数 r", dataIndex: "r", render: (v: number) => v.toFixed(2) },
                      { title: "P 值", dataIndex: "p", render: (v: number) => v.toFixed(3) },
                      { title: "显著性", dataIndex: "sig" },
                    ]}
                  />
                ),
              },
              { key: "survival", label: "生存分析", children: <Text type="secondary">Kaplan-Meier 曲线（演示）</Text> },
              { key: "subgroup", label: "亚组分析", children: <Text type="secondary">亚组森林图（演示）</Text> },
              { key: "model", label: "预后模型", children: <Text type="secondary">Cox 多因素回归（演示）</Text> },
            ]}
          />
        </div>
      </section>

      {/* ⑤ 科研支持与输出 */}
      <section id="section-research" className="pmp-section">
        <Title level={4}>
          <span className="pmp-section-num">5</span>
          科研支持与输出
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div className="pmp-card" style={{ padding: 16 }}>
              <div className="pmp-panel-title">
                <ReadOutlined /> AI 科研选题
              </div>
              <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
                {MOCK_RESEARCH_IDEAS.map((idea) => (
                  <li key={idea}>{idea}</li>
                ))}
              </ul>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div className="pmp-card" style={{ padding: 16 }}>
              <div className="pmp-panel-title">
                <LineChartOutlined /> 统计结果
              </div>
              <div
                style={{
                  height: 120,
                  background: "linear-gradient(180deg,#eff6ff,#fff)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                }}
              >
                Kaplan-Meier 生存曲线（演示）
              </div>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div className="pmp-card" style={{ padding: 16 }}>
              <div className="pmp-panel-title">文献助手</div>
              <Paragraph type="secondary">最新相关文献 3 篇（演示）</Paragraph>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div className="pmp-card" style={{ padding: 16 }}>
              <div className="pmp-panel-title">
                <FileTextOutlined /> PPT 生成
              </div>
              <Paragraph type="secondary">已生成 12 页幻灯片预览（演示）</Paragraph>
              <Button type="primary" icon={<FilePdfOutlined />}>
                生成完整 PPT
              </Button>
            </div>
          </Col>
        </Row>
      </section>
    </div>
  );
}
