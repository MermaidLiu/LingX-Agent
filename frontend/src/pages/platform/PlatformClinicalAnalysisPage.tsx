import ResearchWorkbench from "../../components/platform/ResearchWorkbench";
import {
  CLINICAL_FIELDS,
  CLINICAL_METHODS,
  CLINICAL_RESULTS,
  CLINICAL_TASKS,
} from "../../data/researchWorkbenchMock";

export default function PlatformClinicalAnalysisPage() {
  return (
    <ResearchWorkbench
      moduleKey="clinical"
      title="临床及病理数据分析工作台"
      subtitle="面向临床、病理、随访等结构化数据，用于病理分级相关因素、生存分析、预后模型等任务。"
      badge="模块一：临床及病理数据分析"
      theme="navy"
      dataTitle="数据与变量"
      fields={CLINICAL_FIELDS}
      tasks={CLINICAL_TASKS}
      methods={CLINICAL_METHODS}
      resultMap={CLINICAL_RESULTS}
      stats={[
        { label: "病例数", value: "12,846" },
        { label: "变量数", value: "68" },
        { label: "缺失率", value: "6.2%" },
        { label: "C-index", value: "0.74" },
      ]}
      outputs={[
        "统计分析报告",
        "Table 1 基线特征",
        "单/多因素回归表",
        "KM 曲线",
        "Nomogram",
        "论文结果段落",
      ]}
      followUps={[
        "哪些因素是独立危险因素？",
        "帮我画 KM 曲线",
        "生成 Table 1",
        "把结果写成论文结果段",
      ]}
    />
  );
}
