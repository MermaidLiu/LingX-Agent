import { DatabaseOutlined, TeamOutlined, UploadOutlined } from "@ant-design/icons";
import { App, AutoComplete, Button, Input, Space, Spin, Table, Tag, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { platformListPatients, type PlatformPatient } from "../../api/platform";

const { Title, Text } = Typography;

const COHORT_PRESETS = [
  "全部病例",
  "PMP 专病库（n=128）",
  "高级别亚组",
  "低级别亚组",
  "随访中队列",
  "2024 年入组",
];

type PatientRow = {
  id: string;
  name: string;
  gender: string;
  age: number;
  diagnosis: string;
  stage: string;
  gradeLabel: string;
  followUpStatus: string;
  enrolledAt: string;
  department: string;
};

function toRow(p: PlatformPatient): PatientRow {
  return {
    id: p.id,
    name: p.name,
    gender: p.gender,
    age: p.age,
    diagnosis: p.diagnosis,
    stage: p.stage,
    gradeLabel: p.gradeLabel ?? "—",
    followUpStatus: p.followUpStatus ?? "—",
    enrolledAt: p.enrolledAt,
    department: p.department,
  };
}

function matchCohort(row: PatientRow, cohort: string): boolean {
  const c = cohort.trim();
  if (!c || c === "全部病例") return true;
  if (c.includes("高级别")) return row.gradeLabel === "高级别";
  if (c.includes("低级别")) return row.gradeLabel === "低级别";
  if (c.includes("随访")) return row.followUpStatus === "随访中";
  if (c.includes("2024")) return row.enrolledAt.startsWith("2024");
  if (c.includes("PMP") || c.includes("专病")) return true;
  return (
    row.diagnosis.toLowerCase().includes(c.toLowerCase()) ||
    row.name.includes(c) ||
    row.id.toLowerCase().includes(c.toLowerCase()) ||
    row.department.includes(c)
  );
}

export default function PlatformPatientDbPage() {
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState("");
  const [cohort, setCohort] = useState("全部病例");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await platformListPatients();
      setRows(data.map(toRow));
    } catch {
      message.error("加载患者数据库失败，请确认后端已启动");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return rows.filter((p) => {
      if (!matchCohort(p, cohort)) return false;
      if (!k) return true;
      return (
        p.id.toLowerCase().includes(k) ||
        p.name.toLowerCase().includes(k) ||
        p.diagnosis.toLowerCase().includes(k)
      );
    });
  }, [rows, keyword, cohort]);

  return (
    <div className="pmp-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 8, color: "#1677ff" }} />
          患者数据库
        </Title>
        <Space>
          <Link to="/db/clinical">
            <Button size="small" type="primary" ghost icon={<UploadOutlined />}>
              导入临床 Excel
            </Button>
          </Link>
          <Button size="small" onClick={fetchPatients}>
            刷新
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            含队列筛选 · 智能分析完成后自动入库
          </Text>
        </Space>
      </div>

      <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
        <Space wrap>
          <div className="pmp-stat-inline">
            <Text type="secondary">病例总数</Text>
            <div className="pmp-stat-inline-value">{rows.length} 例</div>
          </div>
          <div className="pmp-stat-inline">
            <Text type="secondary">当前队列</Text>
            <div className="pmp-stat-inline-value" style={{ color: "#1677ff", fontSize: 15 }}>
              {filtered.length} 例
            </div>
          </div>
          <div className="pmp-stat-inline">
            <Text type="secondary">随访中</Text>
            <div className="pmp-stat-inline-value">
              {rows.filter((r) => r.followUpStatus === "随访中").length} 例
            </div>
          </div>
        </Space>
      </div>

      <div className="pmp-card" style={{ padding: 16 }}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Text type="secondary">队列</Text>
          <AutoComplete
            style={{ width: 260 }}
            value={cohort}
            options={COHORT_PRESETS.map((v) => ({ value: v }))}
            onChange={setCohort}
            placeholder="选择或输入队列条件，如：高级别亚组"
            filterOption={(input, option) =>
              (option?.value as string).toLowerCase().includes(input.toLowerCase())
            }
          />
          <Input.Search
            placeholder="搜索 ID / 姓名 / 诊断"
            allowClear
            style={{ width: 240 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Button icon={<DatabaseOutlined />} onClick={() => message.info("导出病例列表（演示）")}>
            导出
          </Button>
        </Space>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spin />
          </div>
        ) : (
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
              {
                title: "病理分级",
                dataIndex: "gradeLabel",
                width: 88,
                render: (v: string) =>
                  v === "高级别" ? <Tag color="red">{v}</Tag> : v === "低级别" ? <Tag color="green">{v}</Tag> : v,
              },
              { title: "分期", dataIndex: "stage", width: 72 },
              {
                title: "随访",
                dataIndex: "followUpStatus",
                width: 88,
                render: (v: string) => (v === "随访中" ? <Tag color="blue">{v}</Tag> : v),
              },
              { title: "入库时间", dataIndex: "enrolledAt", width: 100 },
              {
                title: "状态",
                width: 88,
                render: () => <Tag color="green">已入库</Tag>,
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
