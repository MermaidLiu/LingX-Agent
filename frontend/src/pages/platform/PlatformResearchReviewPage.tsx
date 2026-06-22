import { ReadOutlined } from "@ant-design/icons";
import { App, Button, Col, Input, List, Progress, Row, Space, Tag, Typography } from "antd";
import { useState } from "react";
import { MOCK_LITERATURE, MOCK_RESEARCH_TOPICS, MOCK_REVIEW_OUTLINE } from "../../data/researchMock";

const { Title, Paragraph, Text } = Typography;

export default function PlatformResearchReviewPage() {
  const { message } = App.useApp();
  const [topic, setTopic] = useState(MOCK_RESEARCH_TOPICS[0]);
  const [outline, setOutline] = useState("");
  const [loading, setLoading] = useState(false);

  function generate() {
    setLoading(true);
    setTimeout(() => {
      setOutline(MOCK_REVIEW_OUTLINE.replace("影像代谢与病理分级的关联研究", topic));
      setLoading(false);
      message.success("综述大纲已生成（演示）");
    }, 900);
  }

  return (
    <div className="pmp-section">
      <Title level={4} style={{ marginBottom: 16 }}>
        <ReadOutlined style={{ marginRight: 8, color: "#1677ff" }} />
        综述生成
      </Title>

      <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          输入综述主题，AI 将结合专病库与文献库生成大纲与参考文献建议。
        </Paragraph>
        <Space.Compact style={{ width: "100%", maxWidth: 640 }}>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="如：PMP 影像代谢与病理分级"
          />
          <Button type="primary" loading={loading} onClick={generate}>
            生成综述
          </Button>
        </Space.Compact>
        <Space wrap style={{ marginTop: 12 }}>
          {MOCK_RESEARCH_TOPICS.map((t) => (
            <Tag key={t} style={{ cursor: "pointer" }} onClick={() => setTopic(t)}>
              {t}
            </Tag>
          ))}
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="pmp-panel-title">综述大纲</div>
          {outline ? (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 12,
                lineHeight: 1.7,
                margin: 0,
                maxHeight: 420,
                overflow: "auto",
              }}
            >
              {outline}
            </pre>
          ) : (
            <Paragraph type="secondary">点击「生成综述」后在此显示 Markdown 大纲</Paragraph>
          )}
          {outline ? (
            <Button style={{ marginTop: 12 }} onClick={() => message.info("导出 Word（演示）")}>
              导出 Word
            </Button>
          ) : null}
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="pmp-panel-title">文献助手 · 推荐文献</div>
          <List
            size="small"
            dataSource={MOCK_LITERATURE}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Text style={{ fontSize: 13 }} ellipsis>
                      {item.title}
                    </Text>
                  }
                  description={
                    <Space direction="vertical" size={4}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {item.journal} · {item.year} · PMID {item.pmid}
                      </Text>
                      <Progress percent={item.relevance} size="small" strokeColor="#1677ff" format={(p) => `相关度 ${p}%`} />
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
          </div>
        </Col>
      </Row>
    </div>
  );
}
