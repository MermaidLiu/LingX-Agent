import {
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  FileOutlined,
  FolderOpenOutlined,
  MoreOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  PushpinOutlined,
  ReloadOutlined,
  RobotOutlined,
  ShareAltOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tabs, Tag, Timeline, Typography } from "antd";
import { useMemo, useState } from "react";
import {
  MOCK_ATTACHMENTS,
  MOCK_DIAGNOSIS,
  MOCK_INDICATORS,
  MOCK_TIMELINE,
  type PlatformPatient,
} from "../../data/platformMock";
import { createEmptyPatient, loadPatients, savePatients } from "../../lib/platformPatients";

const { Text, Paragraph, Title } = Typography;

function PatientEditModal({
  open,
  patient,
  onCancel,
  onSave,
}: {
  open: boolean;
  patient: PlatformPatient | null;
  onCancel: () => void;
  onSave: (p: PlatformPatient) => void;
}) {
  const [form] = Form.useForm<PlatformPatient>();

  return (
    <Modal
      title={patient ? "编辑患者" : "新建患者"}
      open={open}
      onCancel={onCancel}
      onOk={() => {
        form.validateFields().then((values) => {
          onSave({ ...(patient || createEmptyPatient()), ...values });
          onCancel();
        });
      }}
      okText="保存"
      cancelText="取消"
      width={560}
      destroyOnClose
      afterOpenChange={(visible) => {
        if (visible && patient) form.setFieldsValue(patient);
        if (visible && !patient) form.setFieldsValue(createEmptyPatient());
      }}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item name="id" label="患者 ID" rules={[{ required: true }]}>
          <Input placeholder="PMP00012345" />
        </Form.Item>
        <Space style={{ width: "100%" }} size={12}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="gender" label="性别" style={{ width: 100 }}>
            <Select options={[{ value: "男", label: "男" }, { value: "女", label: "女" }]} />
          </Form.Item>
          <Form.Item name="age" label="年龄" style={{ width: 88 }}>
            <InputNumber min={0} max={120} style={{ width: "100%" }} />
          </Form.Item>
        </Space>
        <Form.Item name="diagnosis" label="临床诊断" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Space style={{ width: "100%" }} size={12}>
          <Form.Item name="stage" label="分期" style={{ flex: 1 }}>
            <Input placeholder="IIB期" />
          </Form.Item>
          <Form.Item name="gene" label="基因" style={{ flex: 1 }}>
            <Input placeholder="EGFR+" />
          </Form.Item>
        </Space>
        <Form.Item name="department" label="科室">
          <Input />
        </Form.Item>
        <Form.Item name="physician" label="主治医师">
          <Input />
        </Form.Item>
        <Form.Item name="chiefComplaint" label="主诉">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="enrolledAt" label="入组日期">
          <Input placeholder="2024-05-20" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function PatientList({
  patients,
  activeId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
}: {
  patients: PlatformPatient[];
  activeId: string;
  onSelect: (p: PlatformPatient) => void;
  onAdd: () => void;
  onEdit: (p: PlatformPatient) => void;
  onDelete: (id: string) => void;
}) {
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return patients;
    return patients.filter(
      (p) =>
        p.id.toLowerCase().includes(k) ||
        p.name.toLowerCase().includes(k) ||
        p.diagnosis.toLowerCase().includes(k),
    );
  }, [patients, keyword]);

  return (
    <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>
          患者列表
        </Title>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAdd}>
          新建
        </Button>
      </div>
      <Input.Search
        placeholder="搜索 ID / 姓名 / 病种"
        style={{ marginBottom: 12 }}
        allowClear
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        {filtered.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            无匹配患者，点击「新建」添加
          </Text>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              className={`pmp-patient-card${p.id === activeId ? " pmp-patient-card--active" : ""}`}
              onClick={() => onSelect(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelect(p)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.id}</div>
                <Space size={4} onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => onEdit(p)}
                    aria-label="编辑"
                  />
                  <Popconfirm title="确定删除该患者？" onConfirm={() => onDelete(p.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="删除" />
                  </Popconfirm>
                </Space>
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {p.name} · {p.gender} · {p.age}岁
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{p.diagnosis}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>入组 {p.enrolledAt}</div>
            </div>
          ))
        )}
      </div>
      <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>
        共 {patients.length} 例 · 编辑后自动保存
      </Text>
    </div>
  );
}

function ChatPanel({ patient, inFollowUp, onJoinFollowUp }: { patient: PlatformPatient; inFollowUp: boolean; onJoinFollowUp: () => void }) {
  return (
    <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          对话：{patient.diagnosis}病例分析
        </Title>
        <Space>
          <EditOutlined style={{ color: "#9ca3af", cursor: "pointer" }} />
          <PushpinOutlined style={{ color: "#9ca3af", cursor: "pointer" }} />
          <ShareAltOutlined style={{ color: "#9ca3af", cursor: "pointer" }} />
          <MoreOutlined style={{ color: "#9ca3af", cursor: "pointer" }} />
        </Space>
      </div>

      <div style={{ flex: 1, overflow: "auto", paddingRight: 4 }}>
        <div className="pmp-chat-user">
          <Text type="secondary" style={{ fontSize: 12 }}>
            您 · 刚刚
          </Text>
          <Paragraph style={{ margin: "8px 0 0" }}>
            请导入该患者多模态数据，基于影像与临床信息给出诊断结论和治疗建议。
          </Paragraph>
          <div className="pmp-file-grid">
            {MOCK_ATTACHMENTS.map((f) => (
              <div key={f.name} className="pmp-file-thumb">
                <div className="pmp-file-thumb-icon">{f.icon}</div>
                {f.name}
              </div>
            ))}
          </div>
        </div>

        <div className="pmp-chat-ai">
          <Space style={{ marginBottom: 12 }}>
            <RobotOutlined style={{ color: "#1677ff", fontSize: 18 }} />
            <Text strong>PMP 智能体</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              已导入 {patient.id} 数据
            </Text>
          </Space>

          <Paragraph style={{ marginBottom: 12 }}>
            <Text strong>诊断结论：</Text>
            {MOCK_DIAGNOSIS.title}
            <Tag color="blue" style={{ marginLeft: 8 }}>
              置信度 {(MOCK_DIAGNOSIS.confidence * 100).toFixed(0)}%
            </Tag>
            <Tag>{MOCK_DIAGNOSIS.staging}</Tag>
          </Paragraph>

          <Paragraph style={{ marginBottom: 8 }}>
            <Text strong>关键依据：</Text>
          </Paragraph>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
            {MOCK_DIAGNOSIS.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>

          <Paragraph style={{ marginBottom: 8 }}>
            <Text strong>治疗建议：</Text>
          </Paragraph>
          <ol style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
            {MOCK_DIAGNOSIS.treatments.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>

          <Space wrap>
            <Button icon={<ReloadOutlined />}>重新分析</Button>
            <Button icon={<FileOutlined />}>生成报告</Button>
            <Button type="primary" icon={<TeamOutlined />} disabled={inFollowUp} onClick={onJoinFollowUp}>
              {inFollowUp ? "已在随访队列" : "加入随访队列"}
            </Button>
            <Button>更多操作</Button>
          </Space>
        </div>

        <Space wrap style={{ marginTop: 16 }}>
          {["预后如何？", "是否需要新辅助？", "靶向方案选择？", "MDT 建议？"].map((q) => (
            <Button key={q} size="small">
              {q}
            </Button>
          ))}
        </Space>
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid #e8edf5", paddingTop: 12 }}>
        <Input.TextArea
          rows={2}
          placeholder="输入您的问题，如：该患者预后如何？"
          style={{ marginBottom: 8 }}
        />
        <Space>
          <Button type="text" icon={<PaperClipOutlined />} />
          <Button type="text" icon={<PictureOutlined />} />
          <Button type="text" icon={<FolderOpenOutlined />} />
          <Button type="primary" style={{ marginLeft: "auto" }}>
            发送
          </Button>
        </Space>
      </div>
    </div>
  );
}

function ProfilePanel({
  patient,
  inFollowUp,
  onJoinFollowUp,
  onEdit,
  onDelete,
}: {
  patient: PlatformPatient;
  inFollowUp: boolean;
  onJoinFollowUp: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ padding: 16, height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>
            {patient.name}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {patient.gender} · {patient.age}岁 · {patient.id}
          </Text>
        </div>
        <Button type="link" size="small" onClick={onEdit}>
          编辑资料
        </Button>
      </div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Tag color="red">{patient.diagnosis}</Tag>
        <Tag>{patient.stage}</Tag>
        <Tag color="blue">{patient.gene}</Tag>
      </Space>

      <Tabs
        size="small"
        items={[
          {
            key: "overview",
            label: "概览",
            children: (
              <div>
                <Paragraph style={{ fontSize: 13, marginBottom: 12 }}>
                  <Text type="secondary">入院：</Text>
                  {patient.admissionTime}
                  <br />
                  <Text type="secondary">主治：</Text>
                  {patient.physician}
                  <br />
                  <Text type="secondary">吸烟：</Text>
                  {patient.smoking}
                  <br />
                  <Text type="secondary">ECOG：</Text>
                  {patient.ecog}
                </Paragraph>

                <div className="pmp-panel-title">诊疗时间线</div>
                <Timeline
                  items={MOCK_TIMELINE.map((t) => ({
                    dot: <div className="pmp-timeline-dot" />,
                    children: (
                      <span style={{ fontSize: 12 }}>
                        <Text strong>{t.date}</Text> {t.event}
                      </span>
                    ),
                  }))}
                />

                <div className="pmp-panel-title" style={{ marginTop: 16 }}>
                  关键指标趋势
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {MOCK_INDICATORS.map((ind) => (
                    <div key={ind.name} className="pmp-card" style={{ padding: 8 }}>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {ind.name} {ind.trend}
                      </div>
                      <div className="pmp-sparkline" />
                    </div>
                  ))}
                </div>

                <div className="pmp-panel-title">影像预览</div>
                <Space wrap>
                  {["CT", "PET-CT", "病理"].map((t) => (
                    <div key={t} className="pmp-data-thumb">
                      <span style={{ fontSize: 20 }}>🩻</span>
                      {t}
                    </div>
                  ))}
                </Space>
              </div>
            ),
          },
          { key: "imaging", label: "影像", children: <Text type="secondary">影像数据预览（演示）</Text> },
          { key: "pathology", label: "病理", children: <Text type="secondary">病理切片预览（演示）</Text> },
          { key: "genetics", label: "基因", children: <Text type="secondary">EGFR 19del 阳性（演示）</Text> },
          { key: "clinical", label: "临床", children: <Text type="secondary">{patient.chiefComplaint}</Text> },
          { key: "followup", label: "随访", children: <Text type="secondary">{inFollowUp ? "已加入随访队列" : "未入队"}</Text> },
        ]}
      />

      <Space direction="vertical" style={{ width: "100%", marginTop: 16 }}>
        <Button block icon={<ExportOutlined />}>
          导出病例报告
        </Button>
        <Button block type="primary" icon={<TeamOutlined />} disabled={inFollowUp} onClick={onJoinFollowUp}>
          {inFollowUp ? "已在随访队列" : "加入随访队列"}
        </Button>
        <Button block danger icon={<DeleteOutlined />} onClick={onDelete}>
          删除患者
        </Button>
      </Space>
    </div>
  );
}

export default function PlatformChatPage() {
  const { message, modal } = App.useApp();
  const [patients, setPatients] = useState<PlatformPatient[]>(() => loadPatients());
  const [active, setActive] = useState<PlatformPatient>(() => loadPatients()[0]);
  const [followUpIds, setFollowUpIds] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<PlatformPatient | null | undefined>(undefined);

  function persist(next: PlatformPatient[], nextActive?: PlatformPatient) {
    setPatients(next);
    savePatients(next);
    if (nextActive) setActive(nextActive);
  }

  function joinFollowUp() {
    setFollowUpIds((prev) => new Set(prev).add(active.id));
    message.success(`${active.name} 已加入随访队列`);
  }

  function handleSavePatient(p: PlatformPatient) {
    const isNew = editTarget === null;
    const oldId = editTarget?.id;

    if (patients.some((x) => x.id === p.id && x.id !== oldId)) {
      message.error("患者 ID 已存在");
      return;
    }

    if (isNew) {
      persist([p, ...patients], p);
    } else if (oldId) {
      persist(
        patients.map((x) => (x.id === oldId ? p : x)),
        p,
      );
    }
    message.success("患者信息已保存");
  }

  function handleDelete(id: string) {
    if (patients.length <= 1) {
      message.warning("至少保留一名患者");
      return;
    }
    modal.confirm({
      title: "删除患者",
      content: "确定从列表中删除该患者？",
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        const next = patients.filter((p) => p.id !== id);
        persist(next, next[0]);
        setFollowUpIds((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
        message.success("已删除");
      },
    });
  }

  return (
    <>
      <PatientEditModal
        open={editTarget !== undefined}
        patient={editTarget || null}
        onCancel={() => setEditTarget(undefined)}
        onSave={handleSavePatient}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 320px",
          height: "calc(100vh - 56px)",
          gap: 0,
        }}
      >
        <div className="pmp-card" style={{ borderRadius: 0, borderTop: "none", borderLeft: "none" }}>
          <PatientList
            patients={patients}
            activeId={active.id}
            onSelect={setActive}
            onAdd={() => setEditTarget(null)}
            onEdit={(p) => setEditTarget(p)}
            onDelete={handleDelete}
          />
        </div>
        <div className="pmp-card" style={{ borderRadius: 0, borderTop: "none", borderLeft: "none" }}>
          <ChatPanel patient={active} inFollowUp={followUpIds.has(active.id)} onJoinFollowUp={joinFollowUp} />
        </div>
        <div className="pmp-card" style={{ borderRadius: 0, borderTop: "none", borderRight: "none" }}>
          <ProfilePanel
            patient={active}
            inFollowUp={followUpIds.has(active.id)}
            onJoinFollowUp={joinFollowUp}
            onEdit={() => setEditTarget(active)}
            onDelete={() => handleDelete(active.id)}
          />
        </div>
      </div>
    </>
  );
}
