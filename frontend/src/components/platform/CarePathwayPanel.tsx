import { TeamOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, List, Row, Space, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import type { PathologyImagingGradeResult } from "../../api/platform";
import type { CarePathwayResult } from "../../lib/platformCarePathway";
import { buildImagingReportText } from "../../lib/platformCarePathway";

const { Paragraph, Text, Title } = Typography;

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

  return (
    <div className="pmp-care-pathway" style={{ marginTop: 20 }}>
      <Title level={5}>临床路径 · 报告与治疗建议</Title>
      <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
        影像分析报告取自 CT 合并接口 PCI 结论；治疗建议由 DeepSeek 结合接口结论与临床信息生成，参考中国肿瘤临床、中华胃肠外科杂志、消化肿瘤杂志（电子版）及 CSCO 原则。
      </Paragraph>

      <Row gutter={[16, 16]}>
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
          <Card title="治疗建议（指南参考）" size="small" loading={careLoading}>
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
                <List
                  size="small"
                  dataSource={careResult.treatment.recommendations}
                  renderItem={(item) => <List.Item style={{ paddingBlock: 6 }}>{item}</List.Item>}
                />
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
              <Paragraph type="secondary">影像分析完成后将自动生成治疗建议…</Paragraph>
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
                {inFollowUp ? "已在随访队列" : "确认治疗建议 · 加入随访队列"}
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
