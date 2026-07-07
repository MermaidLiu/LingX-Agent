import { useMemo } from "react";
import ResearchWorkbench from "../../components/platform/ResearchWorkbench";
import { IMAGING_INDICATOR_SPECS } from "../../data/indicatorSpecs";
import {
  IMAGING_FIELDS,
  IMAGING_METHODS,
  IMAGING_RESULTS,
  IMAGING_TASKS,
} from "../../data/researchWorkbenchMock";
import { consumeBatchSelection } from "../../lib/platformBatchSelection";
import { getResearchBatchPatients } from "../../lib/researchBatchContext";
import { getPathologyImagingOrNull } from "../../lib/platformSession";

export default function PlatformImagingAnalysisPage() {
  const batch = useMemo(() => {
    const fromResearch = getResearchBatchPatients("imaging");
    if (fromResearch.length) return { patients: fromResearch };
    return consumeBatchSelection("radiomics");
  }, []);

  const batchPatients = batch?.patients ?? [];
  const batchHasPresegRoi = batchPatients.some((p) => p.niiVolumeId);
  const pathology = batchHasPresegRoi ? null : getPathologyImagingOrNull();

  const pathologyGrade =
    batchPatients.find((p) => p.gradeLabel)?.gradeLabel ?? pathology?.grade_label;

  return (
    <ResearchWorkbench
      moduleKey="imaging"
      title="影像数据智能分析工作台"
      subtitle={
        batchHasPresegRoi
          ? "批量预勾画 ROI 模式：跳过智能分析接口，直接进行 Radiomics 特征建模。"
          : "基于 DICOM 分割或智能分析标注图进行 Radiomics 特征建模与预测。"
      }
      badge="模块二：影像数据智能分析"
      theme="cyan"
      dataTitle="影像与标注"
      fields={IMAGING_FIELDS}
      tasks={IMAGING_TASKS}
      methods={IMAGING_METHODS}
      resultMap={IMAGING_RESULTS}
      indicatorSpecs={IMAGING_INDICATOR_SPECS}
      initialTaskId={batch ? "radiomics" : undefined}
      batchPatients={batchPatients}
      batchRoiMode={batchHasPresegRoi}
      radiomicsAnnotatedImage={pathology?.result_image_base64}
      radiomicsPathologyGrade={pathologyGrade}
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
