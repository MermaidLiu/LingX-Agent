"""Platform UI API schemas (aligned with frontend mock types)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.domain import PetCtInterviewRecord


class DiagnosisProbability(BaseModel):
    label: str
    pct: int


class PlatformDiagnosisResult(BaseModel):
    title: str
    confidence: float
    staging: str
    evidence: list[str] = Field(default_factory=list)
    probabilities: list[DiagnosisProbability] = Field(default_factory=list)
    prognosis: dict[str, str] = Field(default_factory=dict)


class PlatformPatientRow(BaseModel):
    id: str
    name: str
    gender: str
    age: int
    diagnosis: str
    stage: str
    gene: str
    enrolledAt: str
    department: str
    physician: str
    smoking: str
    ecog: str
    chiefComplaint: str
    pastHistory: str
    familyHistory: str
    admissionId: str
    admissionTime: str
    gradeLabel: str = "—"
    followUpStatus: str = "—"


class PlatformImagingRow(BaseModel):
    id: str
    patientId: str
    patientName: str
    modality: str
    examItem: str
    examDate: str
    bodyPart: str
    suvMax: float | None = None
    mtv: float | None = None
    tlg: float | None = None
    lesionCount: int = 0
    dicomCount: int = 0
    hasPet: bool = False
    reportSummary: str = ""
    reportText: str = ""
    status: Literal["已归档", "待审核", "解析中"] = "已归档"
    hasAnnotatedImage: bool = False


class PlatformPathologyRow(BaseModel):
    id: str
    patientId: str
    patientName: str
    sampleSite: str = "—"
    stainType: str = "影像 AI 分析"
    gradeLabel: str = "—"
    whoGrade: str = "—"
    ki67: str = "—"
    p53: str = "—"
    pmpSubtype: str = "—"
    slideCount: int = 0
    reportDate: str = ""
    pathologist: str = "AI 影像诊断"
    summary: str = ""
    confidence: float | None = None
    dicomCount: int = 0
    status: Literal["已签发", "待复核", "制片中"] = "已签发"
    hasAnnotatedImage: bool = False


class AnalysisIntentBody(BaseModel):
    question: str = ""
    variables: str = ""
    outcome: str = ""
    notes: str = ""


class PathologyImagingGradeResult(BaseModel):
    status: str = ""
    message: str = ""
    grade_label: str = ""
    confidence: float | None = None
    result_image_base64: str = ""
    dicom_count: int = 0
    raw: dict[str, Any] = Field(default_factory=dict)
    exam_id: str = ""
    saved: bool = False
    annotation_dataset_id: str = ""
    annotation_slice_count: int = 0
    annotation_slices_with_mask: int = 0


class AnnotationDatasetSummary(BaseModel):
    dataset_id: str
    session_id: str = ""
    exam_id: str = ""
    created_at: str = ""
    slice_count: int = 0
    slices_with_mask: int = 0
    total_lesion_pixels: int = 0


class PlatformChatAnalyzeResponse(BaseModel):
    diagnosis: PlatformDiagnosisResult
    record: PetCtInterviewRecord
    fusion_summary: str = ""
    ingest_notes: list[str] = Field(default_factory=list)
    pathology_imaging_status: str = ""
    pathology_imaging: PathologyImagingGradeResult | None = None
    ai_reply: str = ""
    llm_model: str = ""
    llm_used: bool = False


class PathologySaveRequest(BaseModel):
    result: PathologyImagingGradeResult
    uploaded_file_names: list[str] = Field(default_factory=list)


class PublicationTopicRow(BaseModel):
    title: str
    status: str
    note: str = ""
    relevance: int = 0


class PlatformPublicationTopicsResponse(BaseModel):
    existing_topics: list[PublicationTopicRow] = Field(default_factory=list)
    novel_topics: list[PublicationTopicRow] = Field(default_factory=list)
    summary: str = ""


class PptSlideOut(BaseModel):
    page: int
    title: str
    bullets: list[str] = Field(default_factory=list)


class PlatformPptGenerateBody(BaseModel):
    scenario: Literal["leadership", "academic", "government"] = "academic"
    title: str = ""
    pathology_grade: str = ""
    dicom_count: int = 0
    radiomics_summary: str = ""
    template_filename: str = ""


class PlatformPptGenerateResponse(BaseModel):
    scenario: str
    title: str
    slides: list[PptSlideOut] = Field(default_factory=list)
    template_note: str = ""


class PlatformSaveResponse(BaseModel):
    ok: bool
    patient: PlatformPatientRow
    exam_id: str


class ResearchResultRowOut(BaseModel):
    factor: str
    metric: str
    pValue: str
    note: str
    weight: float | None = None


class PlatformResearchRunBody(BaseModel):
    module: Literal["clinical", "imaging", "multimodal"]
    task_id: str
    fields: list[str] = Field(default_factory=list)
    inclusion: str = ""
    exclusion: str = ""
    outcome: str = ""
    indicators: dict[str, str] = Field(default_factory=dict)
    workflow_context: dict[str, Any] = Field(default_factory=dict)


class PlatformResearchRunResponse(BaseModel):
    module: str
    task_id: str
    task_title: str
    rows: list[ResearchResultRowOut]
    summary: str
    n: int
    auc: float | None = None
    c_index: float | None = None
    pathology_imaging_pending: bool = False
    pathology_imaging: PathologyImagingGradeResult | None = None


class KnowledgeLiteratureOut(BaseModel):
    id: str
    title: str
    source: str
    year: str
    doi: str
    pmid: str
    relevance: int


class AnswerPointOut(BaseModel):
    text: str
    refs: list[int]


class PlatformKnowledgeSearchBody(BaseModel):
    query: str
    sources: list[str] = Field(default_factory=list)


class PlatformKnowledgeSearchResponse(BaseModel):
    query: str
    hit_count: int
    literature: list[KnowledgeLiteratureOut]
    answer_points: list[AnswerPointOut]
    stats: dict[str, int]


class PlatformKnowledgeGenerateBody(BaseModel):
    doc_type: Literal["review", "paper", "grant", "ppt"]
    query: str
    literature_ids: list[str] = Field(default_factory=list)


class PlatformKnowledgeGenerateResponse(BaseModel):
    doc_type: str
    title: str
    content: str
