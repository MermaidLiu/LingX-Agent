import { BarChartOutlined, DatabaseOutlined, FilePptOutlined, LineChartOutlined, ReadOutlined } from "@ant-design/icons";
import { Button, Col, Row, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import WorkflowContextBanner from "../../components/platform/WorkflowContextBanner";

const { Title, Paragraph } = Typography;

export default function PlatformResearchExtensionPage() {
  return (
    <div className="pmp-section">
      <Title level={4} style={{ marginBottom: 4 }}>
        <LineChartOutlined style={{ marginRight: 8, color: "#1677ff" }} />
        AI 多模态科研智能体
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 8 }}>
        基于工作台病例、智能分析与数据库的串联科研入口
      </Paragraph>
      <Tag color="green" style={{ marginBottom: 16 }}>
        已连接：多模态科研数据库
      </Tag>

      <WorkflowContextBanner />

      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <div className="pmp-entry-card pmp-entry-card--data">
            <BarChartOutlined style={{ fontSize: 36, color: "#1677ff", marginBottom: 12 }} />
            <Title level={4}>数据分析</Title>
            <Paragraph type="secondary">
              临床 · 影像组学（标注图建模）· 多模态联合分析。
            </Paragraph>
            <Link to="/knowledge/data">
              <Button type="primary" size="large" block>
                进入数据分析
              </Button>
            </Link>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="pmp-entry-card pmp-entry-card--lib">
            <ReadOutlined style={{ fontSize: 36, color: "#7c3aed", marginBottom: 12 }} />
            <Title level={4}>科研选题</Title>
            <Paragraph type="secondary">
              基于组学结果生成论文题目：区分市面已有研究与创新空白方向。
            </Paragraph>
            <Link to="/knowledge/publications">
              <Button size="large" block style={{ borderColor: "#7c3aed", color: "#7c3aed" }}>
                论文选题
              </Button>
            </Link>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="pmp-entry-card pmp-entry-card--lib">
            <FilePptOutlined style={{ fontSize: 36, color: "#0891b2", marginBottom: 12 }} />
            <Title level={4}>PPT 生成</Title>
            <Paragraph type="secondary">
              领导汇报 / 学术分享 / 政府汇报 · 可上传模板自动填充内容。
            </Paragraph>
            <Link to="/knowledge/ppt">
              <Button size="large" block>
                生成 PPT
              </Button>
            </Link>
          </div>
        </Col>
      </Row>

      <div className="pmp-card" style={{ padding: 16, marginTop: 24 }}>
        <DatabaseOutlined style={{ color: "#1677ff", marginRight: 8 }} />
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          完整流程：工作台上传 → 智能分析（标注图+评分）→ 加入病理库/影像库 → 科研延伸（组学建模 → 论文选题 → PPT）
        </Typography.Text>
      </div>
    </div>
  );
}
