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
  hasAnnotatedImage?: boolean;
};

export type PlatformPathologyRecord = {
  id: string;
  patientId: string;
  patientName: string;
  sampleSite: string;
  stainType: string;
  gradeLabel: string;
  whoGrade: string;
  ki67: string;
  p53: string;
  pmpSubtype: string;
  slideCount: number;
  reportDate: string;
  pathologist: string;
  summary: string;
  confidence?: number | null;
  dicomCount?: number;
  status: "已签发" | "待复核" | "制片中";
  hasAnnotatedImage?: boolean;
};

export type PublicationTopic = {
  title: string;
  status: string;
  note: string;
  relevance: number;
};

export type PptSlide = {
  page: number;
  title: string;
  bullets: string[];
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
  raw?: Record<string, unknown>;
  exam_id?: string;
  saved?: boolean;
  annotation_dataset_id?: string;
  annotation_slice_count?: number;
  annotation_slices_with_mask?: number;
};

export type AnnotationDatasetSummary = {
  dataset_id: string;
  session_id: string;
  exam_id: string;
  created_at: string;
  slice_count: number;
  slices_with_mask: number;
  total_lesion_pixels: number;
};

export type ChatAnalyzeResult = {
  diagnosis: PlatformDiagnosis;
  record: PetCtInterviewRecord;
  fusion_summary: string;
  ingest_notes: string[];
  pathology_imaging_status: string;
  pathology_imaging?: PathologyImagingGradeResult | null;
  ai_reply?: string;
  llm_model?: string;
  llm_used?: boolean;
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
  workflow_context?: Record<string, unknown>;
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
  opts: {
    targetField: string;
    targetValue: string;
    roiDefined: boolean;
    useAnnotatedImage?: boolean;
    indicators?: Record<string, string>;
  },
) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("target_field", opts.targetField);
  form.append("target_value", opts.targetValue);
  form.append("roi_defined", String(opts.roiDefined));
  form.append("use_annotated_image", String(Boolean(opts.useAnnotatedImage)));
  form.append("indicators_json", JSON.stringify(opts.indicators ?? {}));
  const { data } = await api.post<{
    rows: ResearchResultRow[];
    summary: string;
    auc?: number;
    task_title: string;
  }>("/api/v1/platform/research/radiomics-run", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 480000,
  });
  return data;
}

export async function platformPathologyGrade(
  files: File[],
  opts?: { returnBase64?: boolean; saveToDb?: boolean; saveAnnotationDataset?: boolean },
) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("returnBase64", String(opts?.returnBase64 ?? true));
  form.append("save_to_db", String(opts?.saveToDb ?? false));
  form.append("save_annotation_dataset", String(opts?.saveAnnotationDataset ?? true));
  const { data } = await api.post<PathologyImagingGradeResult>("/api/v1/platform/pathology/grade", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 480000,
  });
  return data;
}

export async function platformListAnnotationDatasets() {
  const { data } = await api.get<AnnotationDatasetSummary[]>("/api/v1/platform/pathology/annotation-datasets");
  return data;
}

export function platformAnnotationDatasetDownloadUrl(datasetId: string) {
  return `/api/v1/platform/pathology/annotation-datasets/${encodeURIComponent(datasetId)}/download`;
}

/** Blob download — avoids SPA href/new-tab issues and shows errors in UI. */
export async function platformDownloadAnnotationDataset(datasetId: string): Promise<void> {
  const response = await api.get<Blob>(platformAnnotationDatasetDownloadUrl(datasetId), {
    responseType: "blob",
    timeout: 600_000,
  });
  const blob = response.data;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${datasetId}_annotations.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
    workflow_context?: Record<string, unknown>;
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
  form.append("workflow_context_json", JSON.stringify(opts?.workflow_context ?? {}));
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
    timeout: 480000,
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

export async function platformListPathology(keyword = "") {
  const { data } = await api.get<PlatformPathologyRecord[]>("/api/v1/platform/pathology", {
    params: keyword ? { keyword } : {},
  });
  return data;
}

export async function platformSavePathologyAnalysis(
  result: PathologyImagingGradeResult,
  uploadedFileNames: string[] = [],
) {
  const { data } = await api.post<{ ok: boolean; patient: PlatformPatient; exam_id: string }>(
    "/api/v1/platform/pathology/save",
    { result, uploaded_file_names: uploadedFileNames },
  );
  return data;
}

export async function platformPublicationTopics(context: Record<string, unknown>) {
  const { data } = await api.post<{
    existing_topics: PublicationTopic[];
    novel_topics: PublicationTopic[];
    summary: string;
  }>("/api/v1/platform/research/publication-topics", context);
  return data;
}

export async function platformPptGenerate(body: {
  scenario: "leadership" | "academic" | "government";
  title: string;
  pathology_grade?: string;
  dicom_count?: number;
  radiomics_summary?: string;
  template_filename?: string;
}) {
  const { data } = await api.post<{
    scenario: string;
    title: string;
    slides: PptSlide[];
    template_note: string;
  }>("/api/v1/platform/research/ppt-generate", body);
  return data;
}

export async function platformStats() {
  const { data } = await api.get<{ patients: number; imaging: number; dicom_estimate: number }>(
    "/api/v1/platform/stats",
  );
  return data;
}
