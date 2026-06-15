import type { PetCtInterviewRecord } from "../api/client";
import { demoRecord } from "../data/demoRecord";

const STORAGE_KEY = "pmp_workflow_case";

/** 病理分级场景默认病例（无发热待查、无 PET 预填，待 DICOM/临床输入） */
export function buildPathologyBaseCase(clinicalDiagnosis?: string): PetCtInterviewRecord {
  const dx = clinicalDiagnosis?.trim() || "卵巢肿物，待病理学分级明确";
  return {
    ...demoRecord,
    patient_base_info: {
      ...demoRecord.patient_base_info,
      department: "妇科肿瘤科",
      exam_item: "病理+DICOM 多模态",
      exam_id: demoRecord.patient_base_info.exam_id || "CASE-DICOM-001",
    },
    interview_info: {
      ...demoRecord.interview_info,
      clinical_diagnosis: dx,
      brief_medical_history: "盆腔肿物待进一步病理及影像评估，无发热病史。",
      nodule_diagnosis: dx,
    },
    supplementary_interview_info: {
      ...demoRecord.supplementary_interview_info,
      examination_history: {
        ...demoRecord.supplementary_interview_info.examination_history,
        petct: false,
        pathology: true,
      },
    },
    research_extensions: {
      ...demoRecord.research_extensions,
      primary_disease_code: "PATH",
      primary_disease_name: dx,
      pet_ct_phenotype_tags: [],
      fuo_profile: {
        fever_duration: "",
        max_temperature_c: "",
        fever_pattern: "",
        antipyretic_response: "",
        infection_workup_summary: "",
        rheumatic_immunology_clues: "",
        steroid_or_immunosuppressor_exposure: "",
      },
      pet_ct_report_narrative: "",
      imaging_report_text: "",
      lesions: [],
      global_quant: { suv_max: null, suv_mean: null, mtv: null, tlg: null },
    },
  };
}

export function saveWorkflowCase(record: PetCtInterviewRecord): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function saveClinicalDiagnosis(clinicalDiagnosis: string): void {
  const base = getWorkflowCase();
  const updated: PetCtInterviewRecord = {
    ...base,
    interview_info: {
      ...base.interview_info,
      clinical_diagnosis: clinicalDiagnosis,
      nodule_diagnosis: clinicalDiagnosis,
    },
    research_extensions: {
      ...base.research_extensions,
      primary_disease_name: clinicalDiagnosis,
    },
  };
  saveWorkflowCase(updated);
}

/** 将第 1 步解析成功的 DICOM/JSON 病例与临床诊断合并 */
export function mergeIngestedCase(parsed: Record<string, unknown>, clinicalDiagnosis: string): PetCtInterviewRecord {
  const base = buildPathologyBaseCase(clinicalDiagnosis);
  const pbi = (parsed.patient_base_info as Record<string, unknown>) || {};
  const iv = (parsed.interview_info as Record<string, unknown>) || {};
  const rx = (parsed.research_extensions as Record<string, unknown>) || {};

  const hasPet =
    Boolean(rx.pet_ct_report_narrative) ||
    Boolean(rx.imaging_report_text) ||
    (parsed.patient_base_info as { exam_item?: string })?.exam_item?.includes?.("PET");

  const merged: PetCtInterviewRecord = {
    ...base,
    patient_base_info: { ...base.patient_base_info, ...(pbi as PetCtInterviewRecord["patient_base_info"]) },
    interview_info: {
      ...base.interview_info,
      ...(iv as PetCtInterviewRecord["interview_info"]),
      clinical_diagnosis: clinicalDiagnosis || (iv.clinical_diagnosis as string) || base.interview_info.clinical_diagnosis,
    },
    research_extensions: {
      ...base.research_extensions,
      ...(rx as PetCtInterviewRecord["research_extensions"]),
      primary_disease_name: clinicalDiagnosis || base.research_extensions?.primary_disease_name,
      // 无 PET 数据时清空代谢字段，避免误显示 SUV
      ...(hasPet
        ? {}
        : {
            pet_ct_report_narrative: "",
            imaging_report_text: "",
            lesions: [],
            global_quant: { suv_max: null, suv_mean: null, mtv: null, tlg: null },
            pet_ct_phenotype_tags: [],
          }),
    },
  };
  saveWorkflowCase(merged);
  return merged;
}

export function getWorkflowCase(): PetCtInterviewRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PetCtInterviewRecord;
      // 丢弃旧版发热待查/PET 演示缓存，避免误显示
      const code = parsed.research_extensions?.primary_disease_code;
      const dx = parsed.interview_info?.clinical_diagnosis || "";
      if (code === "FUO" || dx.includes("发热待查")) {
        return buildPathologyBaseCase(dx.replace(/发热待查.*/, "卵巢肿物，待病理学分级明确"));
      }
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return buildPathologyBaseCase();
}
