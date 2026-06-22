import { MedicineBoxOutlined } from "@ant-design/icons";
import { Col, Descriptions, Row, Select, Space, Tag, Tabs, Typography } from "antd";
import { useMemo, useState } from "react";
import { GradeTag } from "../../components/platform/DatabasePageShell";
import { MOCK_TREATMENT_PLANS } from "../../data/analysisMock";

const { Title, Paragraph, Text } = Typography;

export default function PlatformTreatmentPage() {
  const [selectedId, setSelectedId] = useState(MOCK_TREATMENT_PLANS[0].id);

  const plan = useMemo(
    () => MOCK_TREATMENT_PLANS.find((p) => p.id === selectedId) ?? MOCK_TREATMENT_PLANS[0],
    [selectedId],
  );

  return (
    <div className="pmp-section">
      <Title level={4} style={{ marginBottom: 16 }}>
        <MedicineBoxOutlined style={{ marginRight: 8, color: "#1677ff" }} />
        治疗建议
      </Title>

      <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
        <Space wrap>
          <Text type="secondary">选择患者：</Text>
          <Select
            style={{ minWidth: 320 }}
            value={selectedId}
            onChange={setSelectedId}
            options={MOCK_TREATMENT_PLANS.map((p) => ({
              value: p.id,
              label: `${p.patientName} · ${p.diagnosis}`,
            }))}
          />
          {plan.mdtRequired ? <Tag color="orange">建议 MDT</Tag> : null}
          <Tag color="blue">{plan.priority}</Tag>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <div className="pmp-card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="pmp-panel-title">患者与诊断</div>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="患者">{plan.patientName}</Descriptions.Item>
              <Descriptions.Item label="诊断">{plan.diagnosis}</Descriptions.Item>
              <Descriptions.Item label="分期">{plan.stage}</Descriptions.Item>
              <Descriptions.Item label="病理分级">
                <GradeTag label={plan.gradeLabel} />
              </Descriptions.Item>
              <Descriptions.Item label="推荐方案">{plan.scheme}</Descriptions.Item>
              <Descriptions.Item label="指南">{plan.guideline}</Descriptions.Item>
            </Descriptions>
          </div>
          <div className="pmp-card" style={{ padding: 16 }}>
            <div className="pmp-panel-title">用药建议</div>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
              {plan.drugs.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </Col>
        <Col xs={24} lg={14}>
          <div className="pmp-card" style={{ padding: 16 }}>
            <Tabs
              items={[
                {
                  key: "plan",
                  label: "治疗方案",
                  children: (
                    <ol style={{ paddingLeft: 20, lineHeight: 2, margin: 0 }}>
                      {plan.lines.map((line, i) => (
                        <li key={line}>
                          {line}
                          {i === 0 ? (
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                              首选
                            </Tag>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ),
                },
                {
                  key: "follow",
                  label: "随访建议",
                  children: <Paragraph>{plan.followUp}</Paragraph>,
                },
                {
                  key: "mdt",
                  label: "MDT 要点",
                  children: (
                    <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
                      <li>影像科：评估可切除性与残留病灶</li>
                      <li>病理科：确认分级与分子标志物</li>
                      <li>肿瘤内科：制定系统治疗与随访间隔</li>
                      {plan.gradeLabel === "低级别" && plan.diagnosis.includes("粘液") ? (
                        <li>PMP 专病：DPAM/LAMN 倾向 CRS+HIPEC；PMCA 需积极综合治疗</li>
                      ) : null}
                    </ul>
                  ),
                },
                {
                  key: "trial",
                  label: "临床试验",
                  children: (
                    <Text type="secondary">
                      暂无完全匹配试验。可检索 ClinicalTrials.gov：{plan.diagnosis} + {plan.stage}
                    </Text>
                  ),
                },
              ]}
            />
          </div>
        </Col>
      </Row>
    </div>
  );
}
