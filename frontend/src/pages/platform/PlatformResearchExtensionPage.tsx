import { BarChartOutlined, DatabaseOutlined, LineChartOutlined, ReadOutlined } from "@ant-design/icons";
import { Button, Col, Row, Tag, Typography } from "antd";
import { Link } from "react-router-dom";

const { Title, Paragraph } = Typography;

export default function PlatformResearchExtensionPage() {
  return (
    <div className="pmp-section">
      <Title level={4} style={{ marginBottom: 4 }}>
        <LineChartOutlined style={{ marginRight: 8, color: "#1677ff" }} />
        AI 多模态科研智能体
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 8 }}>
        基于已有数据库的智能科研分析入口
      </Paragraph>
      <Tag color="green" style={{ marginBottom: 24 }}>
        已连接：多模态科研数据库
      </Tag>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <div className="pmp-entry-card pmp-entry-card--data">
            <BarChartOutlined style={{ fontSize: 36, color: "#1677ff", marginBottom: 12 }} />
            <Title level={4}>数据分析</Title>
            <Paragraph type="secondary">
              临床 · 影像 · 多模态三大独立工作台，选择分析任务、配置队列、运行分析并导出成果。
            </Paragraph>
            <Link to="/knowledge/data">
              <Button type="primary" size="large" block>
                进入数据分析
              </Button>
            </Link>
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div className="pmp-entry-card pmp-entry-card--lib">
            <ReadOutlined style={{ fontSize: 36, color: "#7c3aed", marginBottom: 12 }} />
            <Title level={4}>知识库</Title>
            <Paragraph type="secondary">
              科研问答与文献检索：可查实文献列表，一键生成综述、论文、基金项目书与 PPT。
            </Paragraph>
            <Link to="/knowledge/library">
              <Button size="large" block style={{ borderColor: "#7c3aed", color: "#7c3aed" }}>
                进入知识库
              </Button>
            </Link>
          </div>
        </Col>
      </Row>

      <div className="pmp-card" style={{ padding: 16, marginTop: 24 }}>
        <DatabaseOutlined style={{ color: "#1677ff", marginRight: 8 }} />
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          工作流建议：智能对话上传 → 智能分析诊断 → 入库 → 科研延伸（数据分析 / 知识库）
        </Typography.Text>
      </div>
    </div>
  );
}
