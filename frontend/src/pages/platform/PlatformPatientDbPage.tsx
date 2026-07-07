import { DatabaseOutlined, DownOutlined, ExperimentOutlined, TeamOutlined } from "@ant-design/icons";
import { App, Alert, Button, Dropdown, Input, Select, Space, Spin, Table, Tag, Typography } from "antd";
import type { ColumnsType, TableRowSelection } from "antd/es/table/interface";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { platformListPatients, type PlatformPatient } from "../../api/platform";
import PatientImagingModal, { ImagingViewButton } from "../../components/platform/PatientImagingModal";
import { saveBatchSelection, type BatchOperationIntent } from "../../lib/platformBatchSelection";
import { activateResearchFromPatients } from "../../lib/researchBatchContext";
import { batchCasesToPlatformPatients, loadFollowUpBatch } from "../../lib/followUpBatchStore";
import { loadPatients } from "../../lib/platformPatients";

const { Title, Text, Paragraph } = Typography;

const GRADE_FILTER_OPTIONS = [
  { value: "全部", label: "全部" },
  { value: "高级别", label: "高级别" },
  { value: "低级别", label: "低级别" },
  { value: "未确定", label: "未确定" },
];

function gradeTag(v: string) {
  if (v === "高级别") return <Tag color="red">{v}</Tag>;
  if (v === "低级别") return <Tag color="green">{v}</Tag>;
  if (v === "未确定") return <Tag>{v}</Tag>;
  return v || "—";
}

function cell(v?: string | null) {
  return v && v !== "—" ? v : "—";
}

export default function PlatformPatientDbPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [gradeFilter, setGradeFilter] = useState("全部");
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [rows, setRows] = useState<PlatformPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewPatient, setViewPatient] = useState<PlatformPatient | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await platformListPatients({
        keyword,
        gradeLabel: gradeFilter,
        followUp: followUpOnly,
      });
      const batch = loadFollowUpBatch();
      if (batch?.cases.length) {
        const map = new Map(data.map((p) => [p.id, p]));
        for (const p of batchCasesToPlatformPatients(batch.cases)) {
          if (!map.has(p.id)) map.set(p.id, p);
        }
        setRows(Array.from(map.values()));
      } else {
        setRows(data);
      }
    } catch {
      setRows(loadPatients());
      message.error("加载患者数据库失败，已显示本地缓存");
    } finally {
      setLoading(false);
    }
  }, [message, keyword, gradeFilter, followUpOnly]);

  useEffect(() => {
    const t = window.setTimeout(() => void fetchPatients(), 200);
    return () => window.clearTimeout(t);
  }, [fetchPatients]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      high: rows.filter((r) => r.gradeLabel === "高级别").length,
      low: rows.filter((r) => r.gradeLabel === "低级别").length,
      follow: rows.filter((r) => r.followUpStatus === "随访中").length,
    }),
    [rows],
  );

  const selectedPatients = useMemo(
    () => rows.filter((r) => selectedRowKeys.includes(r.id)),
    [rows, selectedRowKeys],
  );

  const rowSelection: TableRowSelection<PlatformPatient> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys as string[]),
    columnWidth: 48,
    fixed: "left",
  };

  function resolveBatchPatients(): PlatformPatient[] {
    if (selectedPatients.length) return selectedPatients;
    message.warning("请先勾选至少一名患者");
    return [];
  }

  function runBatchOperation(intent: BatchOperationIntent) {
    const patients = resolveBatchPatients();
    if (!patients.length) return;
    if (intent === "radiomics") {
      const withImage = patients.filter((p) => p.hasAnnotatedImage);
      if (!withImage.length) {
        message.warning("所选患者暂无 AI 分割标注图，请先在智能分析完成 DICOM 分析并入库");
        return;
      }
      saveBatchSelection(withImage, intent);
      activateResearchFromPatients(withImage, "patient_db", intent);
      navigate("/knowledge/data/imaging");
      return;
    }
    saveBatchSelection(patients, intent);
    activateResearchFromPatients(patients, "patient_db", intent);
    navigate("/knowledge/data/clinical");
  }

  function exportSelectedRows() {
    const exportRows = selectedPatients.length ? selectedPatients : rows;
    if (!exportRows.length) {
      message.info("没有可导出的记录");
      return;
    }
    const header = ["患者ID", "姓名", "性别", "年龄", "诊断", "病理分级", "PCI", "CC评分", "治疗方式", "随访"];
    const lines = exportRows.map((r) =>
      [
        r.id,
        r.name,
        r.gender,
        r.age,
        r.diagnosis,
        r.gradeLabel || "",
        r.pciScore != null ? `${r.pciScore}/36` : "",
        r.ccScore || "",
        r.treatmentMethod || "",
        r.followUpStatus || "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = `\uFEFF${header.join(",")}\n${lines.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `患者数据库_${exportRows.length}例.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`已导出 ${exportRows.length} 例${selectedPatients.length ? "（已选）" : ""}`);
  }

  const columns: ColumnsType<PlatformPatient> = [
    { title: "患者 ID", dataIndex: "id", width: 120, fixed: "left" },
    { title: "姓名", dataIndex: "name", width: 80, fixed: "left" },
    {
      title: "基本信息",
      width: 120,
      render: (_, r) => (
        <span>
          {r.gender} · {r.age}岁
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.department}
          </Text>
        </span>
      ),
    },
    {
      title: "临床信息",
      dataIndex: "clinicalSummary",
      width: 180,
      ellipsis: true,
      render: (v: string, r) => (
        <span title={v}>
          <div>{r.diagnosis}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {v !== "—" ? v : r.chiefComplaint}
          </Text>
        </span>
      ),
    },
    {
      title: (
        <div className="pmp-grade-col-head">
          <span>病理分级</span>
          <Select
            size="small"
            value={gradeFilter}
            options={GRADE_FILTER_OPTIONS}
            onChange={setGradeFilter}
            popupMatchSelectWidth={false}
            className="pmp-grade-col-select"
          />
        </div>
      ),
      dataIndex: "gradeLabel",
      width: 100,
      render: (v: string) => gradeTag(v),
    },
    {
      title: "治疗方式",
      dataIndex: "treatmentMethod",
      width: 110,
      ellipsis: true,
      render: (v: string) => cell(v),
    },
    {
      title: "第几次手术",
      dataIndex: "surgeryNumber",
      width: 96,
      render: (v: string) => cell(v),
    },
    {
      title: "静脉化疗",
      dataIndex: "ivChemotherapy",
      width: 88,
      render: (v: string) =>
        v === "是" ? <Tag color="orange">是</Tag> : v === "否" ? <Tag>否</Tag> : "—",
    },
    {
      title: "PCI",
      dataIndex: "pciScore",
      width: 72,
      render: (v: number | null | undefined) => (v != null ? `${v}/36` : "—"),
    },
    {
      title: "CC评分",
      dataIndex: "ccScore",
      width: 80,
      render: (v: string) => cell(v),
    },
    {
      title: "影像",
      width: 140,
      render: (_, r) => (
        <span>
          <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
            {r.imagingSummary || r.modality || "—"}
          </Text>
          <Space size={4}>
            <ImagingViewButton patient={r} onView={setViewPatient} />
            {r.hasAnnotatedImage ? (
              <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                分割
              </Tag>
            ) : null}
          </Space>
        </span>
      ),
    },
    {
      title: "随访",
      dataIndex: "followUpStatus",
      width: 80,
      render: (v: string) => (v === "随访中" ? <Tag color="blue">{v}</Tag> : v || "—"),
    },
    { title: "入库", dataIndex: "enrolledAt", width: 96 },
  ];

  return (
    <div className="pmp-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8, color: "#1677ff" }} />
            患者数据库
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8, maxWidth: 720 }}>
            统一病例表：含临床、病理分级、治疗/手术、PCI·CC 评分与影像查看。流程：工作台录入 → 智能分析 →
            随访入队 → <Link to="/knowledge">科研延伸</Link>。
          </Paragraph>
        </div>
        <Space>
          <Link to="/workflow">
            <Button type="primary" icon={<ExperimentOutlined />}>
              新建分析
            </Button>
          </Link>
          <Button onClick={() => void fetchPatients()}>刷新</Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Excel 式病例总表"
        description="点击「病理分级」列头下拉筛选；「影像」列可查看 DICOM 与 AI 分割图。"
      />

      <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
        <Space wrap size="large">
          <div className="pmp-stat-inline">
            <Text type="secondary">病例总数</Text>
            <div className="pmp-stat-inline-value">{stats.total} 例</div>
          </div>
          <div className="pmp-stat-inline">
            <Text type="secondary">高级别</Text>
            <div className="pmp-stat-inline-value" style={{ color: "#cf1322" }}>
              {stats.high} 例
            </div>
          </div>
          <div className="pmp-stat-inline">
            <Text type="secondary">低级别</Text>
            <div className="pmp-stat-inline-value" style={{ color: "#389e0d" }}>
              {stats.low} 例
            </div>
          </div>
          <div className="pmp-stat-inline">
            <Text type="secondary">随访中</Text>
            <div className="pmp-stat-inline-value">{stats.follow} 例</div>
          </div>
        </Space>
      </div>

      <div className="pmp-card" style={{ padding: 16 }}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索 ID / 姓名 / 诊断 / 治疗方式 / PCI…"
            allowClear
            style={{ width: 320 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            value={followUpOnly ? "follow" : "all"}
            style={{ width: 140 }}
            onChange={(v) => setFollowUpOnly(v === "follow")}
            options={[
              { value: "all", label: "全部患者" },
              { value: "follow", label: "仅随访队列" },
            ]}
          />
          <Button icon={<DatabaseOutlined />} onClick={exportSelectedRows}>
            批量导出
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: "radiomics",
                  label: (
                    <div>
                      <div>提取组学</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                        跳转至影像数据智能分析，基于标注图建模
                      </div>
                    </div>
                  ),
                  onClick: () => runBatchOperation("radiomics"),
                },
                {
                  key: "clinical",
                  label: (
                    <div>
                      <div>临床及病理数据分析</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                        面向临床、病理、随访等结构化数据，用于病理分级相关因素、生存分析、预后模型等任务
                      </div>
                    </div>
                  ),
                  onClick: () => runBatchOperation("clinical"),
                },
              ],
            }}
          >
            <Button>
              批量操作 <DownOutlined />
            </Button>
          </Dropdown>
          {selectedRowKeys.length ? (
            <Tag color="blue">已选 {selectedRowKeys.length} 例</Tag>
          ) : null}
        </Space>

        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spin />
          </div>
        ) : (
          <Table
            size="small"
            rowKey="id"
            rowSelection={rowSelection}
            dataSource={rows}
            columns={columns}
            scroll={{ x: 1500 }}
            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50"] }}
          />
        )}
      </div>

      <PatientImagingModal open={Boolean(viewPatient)} patient={viewPatient} onClose={() => setViewPatient(null)} />
    </div>
  );
}
