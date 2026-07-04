import ResearchWorkbench from "../../components/platform/ResearchWorkbench";
import { IMAGING_INDICATOR_SPECS } from "../../data/indicatorSpecs";
import {
  IMAGING_FIELDS,
  IMAGING_METHODS,
  IMAGING_RESULTS,
  IMAGING_TASKS,
} from "../../data/researchWorkbenchMock";
import { getPathologyImagingOrNull } from "../../lib/platformSession";

export default function PlatformImagingAnalysisPage() {
  const pathology = getPathologyImagingOrNull();
  return (
    <ResearchWorkbench
      moduleKey="imaging"
      title="影像数据智能分析工作台"
      subtitle="基于智能分析标注病灶图进行 Radiomics 特征建模与预测。"
      badge="模块二：影像数据智能分析"
      theme="cyan"
      dataTitle="影像与标注"
      fields={IMAGING_FIELDS}
      tasks={IMAGING_TASKS}
      methods={IMAGING_METHODS}
      resultMap={IMAGING_RESULTS}
      indicatorSpecs={IMAGING_INDICATOR_SPECS}
      radiomicsAnnotatedImage={pathology?.result_image_base64}
      radiomicsPathologyGrade={pathology?.grade_label}
      stats={[
        { label: "影像数", value: "76,300" },
        { label: "配对病例", value: "9,420" },
        { label: "特征数", value: "1,248" },
        { label: "AUC", value: "0.86" },
      ]}
      outputs={[
        "影像特征报告",
        "AUC 曲线",
        "特征重要性图",
        "Grad-CAM 热图",
        "模型性能表",
        "论文结果段落",
      ]}
      followUps={[
        "哪些影像特征最重要？",
        "帮我生成 AUC 曲线",
        "Grad-CAM 解释模型",
        "把影像结果写成论文段落",
      ]}
    />
  );
}
