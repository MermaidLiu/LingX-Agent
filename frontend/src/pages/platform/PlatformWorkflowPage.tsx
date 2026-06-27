import { ExperimentOutlined, LeftOutlined, RightOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Col, Input, Progress, Row, Space, Table, Tabs, Tag, Typography } from "antd";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  MOCK_CORRELATIONS,
  MOCK_DIAGNOSIS,
  MOCK_PATIENTS,
  WORKFLOW_STEPS,
} from "../../data/platformMock";

const { Title, Paragraph, Text } = Typography;

export default function PlatformWorkflowPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const patient = MOCK_PATIENTS[0];

  const activeStep = WORKFLOW_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === WORKFLOW_STEPS.length - 1;

  const goToStep = useCallback((index: number) => {
    const next = Math.max(0, Math.min(WORKFLOW_STEPS.length - 1, index));
    setStepIndex(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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
                    defaultValue="请基于上传数据，给出怀疑疾病及鉴别诊断"
                    style={{ marginBottom: 12 }}
                  />
                  <Input.TextArea rows={2} placeholder="关注变量：病理分级、SUVmax、Ki-67…" />
                </div>
              </Col>
            </Row>
          </section>
        ) : null}

        {activeStep.key === "diagnosis" ? (
          <section className="pmp-section" style={{ background: "#f8fafc", borderRadius: 12 }}>
            <Title level={4}>
              <span className="pmp-section-num">2</span>
              智能分析 · 诊断
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              给出怀疑疾病及鉴别诊断，不含治疗与预后。
            </Paragraph>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={10}>
                <div className="pmp-card" style={{ padding: 16 }}>
                  <div className="pmp-panel-title">首要怀疑</div>
                  <Tag color="red" style={{ fontSize: 14, padding: "4px 10px" }}>
                    {MOCK_DIAGNOSIS.title}
                  </Tag>
                  <Paragraph style={{ marginTop: 12, marginBottom: 0 }}>
                    置信度 <Text strong>{(MOCK_DIAGNOSIS.confidence * 100).toFixed(0)}%</Text> · {MOCK_DIAGNOSIS.staging}
                  </Paragraph>
                </div>
              </Col>
              <Col xs={24} lg={14}>
                <div className="pmp-card" style={{ padding: 16 }}>
                  <div className="pmp-panel-title">鉴别诊断 · 疾病概率</div>
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
              <Col xs={24}>
                <div className="pmp-card" style={{ padding: 16 }}>
                  <div className="pmp-panel-title">支持依据</div>
                  <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, fontSize: 13 }}>
                    {MOCK_DIAGNOSIS.evidence.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                  <Link to="/analysis" style={{ display: "inline-block", marginTop: 12 }}>
                    <Button type="primary" icon={<ExperimentOutlined />}>
                      查看完整诊断分析
                    </Button>
                  </Link>
                </div>
              </Col>
            </Row>
          </section>
        ) : null}

        {activeStep.key === "database" ? (
          <section className="pmp-section">
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
        ) : null}

        {activeStep.key === "research" ? (
          <section className="pmp-section" style={{ background: "#f8fafc", borderRadius: 12 }}>
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
