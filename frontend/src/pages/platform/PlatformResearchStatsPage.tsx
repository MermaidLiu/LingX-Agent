import { BarChartOutlined } from "@ant-design/icons";
import { App, Button, Col, Row, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import { useState } from "react";
import {
  MOCK_COX_REGRESSION,
  MOCK_DESCRIPTIVE_STATS,
  MOCK_GROUP_COMPARE,
} from "../../data/researchMock";

const { Title, Paragraph, Text } = Typography;

export default function PlatformResearchStatsPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [cohort, setCohort] = useState("pmp_all");

  function runAnalysis() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success("统计分析完成（演示）");
    }, 800);
  }

  return (
    <div className="pmp-section">
      <Title level={4} style={{ marginBottom: 16 }}>
        <BarChartOutlined style={{ marginRight: 8, color: "#1677ff" }} />
        统计分析
      </Title>

      <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
        <Space wrap>
          <Text type="secondary">队列：</Text>
          <Select
            value={cohort}
            style={{ width: 220 }}
            onChange={setCohort}
            options={[
              { value: "pmp_all", label: "PMP 专病库（n=128）" },
              { value: "high_grade", label: "高级别亚组（n=62）" },
              { value: "low_grade", label: "低级别亚组（n=66）" },
              { value: "followup", label: "随访队列（n=48）" },
            ]}
          />
          <Select
            defaultValue="grade"
            style={{ width: 160 }}
            options={[
              { value: "grade", label: "结局：病理分级" },
              { value: "os", label: "结局：总生存 OS" },
              { value: "pfs", label: "结局：无进展 PFS" },
            ]}
          />
          <Button type="primary" loading={loading} onClick={runAnalysis}>
            运行分析
          </Button>
        </Space>
      </div>

      <div className="pmp-card" style={{ padding: 16 }}>
        <Tabs
          items={[
            {
              key: "desc",
              label: "描述统计",
              children: (
                <Table
                  size="small"
                  pagination={false}
                  rowKey="variable"
                  dataSource={MOCK_DESCRIPTIVE_STATS}
                  columns={[
                    { title: "变量", dataIndex: "variable" },
                    { title: "均值", dataIndex: "mean" },
                    { title: "标准差", dataIndex: "sd" },
                    { title: "n", dataIndex: "n" },
                  ]}
                />
              ),
            },
            {
              key: "compare",
              label: "组间比较",
              children: (
                <Table
                  size="small"
                  pagination={false}
                  rowKey="variable"
                  dataSource={MOCK_GROUP_COMPARE}
                  columns={[
                    { title: "比较", dataIndex: "variable" },
                    { title: "均值（组1 vs 组2）", dataIndex: "mean" },
                    { title: "P 值", dataIndex: "pValue" },
                    { title: "显著性", dataIndex: "sig" },
                  ]}
                />
              ),
            },
            {
              key: "cox",
              label: "Cox 回归",
              children: (
                <Table
                  size="small"
                  pagination={false}
                  rowKey="factor"
                  dataSource={MOCK_COX_REGRESSION}
                  columns={[
                    { title: "因素", dataIndex: "factor" },
                    { title: "HR", dataIndex: "hr" },
                    { title: "95% CI", dataIndex: "ci" },
                    { title: "P 值", dataIndex: "pValue" },
                    { title: "显著性", dataIndex: "sig" },
                  ]}
                />
              ),
            },
            {
              key: "km",
              label: "生存分析",
              children: (
                <Row gutter={16}>
                  <Col span={24}>
                    <div
                      style={{
                        height: 200,
                        background: "linear-gradient(180deg,#eff6ff,#fff)",
                        borderRadius: 8,
                        border: "1px solid #e8edf5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Space direction="vertical" align="center">
                        <Text type="secondary">Kaplan-Meier 曲线（演示）</Text>
                        <Space>
                          <Tag color="red">高级别 3y OS 38%</Tag>
                          <Tag color="green">低级别 3y OS 75%</Tag>
                        </Space>
                      </Space>
                    </div>
                    <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
                      Log-rank p &lt; 0.001 · 中位 OS：高级别 22.8 月 vs 低级别 &gt; 120 月
                    </Paragraph>
                  </Col>
                </Row>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
