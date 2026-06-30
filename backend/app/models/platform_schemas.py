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


class PlatformChatAnalyzeResponse(BaseModel):
    diagnosis: PlatformDiagnosisResult
    record: PetCtInterviewRecord
    fusion_summary: str = ""
    ingest_notes: list[str] = Field(default_factory=list)
    pathology_imaging_status: str = ""
    pathology_imaging: PathologyImagingGradeResult | None = None


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
