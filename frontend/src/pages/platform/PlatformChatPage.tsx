import {
  DatabaseOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileZipOutlined,
  RobotOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { App, Button, Spin, Tag, Typography, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { platformChatAnalyze, platformChatSave } from "../../api/platform";
import AnalysisIntentPanel, { type AnalysisIntent } from "../../components/platform/AnalysisIntentPanel";
import { markSaved, loadPlatformSession, setAnalysisResult } from "../../lib/platformSession";

const { Text, Paragraph } = Typography;

const ACCEPT = ".xlsx,.xls,.csv,.zip,.pdf,.doc,.docx,.json,.dcm,.dicom";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string; icon: React.ReactNode }[];
  analysisDone?: boolean;
  gradeImage?: string;
};

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return <FileZipOutlined />;
  if (lower.endsWith(".pdf")) return <FilePdfOutlined />;
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return <FileWordOutlined />;
  return <FileExcelOutlined />;
}

function formatDiagnosisReply(
  diagnosis: {
    title: string;
    confidence: number;
    staging: string;
    evidence: string[];
    probabilities: { label: string; pct: number }[];
  },
  intentQuestion: string,
  extraNotes: string[],
) {
  return [
    `**首要怀疑：** ${diagnosis.title}`,
    `置信度 ${(diagnosis.confidence * 100).toFixed(0)}% · ${diagnosis.staging}`,
    "",
    "**鉴别诊断：**",
    ...diagnosis.probabilities.map((p) => `• ${p.label}（${p.pct}%）`),
    "",
    "**支持依据：**",
    ...diagnosis.evidence.map((e) => `• ${e}`),
    ...extraNotes.map((n) => `\n> ${n}`),
    "",
    intentQuestion ? `**按您的分析需求：** ${intentQuestion}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const DEFAULT_INTENT: AnalysisIntent = {
  question: "请基于上传的多模态数据，给出怀疑疾病及鉴别诊断。",
  variables: "影像征象、病理描述、肿瘤标志物、临床分期",
  outcome: "grade",
  notes: "",
};

export default function PlatformChatPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [intent, setIntent] = useState<AnalysisIntent>(DEFAULT_INTENT);
  const [loading, setLoading] = useState(false);
  const [savedToDb, setSavedToDb] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "您好，我是 PMP 智能助手。请上传 Excel、ZIP、PDF 或 Word 文件，并在下方填写分析需求，我将进行多模态智能分析；分析完成后可一键加入数据库。",
    },
  ]);

  function scrollBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text && files.length === 0) {
      message.warning("请输入问题或上传文件");
      return;
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text || intent.question,
      files: files.map((f) => ({ name: f.name, icon: fileIcon(f.name) })),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const uploadFiles = files.map((f) => f as unknown as File);
    setFiles([]);
    setLoading(true);
    setSavedToDb(false);
    scrollBottom();

    try {
      const mergedIntent = { ...intent, question: text || intent.question };
      const result = await platformChatAnalyze(uploadFiles, mergedIntent);
      setAnalysisResult(result);

      const extraNotes: string[] = [];
      if (result.pathology_imaging_status) {
        extraNotes.push(result.pathology_imaging_status);
      }
      if (result.ingest_notes.length) {
        extraNotes.push(...result.ingest_notes.slice(0, 2));
      }

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        analysisDone: true,
        content: formatDiagnosisReply(result.diagnosis, mergedIntent.question, extraNotes),
        gradeImage: result.pathology_imaging?.result_image_base64 || undefined,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "分析失败，请检查后端服务是否启动");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "分析请求失败。请确认后端已启动（`uvicorn app.main:app`），并重试。",
        },
      ]);
    } finally {
      setLoading(false);
      scrollBottom();
    }
  }

  async function joinDatabase() {
    try {
      const session = loadPlatformSession();
      if (!session.record) {
        message.warning("暂无分析结果可入库");
        return;
      }
      const res = await platformChatSave(session.record);
      markSaved(res.exam_id);
      setSavedToDb(true);
      message.success("分析结果已加入患者数据库");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "入库失败");
    }
  }

  return (
    <div className="pmp-gpt-page">
      <div className="pmp-gpt-main">
        <div className="pmp-gpt-messages">
          {messages.map((m) => (
            <div key={m.id} className={`pmp-gpt-msg pmp-gpt-msg--${m.role}`}>
              {m.role === "assistant" ? (
                <div className="pmp-gpt-avatar">
                  <RobotOutlined />
                </div>
              ) : null}
              <div className="pmp-gpt-bubble">
                {m.role === "assistant" && m.id !== "welcome" ? (
                  <Text strong style={{ display: "block", marginBottom: 8 }}>
                    PMP 智能体
                  </Text>
                ) : null}
                {m.files?.length ? (
                  <div className="pmp-file-grid" style={{ marginBottom: 10 }}>
                    {m.files.map((f) => (
                      <div key={f.name} className="pmp-file-thumb">
                        <div className="pmp-file-thumb-icon">{f.icon}</div>
                        {f.name}
                      </div>
                    ))}
                  </div>
                ) : null}
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</Paragraph>
                {m.gradeImage ? (
                  <img
                    src={`data:image/png;base64,${m.gradeImage}`}
                    alt="病理分级结果"
                    style={{ maxWidth: "100%", marginTop: 12, borderRadius: 8, border: "1px solid #e8edf5" }}
                  />
                ) : null}
                {m.analysisDone ? (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e8edf5" }}>
                    <Tag color="green">分析完成</Tag>
                    <Button
                      type="primary"
                      icon={<DatabaseOutlined />}
                      disabled={savedToDb}
                      style={{ marginLeft: 8 }}
                      onClick={joinDatabase}
                    >
                      {savedToDb ? "已加入数据库" : "加入数据库"}
                    </Button>
                    <Button style={{ marginLeft: 8 }} onClick={() => nav("/analysis")}>
                      查看诊断分析
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="pmp-gpt-msg pmp-gpt-msg--assistant">
              <div className="pmp-gpt-avatar">
                <RobotOutlined />
              </div>
              <div className="pmp-gpt-bubble">
                <Spin size="small" /> <Text type="secondary"> 正在分析多模态数据…</Text>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="pmp-gpt-composer-wrap">
          <AnalysisIntentPanel value={intent} onChange={setIntent} compact />

          {files.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {files.map((f) => (
                <Tag key={f.uid} closable onClose={() => setFiles((prev) => prev.filter((x) => x.uid !== f.uid))}>
                  {fileIcon(f.name)} {f.name}
                </Tag>
              ))}
            </div>
          ) : null}

          <div className="pmp-gpt-composer">
            <Upload
              multiple
              showUploadList={false}
              accept={ACCEPT}
              beforeUpload={(file) => {
                setFiles((prev) => [...prev, file as UploadFile]);
                return false;
              }}
            >
              <Button type="text" title="上传 Excel / ZIP / PDF / Word">
                📎
              </Button>
            </Upload>
            <textarea
              className="pmp-gpt-input"
              rows={2}
              placeholder="输入问题，或描述需要分析的内容…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={handleSend}>
              分析
            </Button>
          </div>
          <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 8, textAlign: "center" }}>
            支持 Excel · ZIP · PDF · Word · 分析完成后入库
          </Text>
        </div>
      </div>
    </div>
  );
}
