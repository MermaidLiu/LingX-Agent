import { StarFilled, TeamOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, List, Row, Space, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import type { PathologyImagingGradeResult } from "../../api/platform";
import type { CarePathwayResult } from "../../lib/platformCarePathway";
import { buildImagingReportText } from "../../lib/platformCarePathway";

const { Paragraph, Text, Title } = Typography;

const PLAN_LABELS = ["方案 A", "方案 B", "方案 C"];
const PLAN_STARS = [5, 4, 3];

type Props = {
  imaging: PathologyImagingGradeResult;
  careResult: CarePathwayResult | null;
  careLoading: boolean;
  inFollowUp: boolean;
  followUpLoading: boolean;
  onEnroll: () => void;
};

export function CarePathwayPanel({
  imaging,
  careResult,
  careLoading,
  inFollowUp,
  followUpLoading,
  onEnroll,
}: Props) {
  const reportText = careResult?.imaging_report || buildImagingReportText(imaging);
  const plans = careResult?.treatment.recommendations.slice(0, 3) ?? [];

  return (
    <div id="pmp-care-pathway" className="pmp-care-pathway pmp-section" style={{ marginTop: 24 }}>
      <Title level={4} style={{ marginBottom: 8 }}>
        <span className="pmp-section-num">3</span>
        治疗方案推荐
      </Title>
      <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
        基于 CT 接口 PCI 结论与临床信息，由 DeepSeek 结合 UpToDate / CSCO 等指南生成治疗建议。
      </Paragraph>

      <Row gutter={[16, 16]}>
        {plans.length ? (
          plans.map((rec, i) => (
            <Col xs={24} md={8} key={PLAN_LABELS[i]}>
              <Card
                size="small"
                className={`pmp-treatment-plan${i === 0 ? " pmp-treatment-plan--primary" : ""}`}
                title={
                  <Space>
                    <span>{PLAN_LABELS[i]}</span>
                    <span className="pmp-treatment-plan-stars">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <StarFilled
                          key={si}
                          style={{ color: si < PLAN_STARS[i] ? "#faad14" : "#e5e7eb", fontSize: 12 }}
                        />
                      ))}
                    </span>
                  </Space>
                }
              >
                <Paragraph style={{ fontSize: 13, marginBottom: 0, minHeight: 64 }}>{rec}</Paragraph>
              </Card>
            </Col>
          ))
        ) : (
          <Col xs={24}>
            <Card size="small" loading={careLoading}>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                影像分析完成后将自动生成治疗方案…
              </Paragraph>
            </Card>
          </Col>
        )}

        <Col xs={24} lg={12}>
          <Card title="影像分析报告" size="small" loading={careLoading && !careResult}>
            <pre className="pmp-care-report">{reportText}</pre>
            {careResult?.api_conclusion ? (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message={careResult.inferred_diagnosis}
                description={careResult.api_conclusion}
              />
            ) : null}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="个性化调整与指南依据" size="small" loading={careLoading}>
            {careResult?.treatment ? (
              <>
                <Space wrap style={{ marginBottom: 12 }}>
                  <Tag color="blue">分级：{careResult.treatment.grade_label}</Tag>
                  {careResult.treatment.mdt_recommended ? <Tag color="orange">建议 MDT</Tag> : null}
                  {careResult.treatment.llm_used ? (
                    <Tag color="purple">DeepSeek</Tag>
                  ) : (
                    <Tag>规则引擎备选</Tag>
                  )}
                </Space>
                {careResult.treatment.recommendations.length > 3 ? (
                  <List
                    size="small"
                    dataSource={careResult.treatment.recommendations.slice(3)}
                    renderItem={(item) => <List.Item style={{ paddingBlock: 6 }}>{item}</List.Item>}
                  />
                ) : null}
                <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
                  指南依据：{careResult.treatment.guideline_refs.join(" · ")}
                </Paragraph>
                {careResult.literature?.length ? (
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      参考文献：
                    </Text>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12 }}>
                      {careResult.literature.slice(0, 3).map((lit) => (
                        <li key={lit.pmid || lit.title}>
                          {lit.title} — {lit.journal} ({lit.year})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <Paragraph type="secondary">等待治疗建议生成…</Paragraph>
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card size="small" bodyStyle={{ padding: "12px 16px" }}>
            <Space wrap>
              <Button
                type="primary"
                icon={<TeamOutlined />}
                loading={followUpLoading}
                disabled={!careResult || inFollowUp}
                onClick={onEnroll}
              >
                {inFollowUp ? "已在随访队列" : "采纳方案 · 加入随访队列"}
              </Button>
              {inFollowUp ? (
                <Link to="/db/follow-up">
                  <Button>查看随访队列</Button>
                </Link>
              ) : null}
            </Space>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
              入队后将写入患者数据库并标记「随访队列」，可在随访数据库中按科室筛选与 longitudinal 对比。
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
