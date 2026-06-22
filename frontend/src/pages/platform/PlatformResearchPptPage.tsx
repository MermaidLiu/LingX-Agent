import { FilePptOutlined } from "@ant-design/icons";
import { App, Button, Col, Input, List, Row, Space, Tag, Typography } from "antd";
import { useState } from "react";
import { MOCK_PPT_SLIDES, MOCK_RESEARCH_TOPICS } from "../../data/researchMock";

const { Title, Paragraph, Text } = Typography;

export default function PlatformResearchPptPage() {
  const { message } = App.useApp();
  const [title, setTitle] = useState("PMP 专病库科研汇报");
  const [slides, setSlides] = useState<typeof MOCK_PPT_SLIDES | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [loading, setLoading] = useState(false);

  function generate() {
    setLoading(true);
    setTimeout(() => {
      const customized = MOCK_PPT_SLIDES.map((s, i) =>
        i === 0 ? { ...s, bullets: [title, s.bullets[1], s.bullets[2]] } : s,
      );
      setSlides(customized);
      setActivePage(1);
      setLoading(false);
      message.success(`已生成 ${customized.length} 页 PPT 大纲（演示）`);
    }, 1000);
  }

  const current = slides?.find((s) => s.page === activePage);

  return (
    <div className="pmp-section">
      <Title level={4} style={{ marginBottom: 16 }}>
        <FilePptOutlined style={{ marginRight: 8, color: "#1677ff" }} />
        PPT 生成
      </Title>

      <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
        <Space wrap style={{ width: "100%" }}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="演示文稿标题"
            style={{ width: 320 }}
          />
          <Button type="primary" loading={loading} onClick={generate}>
            生成完整 PPT
          </Button>
          {slides ? (
            <>
              <Button onClick={() => message.info("下载 .pptx（演示）")}>下载 PPTX</Button>
              <Button onClick={() => message.info("下载 PDF（演示）")}>下载 PDF</Button>
            </>
          ) : null}
        </Space>
        <Space wrap style={{ marginTop: 12 }}>
          {MOCK_RESEARCH_TOPICS.map((t) => (
            <Tag key={t} style={{ cursor: "pointer" }} onClick={() => setTitle(t)}>
              {t}
            </Tag>
          ))}
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <div className="pmp-card" style={{ padding: 16 }}>
            <div className="pmp-panel-title">幻灯片列表</div>
            {slides ? (
              <List
                size="small"
                dataSource={slides}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      cursor: "pointer",
                      background: item.page === activePage ? "#f0f7ff" : undefined,
                      borderRadius: 6,
                      padding: "8px 12px",
                    }}
                    onClick={() => setActivePage(item.page)}
                  >
                    <Text>
                      {item.page}. {item.title}
                    </Text>
                  </List.Item>
                )}
              />
            ) : (
              <Paragraph type="secondary">生成后将显示页纲列表</Paragraph>
            )}
          </div>
        </Col>
        <Col xs={24} md={16}>
          <div
            className="pmp-card"
            style={{
              padding: 24,
              minHeight: 360,
              background: "linear-gradient(145deg,#f8fafc,#fff)",
            }}
          >
            {current ? (
              <>
                <Tag color="blue">第 {current.page} 页</Tag>
                <Title level={3} style={{ marginTop: 16, marginBottom: 24 }}>
                  {current.title}
                </Title>
                <ul style={{ fontSize: 16, lineHeight: 2, color: "#374151" }}>
                  {current.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div
                style={{
                  height: 300,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Paragraph type="secondary">幻灯片预览区</Paragraph>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}
