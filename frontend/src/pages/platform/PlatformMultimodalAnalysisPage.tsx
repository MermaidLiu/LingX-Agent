import { Alert, Space, Table, Tag, Typography } from "antd";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import ResearchWorkbench from "../../components/platform/ResearchWorkbench";
import { MULTIMODAL_INDICATOR_SPECS } from "../../data/indicatorSpecs";
import {
  MODALITY_CONTRIBUTION,
  MULTIMODAL_FIELDS,
  MULTIMODAL_FUSION_ROWS,
  MULTIMODAL_METHODS,
  MULTIMODAL_TASKS,
  type ResearchResultRow,
} from "../../data/researchWorkbenchMock";
import { loadModuleResults } from "../../lib/researchModuleResults";
import { getWorkflowContext } from "../../lib/workflowContext";

const { Text } = Typography;

function ContributionChart() {
  return (
    <div style={{ marginTop: 12 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        各模态贡献度
      </Text>
      {MODALITY_CONTRIBUTION.map((m) => (
        <div key={m.name} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span>{m.name}</span>
            <span>{m.pct}%</span>
          </div>
          <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, marginTop: 4 }}>
            <div style={{ width: `${m.pct}%`, height: "100%", background: "#7c3aed", borderRadius: 3 }} />
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {m.note}
          </Text>
        </div>
      ))}
    </div>
  );
}

export default function PlatformMultimodalAnalysisPage() {
  const linked = useMemo(() => loadModuleResults(), []);
  const workflow = useMemo(() => getWorkflowContext(), []);

  const fusionResults: Record<string, ResearchResultRow[]> = {
    "clinical-imaging": [
      { factor: "多模态融合", metric: "AUC=0.91", pValue: "—", note: "优于单模态", weight: 95 },
      { factor: "临床 + 病理", metric: "AUC=0.78", pValue: "—", note: linked.clinical?.taskTitle ?? "未运行", weight: 72 },
      { factor: "影像模型", metric: "AUC=0.84", pValue: "—", note: linked.imaging?.taskTitle ?? "未运行", weight: 82 },
      ...(linked.clinical?.rows.slice(0, 1).map((r) => ({
        ...r,
        factor: `临床·${r.factor}`,
        note: `来自临床模块：${linked.clinical?.taskTitle}`,
      })) ?? []),
      ...(linked.imaging?.rows.slice(0, 1).map((r) => ({
        ...r,
        factor: `影像·${r.factor}`,
        note: `来自影像模块：${linked.imaging?.taskTitle}`,
      })) ?? []),
    ],
    "path-omics": [
      { factor: "病理 + 组学融合", metric: "AUC=0.88", pValue: "0.001", note: "组学增益 +6%", weight: 88 },
    ],
    "grade-subtype": [
      { factor: "多模态分级预测", metric: "Acc=0.89", pValue: "0.001", note: "联合临床+影像", weight: 90 },
    ],
    "survival-risk": [
      { factor: "融合风险评分", metric: "C-index=0.83", pValue: "0.001", note: "风险三分层", weight: 92 },
    ],
    explain: MODALITY_CONTRIBUTION.map((m) => ({
      factor: m.name,
      metric: `${m.pct}%`,
      pValue: "—",
      note: m.note,
      weight: m.pct,
    })),
  };

  const linkedBanner = (
    <div style={{ marginBottom: 16 }}>
      {workflow.hasPathologyResult || workflow.diagnosis ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          message="已关联工作台智能分析与辅助诊断"
          description={
            <Space direction="vertical" size={4}>
              {workflow.pathology ? (
                <span>
                  影像诊断：<Tag color="blue">{workflow.pathology.grade_label}</Tag>
                  {workflow.pathology.dicom_count ? `${workflow.pathology.dicom_count} 张 DICOM` : ""}
                </span>
              ) : null}
              {workflow.diagnosis ? (
                <span>
                  辅助诊断：<Tag color="purple">{workflow.diagnosis.title}</Tag>
                </span>
              ) : null}
            </Space>
          }
        />
      ) : null}
      {linked.clinical && linked.imaging ? (
        <Alert
          type="success"
          showIcon
          message="已关联临床与影像模块结果"
          description={
            <Space direction="vertical" size={4}>
              <span>
                临床：<Tag>{linked.clinical.taskTitle}</Tag>
                {linked.clinical.summary}
              </span>
              <span>
                影像：<Tag color="cyan">{linked.imaging.taskTitle}</Tag>
                {linked.imaging.summary}
              </span>
            </Space>
          }
        />
      ) : (
        <Alert
          type="info"
          showIcon
          message="多模态联合分析可关联前两个模块"
          description={
            <span>
              请先在{" "}
              <Link to="/knowledge/data/clinical">临床模块</Link> 与{" "}
              <Link to="/knowledge/data/imaging">影像模块</Link> 各运行一次分析并保存结果，返回此处即可自动融合。
              {!linked.clinical && !linked.imaging ? "（当前尚无已保存结果）" : "（部分模块结果待补充）"}
            </span>
          }
        />
      )}
    </div>
  );

  const extraCenter = (
    <div className="pmp-card" style={{ padding: 12, marginBottom: 16, background: "#fafbfc" }}>
      <Text strong style={{ fontSize: 13 }}>
        多模态联合结果示例
      </Text>
      <Table
        size="small"
        pagination={false}
        style={{ marginTop: 8 }}
        rowKey="model"
        dataSource={MULTIMODAL_FUSION_ROWS}
        columns={[
          { title: "模型", dataIndex: "model" },
          { title: "AUC", dataIndex: "auc", width: 64 },
          { title: "C-index", dataIndex: "cIndex", width: 72 },
          { title: "说明", dataIndex: "note", ellipsis: true },
        ]}
      />
      <ContributionChart />
    </div>
  );

  return (
    <ResearchWorkbench
      moduleKey="multimodal"
      title="多模态联合分析工作台"
      subtitle="融合临床、病理、影像、组学与随访数据，构建联合模型并解释各模态贡献度。"
      badge="模块三：多模态联合分析"
      theme="purple"
      dataTitle="模态与融合字段"
      fields={MULTIMODAL_FIELDS}
      tasks={MULTIMODAL_TASKS}
      methods={MULTIMODAL_METHODS}
      resultMap={fusionResults}
      indicatorSpecs={MULTIMODAL_INDICATOR_SPECS}
      stats={[
        { label: "总病例", value: "38,520" },
        { label: "多模态配对", value: "9,420" },
        { label: "输入特征", value: "1,380" },
        { label: "模型 AUC", value: "0.91" },
      ]}
      outputs={[
        "联合模型报告",
        "模态贡献度图",
        "风险分层图",
        "模型对比表",
        "科研结论",
        "论文讨论段",
      ]}
      followUps={[
        "联合模型比单模态提升了多少？",
        "帮我生成风险分层图",
        "解释为什么影像贡献最高",
        "把多模态结果写成论文讨论",
      ]}
      linkedBanner={linkedBanner}
      extraCenter={extraCenter}
    />
  );
}
