import { ExperimentOutlined } from "@ant-design/icons";
import { App, Button, Col, Progress, Row, Space, Table, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import { MOCK_DIAGNOSIS } from "../../data/platformMock";

const { Title, Paragraph, Text } = Typography;

export default function PlatformDiagnosisPage() {
  const { message } = App.useApp();
  const primary = MOCK_DIAGNOSIS.probabilities[0];

  return (
    <div className="pmp-section">
      <Title level={4} style={{ marginBottom: 8 }}>
        <ExperimentOutlined style={{ marginRight: 8, color: "#1677ff" }} />
        诊断分析
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        基于智能对话上传的数据，给出<strong>怀疑疾病</strong>及鉴别诊断，不含治疗与预后。
      </Paragraph>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <div className="pmp-card" style={{ padding: 20 }}>
            <div className="pmp-panel-title">首要怀疑</div>
            <Tag color="red" style={{ fontSize: 15, padding: "6px 12px", marginBottom: 12 }}>
              {MOCK_DIAGNOSIS.title}
            </Tag>
            <Paragraph style={{ marginBottom: 8 }}>
              置信度 <Text strong>{(MOCK_DIAGNOSIS.confidence * 100).toFixed(0)}%</Text>
            </Paragraph>
            <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
              {MOCK_DIAGNOSIS.staging}
            </Paragraph>
          </div>
        </Col>

        <Col xs={24} lg={14}>
          <div className="pmp-card" style={{ padding: 16 }}>
            <div className="pmp-panel-title">鉴别诊断 · 疾病概率</div>
            {MOCK_DIAGNOSIS.probabilities.map((p) => (
              <div key={p.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <Space>
                    <span>{p.label}</span>
                    {p.pct === primary.pct ? <Tag color="blue">首要怀疑</Tag> : null}
                  </Space>
                  <span>{p.pct}%</span>
                </div>
                <Progress
                  percent={p.pct}
                  showInfo={false}
                  strokeColor={p.pct >= 50 ? "#cf1322" : "#1677ff"}
                  size="small"
                />
              </div>
            ))}
          </div>
        </Col>

        <Col xs={24}>
          <div className="pmp-card" style={{ padding: 16 }}>
            <div className="pmp-panel-title">支持依据</div>
            <Table
              size="small"
              pagination={false}
              rowKey={(_, i) => String(i)}
              dataSource={MOCK_DIAGNOSIS.evidence.map((e, i) => ({ key: i, item: e }))}
              columns={[
                { title: "序号", width: 60, render: (_, __, i) => i + 1 },
                { title: "依据", dataIndex: "item" },
              ]}
            />
          </div>
        </Col>
      </Row>

      <Space style={{ marginTop: 16 }}>
        <Link to="/">
          <Button>返回智能对话</Button>
        </Link>
        <Button type="primary" onClick={() => message.info("已根据最新数据刷新诊断（演示）")}>
          重新分析
        </Button>
        <Link to="/db/patients">
          <Button onClick={() => message.success("诊断结果可随病例一并入库")}>加入数据库</Button>
        </Link>
      </Space>
    </div>
  );
}
