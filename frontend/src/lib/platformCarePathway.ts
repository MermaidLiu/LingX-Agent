import type { PathologyAnalysisResult, PetCtInterviewRecord } from "../api/client";
import type { PathologyImagingGradeResult, PciScoreResult } from "../api/platform";
import { platformCarePathwayAnalyze } from "../api/platform";
import { buildPciConclusion } from "./pciRegions";
import { getWorkflowCase } from "./workflowCase";

function getPci(imaging: PathologyImagingGradeResult): PciScoreResult | undefined {
  return imaging.pci ?? (imaging.raw?.pci as PciScoreResult | undefined);
}

export type CarePathwayResult = {
  imaging_report: string;
  api_conclusion: string;
  inferred_diagnosis: string;
  treatment: {
    recommendations: string[];
    grade_label: string;
    mdt_recommended: boolean;
    guideline_refs: string[];
    llm_used?: boolean;
    llm_model?: string;
  };
  literature: Array<{ title: string; journal: string; year: string; pmid: string }>;
};

/** Merge workflow clinical fields + platform imaging/PCI into a case record for care-pathway API. */
export function buildRecordForCarePathway(
  imaging: PathologyImagingGradeResult,
  examId?: string,
): PetCtInterviewRecord {
  const base = getWorkflowCase();
  const pci = getPci(imaging);
  const pciScore = pci?.pci_score ?? null;
  const pciConclusion = pci?.conclusion?.trim() || (pci ? buildPciConclusion(pci) : "");

  const resolvedExamId =
    examId?.trim() ||
    imaging.exam_id?.trim() ||
    base.patient_base_info.exam_id?.trim() ||
    `CASE-${Date.now()}`;

  const gradeHint =
    imaging.grade_label?.trim() ||
    (pciScore != null && pciScore >= 20 ? "高级别" : pciScore != null && pciScore <= 10 ? "低级别" : "");

  return {
    ...base,
    patient_base_info: {
      ...base.patient_base_info,
      exam_id: resolvedExamId,
      name: base.patient_base_info.name || "待命名病例",
      exam_item: base.patient_base_info.exam_item || "DICOM 影像 + 临床综合评估",
    },
    research_extensions: {
      ...base.research_extensions,
      pathology_grade: gradeHint || base.research_extensions?.pathology_grade || "",
      imaging_report_text: pciConclusion,
      pet_ct_report_narrative: pciConclusion,
      pathology_confidence: imaging.confidence ?? base.research_extensions?.pathology_confidence ?? null,
    },
  };
}

/** Imaging report text from CT API PCI conclusion only (no rule-engine summary). */
export function buildImagingReportText(imaging: PathologyImagingGradeResult): string {
  const pci = getPci(imaging);
  const conclusion =
    pci?.conclusion?.trim() ||
    (pci ? buildPciConclusion(pci) : "") ||
    imaging.message.split(/[·•]/)[0]?.trim() ||
    "接口未返回文字结论，请查看 PCI 评分与分割结果。";

  const lines = ["【影像分析报告】", "来源：CT 合并接口（分割 + PCI）", "", conclusion];
  if (pci?.pci_score != null) lines.push("", `PCI 总分：${pci.pci_score}/36`);
  return lines.join("\n");
}

export async function runCarePathwayAnalysis(
  imaging: PathologyImagingGradeResult,
  examId?: string,
): Promise<CarePathwayResult> {
  const record = buildRecordForCarePathway(imaging, examId);
  return platformCarePathwayAnalyze(imaging, record);
}

/** Minimal PathologyAnalysisResult for follow-up queue enrollment. */
export function buildPathologyAnalysisStub(care: CarePathwayResult): PathologyAnalysisResult {
  const grade = care.treatment.grade_label || "未确定";
  const composite =
    grade === "高级别" ? 72 : grade === "低级别" ? 28 : 50;
  return {
    diagnosis_summary: care.api_conclusion,
    inferred_diagnosis: care.inferred_diagnosis,
    grading: {
      grade_label: grade,
      pathology_grade: grade,
      grade_system: "WHO / PCI",
      who_grade: grade === "高级别" ? "G3" : grade === "低级别" ? "G1" : "—",
      composite_score: composite,
      score_level: grade === "高级别" ? "高危" : grade === "低级别" ? "低危" : "中危",
      confidence: 0.85,
      score_breakdown: {},
      score_interpretation: care.api_conclusion,
      evidence: [care.api_conclusion],
      biomarkers_suggested: [],
    },
    treatment: care.treatment,
    literature: care.literature,
    multimodal_notes: [],
  };
}
