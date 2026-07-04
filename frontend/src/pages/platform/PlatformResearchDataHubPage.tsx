import { ExperimentOutlined, FileSearchOutlined, MergeCellsOutlined, ReadOutlined } from "@ant-design/icons";
import { Button, Space, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import WorkflowContextBanner from "../../components/platform/WorkflowContextBanner";

const { Title, Paragraph, Text } = Typography;

const MODULES = [
  {
    key: "clinical",
    path: "/db/clinical",
    title: "临床数据集 · Excel 导入",
    desc: "按两行表头 Excel 导入患者信息、影像/病理文件关联，进入数据处理、基础/高级统计与机器学习流程。",
    tags: ["Excel 导入", "变量管理", "基础统计", "机器学习"],
    theme: "navy" as const,
    icon: <FileSearchOutlined style={{ fontSize: 28 }} />,
  },
  {
    key: "imaging",
    path: "/knowledge/data/imaging",
    title: "影像数据智能分析",
    desc: "面向 CT / MRI / PET / WSI 等影像数据，结合机器学习或深度学习进行特征筛选与预测建模。",
    tags: ["影像组学", "深度学习", "特征筛选", "基因分型预测"],
    theme: "cyan" as const,
    icon: <ExperimentOutlined style={{ fontSize: 28 }} />,
  },
  {
    key: "multimodal",
    path: "/knowledge/data/multimodal",
    title: "多模态联合分析",
    desc: "融合临床、病理、影像、组学与随访数据，构建联合模型并解释各模态贡献度。",
    tags: ["联合建模", "风险分层", "贡献度分析", "综合结论"],
    theme: "purple" as const,
    icon: <MergeCellsOutlined style={{ fontSize: 28 }} />,
  },
];

export default function PlatformResearchDataHubPage() {
  return (
    <div className="pmp-section">
      <Space style={{ marginBottom: 8 }}>
        <Tag color="green">已连接：多模态科研数据库</Tag>
      </Space>
      <Title level={4} style={{ marginBottom: 4 }}>
        请选择分析模块
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        首页保留三个入口，点击后进入对应的独立分析工作台（自动关联工作台病例与智能分析结果）
      </Paragraph>

      <WorkflowContextBanner compact />

      <div className="pmp-module-cards">
        {MODULES.map((m) => (
          <div key={m.key} className={`pmp-module-card pmp-module-card--${m.theme}`}>
            <div className="pmp-module-card-icon">{m.icon}</div>
            <Title level={5} style={{ margin: "12px 0 8px", color: "#fff" }}>
              {m.title}
            </Title>
            <Paragraph style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, minHeight: 48 }}>
              {m.desc}
            </Paragraph>
            <Space wrap size={[4, 4]} style={{ marginBottom: 16 }}>
              {m.tags.map((t) => (
                <Tag key={t} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff" }}>
                  {t}
                </Tag>
              ))}
            </Space>
            <Link to={m.path}>
              <Button type="default" ghost block>
                进入模块
              </Button>
            </Link>
          </div>
        ))}
      </div>

      <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 16 }}>
        提示：先在临床或影像模块运行分析并保存结果，多模态模块可自动关联两者输出进行联合建模。
      </Text>
    </div>
  );
}
