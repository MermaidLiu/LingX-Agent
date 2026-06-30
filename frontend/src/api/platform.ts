import { api, type PetCtInterviewRecord } from "./client";

export type DiagnosisProbability = { label: string; pct: number };

export type PlatformDiagnosis = {
  title: string;
  confidence: number;
  staging: string;
  evidence: string[];
  probabilities: DiagnosisProbability[];
  prognosis: Record<string, string>;
};

export type PlatformPatient = {
  id: string;
  name: string;
  gender: string;
  age: number;
  diagnosis: string;
  stage: string;
  gene: string;
  enrolledAt: string;
  department: string;
  physician: string;
  smoking: string;
  ecog: string;
  chiefComplaint: string;
  pastHistory: string;
  familyHistory: string;
  admissionId: string;
  admissionTime: string;
  gradeLabel?: string;
  followUpStatus?: string;
};

export type PlatformImagingRecord = {
  id: string;
  patientId: string;
  patientName: string;
  modality: string;
  examItem: string;
  examDate: string;
  bodyPart: string;
  suvMax: number | null;
  mtv: number | null;
  tlg: number | null;
  lesionCount: number;
  dicomCount: number;
  hasPet: boolean;
  reportSummary: string;
  reportText: string;
  status: "已归档" | "待审核" | "解析中";
};

export type AnalysisIntent = {
  question: string;
  variables: string;
  outcome: string;
  notes: string;
};

export type PathologyImagingGradeResult = {
  status: string;
  message: string;
  grade_label: string;
  confidence: number | null;
  result_image_base64: string;
  dicom_count: number;
};

export type ChatAnalyzeResult = {
  diagnosis: PlatformDiagnosis;
  record: PetCtInterviewRecord;
  fusion_summary: string;
  ingest_notes: string[];
  pathology_imaging_status: string;
  pathology_imaging?: PathologyImagingGradeResult | null;
};

export type ResearchResultRow = {
  factor: string;
  metric: string;
  pValue: string;
  note: string;
  weight?: number;
};

export type KnowledgeLiterature = {
  id: string;
  title: string;
  source: string;
  year: string;
  doi: string;
  pmid: string;
  relevance: number;
};

export type AnswerPoint = { text: string; refs: number[] };

export async function platformChatAnalyze(files: File[], intent: AnalysisIntent) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("question", intent.question);
  form.append("variables", intent.variables);
  form.append("outcome", intent.outcome);
  form.append("notes", intent.notes);
  const { data } = await api.post<ChatAnalyzeResult>("/api/v1/platform/chat/analyze", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function platformChatSave(record: PetCtInterviewRecord) {
  const { data } = await api.post<{ ok: boolean; patient: PlatformPatient; exam_id: string }>(
    "/api/v1/platform/chat/save",
    record,
  );
  return data;
}

export async function platformListPatients(keyword = "") {
  const { data } = await api.get<PlatformPatient[]>("/api/v1/platform/patients", {
    params: keyword ? { keyword } : {},
  });
  return data;
}

export async function platformListImaging(keyword = "", modality = "") {
  const { data } = await api.get<PlatformImagingRecord[]>("/api/v1/platform/imaging", {
    params: { ...(keyword ? { keyword } : {}), ...(modality ? { modality } : {}) },
  });
  return data;
}

export async function platformRunResearch(body: {
  module: "clinical" | "imaging" | "multimodal";
  task_id: string;
  fields?: string[];
  inclusion?: string;
  exclusion?: string;
  outcome?: string;
  split?: string;
  indicators?: Record<string, string>;
}) {
  const { data } = await api.post<{
    module: string;
    task_id: string;
    task_title: string;
    rows: ResearchResultRow[];
    summary: string;
    n: number;
    auc?: number;
    c_index?: number;
    pathology_imaging_pending?: boolean;
    pathology_imaging?: PathologyImagingGradeResult | null;
  }>("/api/v1/platform/research/run", body);
  return data;
}

export async function platformRadiomicsRun(
  files: File[],
  opts: { targetField: string; targetValue: string; roiDefined: boolean; indicators?: Record<string, string> },
) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("target_field", opts.targetField);
  form.append("target_value", opts.targetValue);
  form.append("roi_defined", String(opts.roiDefined));
  form.append("indicators_json", JSON.stringify(opts.indicators ?? {}));
  const { data } = await api.post<{
    rows: ResearchResultRow[];
    summary: string;
    auc?: number;
    task_title: string;
  }>("/api/v1/platform/research/radiomics-run", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300000,
  });
  return data;
}

export async function platformPathologyGrade(files: File[], returnBase64 = true) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("returnBase64", String(returnBase64));
  const { data } = await api.post<PathologyImagingGradeResult>("/api/v1/platform/pathology/grade", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300000,
  });
  return data;
}

export async function platformResearchGradeRun(
  files: File[],
  module: "clinical" | "imaging" | "multimodal",
  taskId: string,
  opts?: {
    inclusion?: string;
    exclusion?: string;
    outcome?: string;
    indicators?: Record<string, string>;
  },
) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("module", module);
  form.append("task_id", taskId);
  if (opts?.inclusion) form.append("inclusion", opts.inclusion);
  if (opts?.exclusion) form.append("exclusion", opts.exclusion);
  if (opts?.outcome) form.append("outcome", opts.outcome);
  form.append("indicators_json", JSON.stringify(opts?.indicators ?? {}));
  const { data } = await api.post<{
    module: string;
    task_id: string;
    task_title: string;
    rows: ResearchResultRow[];
    summary: string;
    n: number;
    auc?: number;
    pathology_imaging_pending?: boolean;
    pathology_imaging?: PathologyImagingGradeResult | null;
  }>("/api/v1/platform/research/grade-run", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300000,
  });
  return data;
}

export async function platformKnowledgeSearch(query: string, sources: string[] = []) {
  const { data } = await api.post<{
    query: string;
    hit_count: number;
    literature: KnowledgeLiterature[];
    answer_points: AnswerPoint[];
    stats: { hit: number; reviews: number; guidelines: number; selected: number };
  }>("/api/v1/platform/knowledge/search", { query, sources });
  return data;
}

export async function platformKnowledgeGenerate(doc_type: string, query: string, literature_ids: string[]) {
  const { data } = await api.post<{ doc_type: string; title: string; content: string }>(
    "/api/v1/platform/knowledge/generate",
    { doc_type, query, literature_ids },
  );
  return data;
}

export async function platformStats() {
  const { data } = await api.get<{ patients: number; imaging: number; dicom_estimate: number }>(
    "/api/v1/platform/stats",
  );
  return data;
}
