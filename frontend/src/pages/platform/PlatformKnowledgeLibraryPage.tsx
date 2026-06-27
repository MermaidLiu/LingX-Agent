import {
  ArrowLeftOutlined,
  BookOutlined,
  ExportOutlined,
  FilePptOutlined,
  FileTextOutlined,
  FundOutlined,
  PlusOutlined,
  ReadOutlined,
  RobotOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { App, Button, Input, Modal, Space, Table, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DEFAULT_KNOWLEDGE_QUERY,
  GENERATION_MODULES,
  KNOWLEDGE_SOURCES,
  MOCK_ANSWER_POINTS,
  MOCK_GRANT_DRAFT,
  MOCK_KNOWLEDGE_LITERATURE,
  MOCK_PAPER_DRAFT,
  type KnowledgeLiterature,
} from "../../data/knowledgeLibraryMock";
import { MOCK_PPT_SLIDES, MOCK_REVIEW_OUTLINE } from "../../data/researchMock";

const { Title, Text, Paragraph } = Typography;

const GEN_ICONS: Record<string, ReactNode> = {
  review: <BookOutlined />,
  paper: <FileTextOutlined />,
  grant: <FundOutlined />,
  ppt: <FilePptOutlined />,
};

function sourceColor(source: KnowledgeLiterature["source"]) {
  const map: Record<string, string> = {
    PubMed: "blue",
    综述: "purple",
    "指南/共识": "green",
    内部文献: "orange",
    专病库: "cyan",
  };
  return map[source] ?? "default";
}

export default function PlatformKnowledgeLibraryPage() {
  const { message } = App.useApp();
  const [query, setQuery] = useState(DEFAULT_KNOWLEDGE_QUERY);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [genModal, setGenModal] = useState<{ key: string; title: string } | null>(null);
  const [genContent, setGenContent] = useState("");
  const [highlightRef, setHighlightRef] = useState<number | null>(null);

  const literature = useMemo(() => {
    if (!searched) return [];
    return [...MOCK_KNOWLEDGE_LITERATURE].sort((a, b) => b.relevance - a.relevance);
  }, [searched]);

  const stats = useMemo(() => {
    if (!searched) {
      return { hit: 0, reviews: 0, guidelines: 0, selected: 0 };
    }
    return {
      hit: 126,
      reviews: literature.filter((l) => l.source === "综述").length + 6,
      guidelines: literature.filter((l) => l.source === "指南/共识").length + 1,
      selected: selectedIds.length,
    };
  }, [literature, selectedIds, searched]);

  function startSearch() {
    if (!query.trim()) {
      message.warning("请输入科研问题");
      return;
    }
    setLoading(true);
    setSearched(false);
    setSelectedIds([]);
    setHighlightRef(null);
    setTimeout(() => {
      setSearched(true);
      setSelectedIds(MOCK_KNOWLEDGE_LITERATURE.slice(0, 5).map((l) => l.id));
      setLoading(false);
      message.success("检索完成，已生成回答摘要与可查实文献");
    }, 1000);
  }

  function resetSession() {
    setSearched(false);
    setSelectedIds([]);
    setQuery(DEFAULT_KNOWLEDGE_QUERY);
    setGenModal(null);
    setHighlightRef(null);
  }

  function scrollToRef(refNum: number) {
    setHighlightRef(refNum);
    const row = document.getElementById(`lit-row-${refNum}`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function openGenerate(key: string, title: string) {
    if (!searched) {
      message.info("请先完成检索");
      return;
    }
    if (selectedIds.length === 0) {
      message.warning("请至少选择一篇文献作为证据");
      return;
    }
    const n = selectedIds.length;
    const drafts: Record<string, string> = {
      review: MOCK_REVIEW_OUTLINE.replace("影像代谢与病理分级的关联研究", query.slice(0, 30)) + `\n\n> 基于已选 ${n} 篇文献`,
      paper: MOCK_PAPER_DRAFT + `\n\n> 引用绑定：已选 ${n} 篇`,
      grant: MOCK_GRANT_DRAFT + `\n\n> 依据 ${n} 篇：${selectedIds.join(", ")}`,
      ppt: MOCK_PPT_SLIDES.map((s) => `## 第 ${s.page} 页 · ${s.title}\n${s.bullets.map((b) => `- ${b}`).join("\n")}`).join("\n\n"),
    };
    setGenContent(drafts[key] ?? "");
    setGenModal({ key, title });
    message.success(`正在基于 ${n} 篇已选文献生成…`);
  }

  return (
    <div className="pmp-kb-page">
      {/* 顶栏 */}
      <div className="pmp-kb-topbar">
        <Link to="/knowledge">
          <Button type="text" icon={<ArrowLeftOutlined />} size="small" className="pmp-kb-back">
            返回科研延伸
          </Button>
        </Link>
        <Space>
          <Button icon={<PlusOutlined />} onClick={resetSession}>
            新建问答
          </Button>
          <Button type="primary" ghost icon={<ExportOutlined />} onClick={() => message.info("导出记录（演示）")}>
            导出记录
          </Button>
        </Space>
      </div>

      {/* Hero */}
      <div className="pmp-kb-hero">
        <div className="pmp-kb-hero-icon">
          <RobotOutlined />
        </div>
        <div className="pmp-kb-hero-text">
          <Title level={3} style={{ margin: 0, color: "#fff" }}>
            科研知识库智能体
          </Title>
          <Paragraph style={{ margin: "6px 0 10px", color: "rgba(255,255,255,0.88)", fontSize: 14 }}>
            科研问答 · 文献检索 · 一键生成综述 / 论文 / 基金 / PPT
          </Paragraph>
          <Space wrap size={[6, 6]}>
            <Tag color="success" style={{ margin: 0 }}>
              已连接：机构科研知识库
            </Tag>
            {KNOWLEDGE_SOURCES.map((s) => (
              <Tag key={s} style={{ margin: 0, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff" }}>
                {s}
              </Tag>
            ))}
          </Space>
        </div>
      </div>

      {/* 检索区 */}
      <div className="pmp-kb-search-card">
        <Text strong style={{ fontSize: 14 }}>
          直接输入科研问题
        </Text>
        <Paragraph type="secondary" style={{ margin: "4px 0 12px", fontSize: 12 }}>
          智能体将先检索知识库，再基于可查实文献生成回答
        </Paragraph>
        <div className="pmp-kb-search-row">
          <Input
            size="large"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="PMP 最新研究热点是什么？"
            onPressEnter={startSearch}
            className="pmp-kb-search-input"
          />
          <Button type="primary" size="large" icon={<SearchOutlined />} loading={loading} onClick={startSearch}>
            开始检索
          </Button>
        </div>
      </div>

      <div className="pmp-kb-grid">
        <div className="pmp-kb-main">
          {searched ? (
            <>
              <div className="pmp-card pmp-kb-summary">
                <div className="pmp-kb-section-head">
                  <ReadOutlined style={{ color: "#7c3aed" }} />
                  <span>回答摘要</span>
                  <Tag color="purple">基于知识库检索结果</Tag>
                </div>
                <div className="pmp-kb-answer-list">
                  {MOCK_ANSWER_POINTS.map((p, i) => (
                    <div key={i} className="pmp-kb-answer-item">
                      <div className="pmp-kb-answer-text">
                        <Text strong style={{ color: "#7c3aed", marginRight: 6 }}>
                          研究热点{["一", "二", "三", "四"][i]}：
                        </Text>
                        {p.text.replace(/^研究热点[一二三四]：/, "")}
                      </div>
                      <Space size={4} wrap className="pmp-kb-answer-refs">
                        {p.refs.map((r) => (
                          <Button key={r} size="small" type={highlightRef === r ? "primary" : "default"} onClick={() => scrollToRef(r)}>
                            依据 [{r}]
                          </Button>
                        ))}
                      </Space>
                    </div>
                  ))}
                </div>
                <div className="pmp-kb-trust-note">
                  可信度说明：每条结论均绑定下方文献列表；无文献支撑的内容不会纳入正式结论。
                </div>
              </div>

              <div className="pmp-card pmp-kb-lit-table">
                <div className="pmp-kb-section-head">
                  <FileTextOutlined style={{ color: "#1677ff" }} />
                  <span>可查实文献列表</span>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: "auto" }}>
                    展示 Top {literature.length} · 全库命中 {stats.hit} · 已选 {selectedIds.length}
                  </Text>
                </div>
                <Table
                  size="middle"
                  rowKey="id"
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  dataSource={literature}
                  rowClassName={(_, index) => (highlightRef === index + 1 ? "pmp-kb-row-highlight" : "")}
                  onRow={(_, index) => ({ id: `lit-row-${(index ?? 0) + 1}` })}
                  rowSelection={{
                    selectedRowKeys: selectedIds,
                    onChange: (keys) => setSelectedIds(keys as string[]),
                    columnTitle: "选择",
                  }}
                  scroll={{ x: 900 }}
                  columns={[
                    {
                      title: "文献标题",
                      dataIndex: "title",
                      ellipsis: true,
                      render: (t: string, _, i) => (
                        <span>
                          <Text type="secondary">[{i + 1}] </Text>
                          {t}
                        </span>
                      ),
                    },
                    {
                      title: "来源",
                      dataIndex: "source",
                      width: 100,
                      render: (s: KnowledgeLiterature["source"]) => <Tag color={sourceColor(s)}>{s}</Tag>,
                    },
                    { title: "年份", dataIndex: "year", width: 64, align: "center" },
                    {
                      title: "DOI / PMID",
                      width: 130,
                      render: (_, r) => (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {r.pmid !== "—" ? r.pmid : r.doi.slice(0, 16)}
                        </Text>
                      ),
                    },
                    {
                      title: "相关度",
                      dataIndex: "relevance",
                      width: 80,
                      align: "center",
                      render: (v: number) => (
                        <span className={`pmp-kb-relevance${v >= 90 ? " pmp-kb-relevance--high" : ""}`}>{v}%</span>
                      ),
                    },
                    {
                      title: "操作",
                      width: 200,
                      fixed: "right",
                      render: (_, r, i) => (
                        <Space size={0} wrap>
                          <Button type="link" size="small" onClick={() => message.info(`PubMed 原文：${r.title}`)}>
                            查看原文
                          </Button>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => {
                              setSelectedIds((prev) => (prev.includes(r.id) ? prev : [...prev, r.id]));
                              message.success("已加入证据");
                            }}
                          >
                            加入证据
                          </Button>
                          <Button type="link" size="small" onClick={() => message.success(`已复制引用 [${i + 1}]`)}>
                            引用
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </div>
            </>
          ) : (
            <div className="pmp-card pmp-kb-empty">
              <div className="pmp-kb-empty-icon">
                <SearchOutlined />
              </div>
              <Title level={4} style={{ marginBottom: 8 }}>
                输入科研问题，开始检索
              </Title>
              <Paragraph type="secondary" style={{ maxWidth: 420, textAlign: "center" }}>
                检索完成后，左侧展示带引用的回答摘要与可查实文献；右侧可基于已选文献生成综述、论文、基金或 PPT。
              </Paragraph>
            </div>
          )}
        </div>

        <div className="pmp-kb-side">
          <div className="pmp-card pmp-kb-stats-card">
            <div className="pmp-kb-section-head" style={{ marginBottom: 12 }}>
              <span>检索统计</span>
            </div>
            <div className="pmp-kb-stats-grid">
              {[
                { label: "命中文献", value: stats.hit, color: "#1677ff" },
                { label: "可用综述", value: stats.reviews, color: "#7c3aed" },
                { label: "指南/共识", value: stats.guidelines, color: "#3f8600" },
                { label: "已选证据", value: stats.selected, color: "#d48806" },
              ].map((s) => (
                <div key={s.label} className="pmp-kb-stat-box">
                  <div className="pmp-kb-stat-num" style={{ color: s.color }}>
                    {searched ? s.value : "—"}
                  </div>
                  <div className="pmp-kb-stat-lbl">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <Text type="secondary" style={{ fontSize: 12, display: "block", margin: "4px 0 10px", paddingLeft: 2 }}>
            基于检索结果继续生成
          </Text>

          {GENERATION_MODULES.map((m) => (
            <button
              key={m.key}
              type="button"
              className="pmp-kb-gen-module"
              style={{ borderLeftColor: m.color }}
              onClick={() => openGenerate(m.key, m.title)}
              disabled={!searched}
            >
              <div className="pmp-kb-gen-module-head">
                <span className="pmp-kb-gen-icon" style={{ color: m.color, background: `${m.color}14` }}>
                  {GEN_ICONS[m.icon]}
                </span>
                <Text strong>{m.title}</Text>
              </div>
              <Paragraph type="secondary" style={{ fontSize: 12, margin: "8px 0" }}>
                {m.desc}
              </Paragraph>
              <Space wrap size={[4, 4]}>
                {m.outputs.map((o) => (
                  <Tag key={o} style={{ margin: 0, fontSize: 11 }}>
                    {o}
                  </Tag>
                ))}
              </Space>
            </button>
          ))}

          <Paragraph type="secondary" className="pmp-kb-side-tip">
            提示：可手动勾选文献，或由智能体自动选取高相关度证据后再生成。
          </Paragraph>
        </div>
      </div>

      <Modal
        title={genModal?.title}
        open={!!genModal}
        onCancel={() => setGenModal(null)}
        width={760}
        footer={[
          <Button key="export" onClick={() => message.success("已导出 Word（演示）")}>
            导出 Word
          </Button>,
          <Button key="ok" type="primary" onClick={() => setGenModal(null)}>
            完成
          </Button>,
        ]}
      >
        <pre className="pmp-kb-modal-pre">{genContent}</pre>
      </Modal>
    </div>
  );
}
