import { ExperimentOutlined, UploadOutlined } from "@ant-design/icons";
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
import { Link } from "react-router-dom";
import {
  MOCK_CORRELATIONS,
  MOCK_DIAGNOSIS,
  MOCK_PATIENTS,
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

      {/* ① 智能对话 · 上传分析 */}
      <section id="section-input" className="pmp-section">
        <Title level={4}>
          <span className="pmp-section-num">1</span>
          智能对话 · 上传分析
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <div className="pmp-card" style={{ padding: 20 }}>
              <div className="pmp-upload-zone">
                <UploadOutlined style={{ fontSize: 36, color: "#1677ff", marginBottom: 12 }} />
                <Paragraph>上传 Excel · ZIP · PDF · Word，在智能对话中描述分析需求</Paragraph>
                <Text type="secondary">支持检验表、影像压缩包、病理报告、病历文档</Text>
              </div>
              <Link to="/">
                <Button type="primary" size="large" block style={{ marginTop: 16 }} icon={<ExperimentOutlined />}>
                  前往智能对话
                </Button>
              </Link>
            </div>
          </Col>
          <Col xs={24} lg={10}>
            <div className="pmp-card" style={{ padding: 16 }}>
              <div className="pmp-panel-title">分析需求（可编辑）</div>
              <Input.TextArea
                rows={4}
                defaultValue="请基于上传数据给出 PMP 诊断、分级与治疗建议"
                style={{ marginBottom: 12 }}
              />
              <Input.TextArea rows={2} placeholder="关注变量：病理分级、SUVmax、Ki-67…" />
            </div>
          </Col>
        </Row>
      </section>

      {/* ② 智能分析 */}
      <section id="section-diagnosis" className="pmp-section" style={{ background: "#f8fafc" }}>
        <Title level={4}>
          <span className="pmp-section-num">2</span>
          智能分析
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

      {/* ③ 加入数据库 */}
      <section id="section-database" className="pmp-section">
        <Title level={4}>
          <span className="pmp-section-num">3</span>
          加入数据库
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          智能分析完成后，病例与影像数据自动入库，可在数据库中浏览（只读）。
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
              <div className="pmp-panel-title">数据概览</div>
              <div className="pmp-workflow-grid">
                {[
                  { label: "患者", count: 128 },
                  { label: "影像", count: 12 },
                  { label: "检验", count: 8 },
                  { label: "随访", count: 3 },
                ].map((d) => (
                  <div key={d.label} className="pmp-card" style={{ padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 600, color: "#1677ff" }}>{d.count}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{d.label}</div>
                  </div>
                ))}
              </div>
              <Link to="/db/patients">
                <Button type="primary" style={{ marginTop: 16 }}>
                  进入患者数据库
                </Button>
              </Link>
            </div>
          </Col>
        </Row>
      </section>

      {/* ④ 科研延伸 */}
      <section id="section-research" className="pmp-section" style={{ background: "#f8fafc" }}>
        <Title level={4}>
          <span className="pmp-section-num">4</span>
          科研延伸
        </Title>
        <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="pmp-panel-title">分析需求（可编辑）</div>
          <Input.TextArea
            rows={2}
            defaultValue="探索病理分级与 SUVmax 的相关性及预后价值"
            style={{ marginBottom: 12 }}
          />
          <Input.TextArea rows={2} placeholder="关注变量、亚组条件、输出格式…" />
        </div>
        <div className="pmp-card" style={{ padding: 16 }}>
          <Tabs
            items={[
              {
                key: "corr",
                label: "相关性",
                children: (
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="factor"
                    dataSource={MOCK_CORRELATIONS}
                    columns={[
                      { title: "因素", dataIndex: "factor" },
                      { title: "r", dataIndex: "r", render: (v: number) => v.toFixed(2) },
                      { title: "P", dataIndex: "p", render: (v: number) => v.toFixed(3) },
                      { title: "显著性", dataIndex: "sig" },
                    ]}
                  />
                ),
              },
              { key: "survival", label: "生存分析", children: <Text type="secondary">Kaplan-Meier · 见科研延伸页</Text> },
              { key: "stats", label: "统计分析", children: <Text type="secondary">Cox / 组间比较 · 见科研延伸页</Text> },
              { key: "ppt", label: "PPT", children: <Text type="secondary">一键生成汇报 · 见科研延伸页</Text> },
            ]}
          />
          <Link to="/knowledge">
            <Button type="link" style={{ marginTop: 8, padding: 0 }}>
              进入科研延伸 →
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
