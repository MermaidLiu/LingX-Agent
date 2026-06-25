import { DatabaseOutlined, TeamOutlined } from "@ant-design/icons";
import { App, Button, Input, Space, Table, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { MOCK_PATIENTS } from "../../data/platformMock";
import { loadPatients } from "../../lib/platformPatients";

const { Title, Text } = Typography;

export default function PlatformPatientDbPage() {
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState("");
  const patients = useMemo(() => loadPatients(), []);

  const rows = patients.length ? patients : MOCK_PATIENTS;

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter(
      (p) =>
        p.id.toLowerCase().includes(k) ||
        p.name.toLowerCase().includes(k) ||
        p.diagnosis.toLowerCase().includes(k),
    );
  }, [rows, keyword]);

  return (
    <div className="pmp-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 8, color: "#1677ff" }} />
          患者数据库
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          智能分析完成后自动入库 · 只读浏览
        </Text>
      </div>

      <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
        <Space wrap>
          <div className="pmp-stat-inline">
            <Text type="secondary">病例总数</Text>
            <div className="pmp-stat-inline-value">{rows.length} 例</div>
          </div>
          <div className="pmp-stat-inline">
            <Text type="secondary">随访中</Text>
            <div className="pmp-stat-inline-value" style={{ color: "#1677ff" }}>
              {Math.max(1, Math.floor(rows.length * 0.4))} 例
            </div>
          </div>
          <div className="pmp-stat-inline">
            <Text type="secondary">数据来源</Text>
            <div className="pmp-stat-inline-value">智能分析入库</div>
          </div>
        </Space>
      </div>

      <div className="pmp-card" style={{ padding: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索 ID / 姓名 / 诊断"
            allowClear
            style={{ width: 280 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Button icon={<DatabaseOutlined />} onClick={() => message.info("导出病例列表（演示）")}>
            导出
          </Button>
        </Space>
        <Table
          size="small"
          rowKey="id"
          dataSource={filtered}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: "患者 ID", dataIndex: "id", width: 130 },
            { title: "姓名", dataIndex: "name", width: 88 },
            {
              title: "基本信息",
              width: 120,
              render: (_, r) => `${r.gender} · ${r.age}岁`,
            },
            { title: "诊断", dataIndex: "diagnosis", ellipsis: true },
            { title: "分期", dataIndex: "stage", width: 72 },
            {
              title: "入库时间",
              dataIndex: "enrolledAt",
              width: 100,
              render: (v) => v || "—",
            },
            {
              title: "状态",
              width: 88,
              render: () => <Tag color="green">已入库</Tag>,
            },
          ]}
        />
      </div>
    </div>
  );
}
