import { ExperimentOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Descriptions, Progress, Row, Statistic, Tag, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { analyzePathology, type PathologyAnalysisResult } from "../api/client";
import { getWorkflowCase } from "../lib/workflowCase";

const { Paragraph, Title, Text } = Typography;

export default function ModulePathology() {
  const { message } = App.useApp();
  const [analysis, setAnalysis] = useState<PathologyAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAnalyze() {
    setLoading(true);
    try {
      const res = await analyzePathology(getWorkflowCase());
      setAnalysis(res);
      message.success("诊断结果已生成");
    } catch {
      message.error("分析失败，请确认后端已启动");
    } finally {
      setLoading(false);
    }
  }

  const g = analysis?.grading;
  const gradeColor = (label: string) =>
    label === "高级别" ? "red" : label === "低级别" ? "green" : "default";
  const scoreColor = (level: string) =>
    level === "高危" ? "#cf1322" : level === "中危" ? "#d48806" : "#3f8600";

  return (
    <div>
      <Title level={4} className="glass-page-title">
        诊断结果
      </Title>
      <Paragraph type="secondary">
        工作台第 2 步：读取第 1 步录入的临床诊断与 DICOM 数据，输出病理分级、WHO 分级与综合评分。
        若未上传含 PET 的 DICOM，则不会显示 SUV 等代谢指标。
      </Paragraph>
      <Button type="primary" icon={<ExperimentOutlined />} loading={loading} onClick={runAnalyze}>
        生成诊断结果
      </Button>
      {analysis && g ? (
        <div style={{ marginTop: 24 }}>
          <Card title="临床诊断" size="small" style={{ marginBottom: 16 }}>
            <Paragraph style={{ marginBottom: 8 }}>
              <Text strong>推断诊断：</Text>
              {analysis.inferred_diagnosis}
            </Paragraph>
            <Paragraph style={{ marginBottom: 0 }}>{analysis.diagnosis_summary}</Paragraph>
          </Card>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} md={8}>
              <Card title="病理分级" size="small">
                <Tag color={gradeColor(g.pathology_grade || g.grade_label)} style={{ fontSize: 14, padding: "4px 12px" }}>
                  {g.pathology_grade || g.grade_label}
                </Tag>
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">WHO 分级：</Text>
                  <Text strong> {g.who_grade || "—"}</Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">分级体系：</Text>
                  <Text> {g.grade_system}</Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">置信度：</Text>
                  <Text> {(g.confidence * 100).toFixed(0)}%</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="综合评分" size="small">
                <Statistic
                  value={g.composite_score ?? 0}
                  suffix="/ 100"
                  valueStyle={{ color: scoreColor(g.score_level), fontSize: 36 }}
                />
                <Tag color={gradeColor(g.score_level === "高危" ? "高级别" : g.score_level === "低危" ? "低级别" : "未确定")}>
                  {g.score_level || "—"}
                </Tag>
                <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
                  {g.score_interpretation}
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="评分明细" size="small">
                {Object.entries(g.score_breakdown || {}).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text>{k}</Text>
                      <Text strong>{v}</Text>
                    </div>
                    <Progress percent={v} showInfo={false} strokeColor={scoreColor(g.score_level)} size="small" />
                  </div>
                ))}
              </Card>
            </Col>
          </Row>

          <Card title="诊断依据" size="small" style={{ marginBottom: 16 }}>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {g.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {g.biomarkers_suggested.length > 0 ? (
              <Paragraph style={{ marginTop: 12, marginBottom: 0 }}>
                建议补充标志物：{g.biomarkers_suggested.join("、")}
              </Paragraph>
            ) : null}
          </Card>

          {analysis.multimodal_notes.length > 0 ? (
            <Descriptions bordered size="small" column={2} title="多模态摘要">
              {analysis.multimodal_notes.map((n, i) => (
                <Descriptions.Item key={i} label={`项 ${i + 1}`}>
                  {n}
                </Descriptions.Item>
              ))}
            </Descriptions>
          ) : null}
        </div>
      ) : null}
      <Paragraph style={{ marginTop: 24 }}>
        下一步 →{" "}
        <Link to="/treatment" className="glass-link">
          治疗推荐
        </Link>
      </Paragraph>
    </div>
  );
}
