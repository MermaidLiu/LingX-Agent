import { ArrowLeftOutlined, ExportOutlined, FileTextOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Checkbox, Input, Space, Table, Tag, Typography, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ModuleAnalysisResult, ResearchResultRow, ResearchTask } from "../../data/researchWorkbenchMock";
import { platformResearchGradeRun, platformRunResearch } from "../../api/platform";
import { saveModuleResult } from "../../lib/researchModuleResults";

const { Title, Text, Paragraph } = Typography;

type Props = {
  moduleKey: "clinical" | "imaging" | "multimodal";
  title: string;
  subtitle: string;
  badge: string;
  theme: "navy" | "cyan" | "purple";
  dataTitle: string;
  fields: string[];
  tasks: ResearchTask[];
  methods: string[];
  resultMap: Record<string, ResearchResultRow[]>;
  stats: { label: string; value: string }[];
  outputs: string[];
  followUps: string[];
  extraCenter?: ReactNode;
  linkedBanner?: ReactNode;
};

const GRADE_TASKS = new Set(["grade-pred", "grade-subtype"]);

const THEME = {
  navy: { accent: "#1e3a5f", light: "#eef4fb", tag: "blue" },
  cyan: { accent: "#0891b2", light: "#ecfeff", tag: "cyan" },
  purple: { accent: "#7c3aed", light: "#f5f3ff", tag: "purple" },
};

function BarChart({ rows }: { rows: ResearchResultRow[] }) {
  const max = Math.max(...rows.map((r) => r.weight ?? 0), 1);
  return (
    <div style={{ marginTop: 12 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        因素 / 特征贡献
      </Text>
      {rows.map((r) => (
        <div key={r.factor} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span>{r.factor}</span>
            <span>{r.weight ?? "—"}</span>
          </div>
          <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, marginTop: 4 }}>
            <div
              style={{
                width: `${((r.weight ?? 0) / max) * 100}%`,
                height: "100%",
                background: "#1677ff",
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ResearchWorkbench({
  moduleKey,
  title,
  subtitle,
  badge,
  theme,
  dataTitle,
  fields,
  tasks,
  methods,
  resultMap,
  stats,
  outputs,
  followUps,
  extraCenter,
  linkedBanner,
}: Props) {
  const { message } = App.useApp();
  const colors = THEME[theme];
  const [selectedFields, setSelectedFields] = useState<string[]>(fields.slice(0, 6));
  const [taskId, setTaskId] = useState(tasks[0].id);
  const [inclusion, setInclusion] = useState("");
  const [exclusion, setExclusion] = useState("");
  const [outcome, setOutcome] = useState("");
  const [split, setSplit] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ResearchResultRow[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [dicomFiles, setDicomFiles] = useState<UploadFile[]>([]);
  const [gradeImage, setGradeImage] = useState<string | null>(null);

  const task = tasks.find((t) => t.id === taskId) ?? tasks[0];
  const isGradeTask = GRADE_TASKS.has(taskId);
  const previewRows = result ?? resultMap[taskId] ?? [];

  const toggleField = (f: string) => {
    setSelectedFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  async function runAnalysis() {
    setRunning(true);
    setSaved(false);
    setGradeImage(null);
    try {
      let res;
      if (isGradeTask) {
        if (dicomFiles.length === 0) {
          message.warning("请先上传 DICOM 文件（.dcm / .dicom 或 ZIP）");
          setRunning(false);
          return;
        }
        res = await platformResearchGradeRun(
          dicomFiles.map((f) => f as unknown as File),
          moduleKey,
          taskId,
        );
      } else {
        res = await platformRunResearch({
          module: moduleKey,
          task_id: taskId,
          fields: selectedFields,
          inclusion,
          exclusion,
          outcome,
          split,
        });
      }
      if (res.pathology_imaging_pending) {
        message.warning(res.summary);
      }
      const rows = res.rows as ResearchResultRow[];
      setResult(rows);
      if (res.pathology_imaging?.result_image_base64) {
        setGradeImage(res.pathology_imaging.result_image_base64);
      }
      const payload: ModuleAnalysisResult = {
        module: moduleKey,
        taskId,
        taskTitle: res.task_title,
        ranAt: new Date().toISOString(),
        rows,
        summary: res.summary,
        auc: res.auc,
        cIndex: res.c_index,
      };
      saveModuleResult(payload);
      setSaved(true);
      message.success(`${res.task_title} 分析完成，结果已保存`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "分析失败");
      const rows = resultMap[taskId] ?? [];
      setResult(rows);
    } finally {
      setRunning(false);
    }
  }

  const outputChecks = useMemo(() => outputs.map((o) => ({ label: o, checked: Boolean(result) })), [outputs, result]);

  return (
    <div className="pmp-research-wb">
      <div className="pmp-research-wb-header" style={{ borderLeftColor: colors.accent }}>
        <div>
          <Link to="/knowledge/data">
            <Button type="text" icon={<ArrowLeftOutlined />} size="small">
              返回模块选择
            </Button>
          </Link>
          <Title level={4} style={{ margin: "8px 0 4px" }}>
            {title}
          </Title>
          <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
            {subtitle}
          </Paragraph>
          <Space style={{ marginTop: 8 }}>
            <Tag color="green">已连接：多模态科研数据库</Tag>
            <Tag color={colors.tag as "blue"}>{badge}</Tag>
          </Space>
        </div>
        <Space>
          <Button icon={<FileTextOutlined />}>生成报告</Button>
          <Button type="primary" icon={<ExportOutlined />}>
            导出
          </Button>
        </Space>
      </div>

      {linkedBanner}

      <div className="pmp-research-wb-grid">
        {/* 左：数据与队列 */}
        <div className="pmp-card pmp-research-wb-col">
          <div className="pmp-panel-title">{dataTitle}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            数据字段（点击选择）
          </Text>
          <div className="pmp-field-tags" style={{ marginTop: 8, marginBottom: 16 }}>
            {fields.map((f) => (
              <Tag
                key={f}
                color={selectedFields.includes(f) ? colors.tag : "default"}
                style={{ cursor: "pointer", marginBottom: 6 }}
                onClick={() => toggleField(f)}
              >
                {f}
              </Tag>
            ))}
          </div>
          <div className="pmp-panel-title">队列筛选</div>
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            <Input placeholder="纳入标准" value={inclusion} onChange={(e) => setInclusion(e.target.value)} />
            <Input placeholder="排除标准" value={exclusion} onChange={(e) => setExclusion(e.target.value)} />
            <Input placeholder="结局定义" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
            <Input placeholder="训练 / 验证集" value={split} onChange={(e) => setSplit(e.target.value)} />
          </Space>
          <Space style={{ marginTop: 12 }}>
            <Button size="small">+ 添加字段</Button>
            <Button size="small">数据质控</Button>
          </Space>
        </div>

        {/* 中：任务与结果 */}
        <div className="pmp-card pmp-research-wb-col pmp-research-wb-col--main">
          <div className="pmp-panel-title">选择分析任务</div>
          <div className="pmp-task-grid">
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`pmp-task-card${taskId === t.id ? " pmp-task-card--active" : ""}`}
                style={taskId === t.id ? { borderColor: colors.accent, background: colors.light } : undefined}
                onClick={() => {
                  setTaskId(t.id);
                  setResult(null);
                  setSaved(false);
                  setGradeImage(null);
                  setDicomFiles([]);
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          <div style={{ margin: "16px 0" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              智能体推荐方法
            </Text>
            <div style={{ marginTop: 6 }}>
              {methods.map((m) => (
                <Tag key={m} style={{ marginBottom: 4 }}>
                  {m}
                </Tag>
              ))}
            </div>
          </div>

          {extraCenter}

          {isGradeTask ? (
            <div style={{ marginBottom: 16, padding: 12, background: colors.light, borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                上传 DICOM 调用病理分级模型（支持 .dcm / .dicom / ZIP）
              </Text>
              <Upload
                multiple
                accept=".dcm,.dicom,.zip"
                showUploadList
                fileList={dicomFiles}
                beforeUpload={(file) => {
                  setDicomFiles((prev) => [...prev, file as UploadFile]);
                  return false;
                }}
                onRemove={(file) => setDicomFiles((prev) => prev.filter((f) => f.uid !== file.uid))}
              >
                <Button icon={<UploadOutlined />}>选择 DICOM 文件</Button>
              </Upload>
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div className="pmp-panel-title" style={{ margin: 0 }}>
              分析结果{result ? "（已运行）" : "（预览）"}
            </div>
            <Button type="primary" loading={running} onClick={runAnalysis}>
              运行分析
            </Button>
          </div>

          <Table
            size="small"
            pagination={false}
            rowKey="factor"
            dataSource={previewRows}
            columns={[
              { title: "因素 / 特征", dataIndex: "factor" },
              { title: "OR / HR / AUC", dataIndex: "metric", width: 120 },
              { title: "P 值", dataIndex: "pValue", width: 72 },
              { title: "解释", dataIndex: "note", ellipsis: true },
            ]}
          />
          <BarChart rows={previewRows} />
          {gradeImage ? (
            <img
              src={`data:image/png;base64,${gradeImage}`}
              alt="病理分级可视化"
              style={{ maxWidth: "100%", marginTop: 12, borderRadius: 8, border: "1px solid #e8edf5" }}
            />
          ) : null}
          {saved ? (
            <Tag color="green" style={{ marginTop: 12 }}>
              结果已保存，多模态模块可关联引用
            </Tag>
          ) : null}
        </div>

        {/* 右：输出与追问 */}
        <div className="pmp-card pmp-research-wb-col">
          <div className="pmp-panel-title">结果与输出</div>
          <div className="pmp-wb-stats">
            {stats.map((s) => (
              <div key={s.label} className="pmp-wb-stat">
                <div className="pmp-wb-stat-value">{s.value}</div>
                <div className="pmp-wb-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="pmp-panel-title" style={{ marginTop: 16 }}>
            可生成成果
          </div>
          <Space direction="vertical" style={{ width: "100%" }}>
            {outputChecks.map((o) => (
              <Checkbox key={o.label} checked={o.checked} disabled={!o.checked}>
                {o.label}
              </Checkbox>
            ))}
          </Space>
          <div className="pmp-panel-title" style={{ marginTop: 16 }}>
            推荐追问
          </div>
          <Space direction="vertical" style={{ width: "100%" }}>
            {followUps.map((q) => (
              <Button key={q} block size="small" style={{ textAlign: "left", height: "auto", whiteSpace: "normal" }}>
                {q}
              </Button>
            ))}
          </Space>
        </div>
      </div>
    </div>
  );
}
