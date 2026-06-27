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
import AnalysisIntentPanel, { type AnalysisIntent } from "../../components/platform/AnalysisIntentPanel";
import { MOCK_DIAGNOSIS } from "../../data/platformMock";

const { Text, Paragraph } = Typography;

const ACCEPT = ".xlsx,.xls,.csv,.zip,.pdf,.doc,.docx";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string; icon: React.ReactNode }[];
  analysisDone?: boolean;
};

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return <FileZipOutlined />;
  if (lower.endsWith(".pdf")) return <FilePdfOutlined />;
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return <FileWordOutlined />;
  return <FileExcelOutlined />;
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

  function handleSend() {
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
    setFiles([]);
    setLoading(true);
    setSavedToDb(false);
    scrollBottom();

    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        analysisDone: true,
        content: [
          `**首要怀疑：** ${MOCK_DIAGNOSIS.title}`,
          `置信度 ${(MOCK_DIAGNOSIS.confidence * 100).toFixed(0)}% · ${MOCK_DIAGNOSIS.staging}`,
          "",
          "**鉴别诊断：**",
          ...MOCK_DIAGNOSIS.probabilities.map((p) => `• ${p.label}（${p.pct}%）`),
          "",
          "**支持依据：**",
          ...MOCK_DIAGNOSIS.evidence.map((e) => `• ${e}`),
          "",
          intent.question ? `**按您的分析需求：** ${intent.question}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setLoading(false);
      scrollBottom();
    }, 1200);
  }

  function joinDatabase() {
    setSavedToDb(true);
    message.success("分析结果已加入患者数据库");
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
