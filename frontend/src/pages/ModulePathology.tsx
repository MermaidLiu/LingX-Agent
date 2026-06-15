import { ExperimentOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Row, Tag, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { analyzePathology, type PathologyAnalysisResult } from "../api/client";
import { demoRecord } from "../data/demoRecord";

const { Paragraph, Title, Text } = Typography;

export default function ModulePathology() {
  const { message } = App.useApp();
  const [analysis, setAnalysis] = useState<PathologyAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAnalyze() {
    setLoading(true);
    try {
      const res = await analyzePathology(demoRecord);
      setAnalysis(res);
      message.success("诊断结果已生成");
    } catch {
      message.error("分析失败，请确认后端已启动");
    } finally {
      setLoading(false);
    }
  }

  const gradeColor = (g: string) =>
    g === "高级别" ? "red" : g === "低级别" ? "green" : "default";

  return (
    <div>
      <Title level={4} className="glass-page-title">
        诊断结果
      </Title>
      <Paragraph type="secondary">
        工作台第 2 步：基于第 1 步录入的 DICOM 与临床诊断，综合影像报告与病史输出诊断结果（高级别 / 低级别），并给出诊断依据与建议补充标志物。
      </Paragraph>
      <Button type="primary" icon={<ExperimentOutlined />} loading={loading} onClick={runAnalyze}>
        生成诊断结果
      </Button>
      {analysis ? (
        <div style={{ marginTop: 24 }}>
          <Card title="诊断推断" size="small" style={{ marginBottom: 16 }}>
            <Paragraph>{analysis.diagnosis_summary}</Paragraph>
            <Tag color={gradeColor(analysis.grading.grade_label)}>
              {analysis.grading.grade_label} · 置信度 {(analysis.grading.confidence * 100).toFixed(0)}%
            </Tag>
            <Text type="secondary" style={{ marginLeft: 12 }}>
              {analysis.grading.grade_system}
            </Text>
          </Card>
          <Row gutter={16}>
            <Col span={24}>
              <Card title="诊断依据" size="small">
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {analysis.grading.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
                {analysis.grading.biomarkers_suggested.length > 0 ? (
                  <Paragraph style={{ marginTop: 12 }}>
                    建议补充标志物：{analysis.grading.biomarkers_suggested.join("、")}
                  </Paragraph>
                ) : null}
              </Card>
            </Col>
          </Row>
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
