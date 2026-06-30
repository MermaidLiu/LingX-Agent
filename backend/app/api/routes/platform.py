"""Platform UI REST API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.domain import PetCtInterviewRecord
from app.models.platform_schemas import (
    AnalysisIntentBody,
    PathologyImagingGradeResult,
    PlatformChatAnalyzeResponse,
    PlatformDiagnosisResult,
    PlatformImagingRow,
    PlatformKnowledgeGenerateBody,
    PlatformKnowledgeGenerateResponse,
    PlatformKnowledgeSearchBody,
    PlatformKnowledgeSearchResponse,
    PlatformPatientRow,
    PlatformResearchRunBody,
    PlatformResearchRunResponse,
    PlatformSaveResponse,
)
from app.repositories import pet_ct_case
from app.services.pathology_imaging_client import predict_grade_from_imaging
from app.services.platform_adapters import (
    build_diagnosis,
    record_to_imaging_row,
    record_to_patient_row,
)
from app.services.platform_analysis import analyze_chat_uploads
from app.services.platform_knowledge import generate_document, search_knowledge
from app.services.platform_research import run_research_task

router = APIRouter()


@router.post("/chat/analyze", response_model=PlatformChatAnalyzeResponse)
async def platform_chat_analyze(
    files: list[UploadFile] = File(default=[]),
    question: str = Form(""),
    variables: str = Form(""),
    outcome: str = Form(""),
    notes: str = Form(""),
) -> PlatformChatAnalyzeResponse:
    intent = AnalysisIntentBody(question=question, variables=variables, outcome=outcome, notes=notes)
    file_items: list[tuple[str, bytes]] = []
    for uf in files:
        content = await uf.read()
        file_items.append((uf.filename or "upload", content))
    return await analyze_chat_uploads(file_items, intent)


@router.post("/chat/save", response_model=PlatformSaveResponse)
def platform_chat_save(body: PetCtInterviewRecord, db: Session = Depends(get_db)) -> PlatformSaveResponse:
    if not body.patient_base_info.exam_id:
        raise HTTPException(status_code=400, detail="exam_id 不能为空")
    pet_ct_case.upsert_case(db, body)
    patient = record_to_patient_row(body)
    return PlatformSaveResponse(ok=True, patient=patient, exam_id=body.patient_base_info.exam_id)


@router.get("/diagnosis/demo", response_model=PlatformDiagnosisResult)
def platform_diagnosis_demo(db: Session = Depends(get_db)) -> PlatformDiagnosisResult:
    rows = pet_ct_case.list_all(db, limit=1)
    if not rows:
        raise HTTPException(status_code=404, detail="暂无病例，请先完成智能对话分析并入库")
    rec = pet_ct_case.orm_to_record(rows[0])
    return build_diagnosis(rec)


@router.get("/patients", response_model=list[PlatformPatientRow])
def platform_list_patients(
    keyword: str = "",
    db: Session = Depends(get_db),
) -> list[PlatformPatientRow]:
    rows = pet_ct_case.list_all(db, limit=500)
    patients = [record_to_patient_row(pet_ct_case.orm_to_record(r)) for r in rows]
    k = keyword.strip().lower()
    if not k:
        return patients
    return [
        p
        for p in patients
        if k in p.id.lower()
        or k in p.name.lower()
        or k in (p.diagnosis or "").lower()
        or k in (p.department or "").lower()
    ]


@router.get("/imaging", response_model=list[PlatformImagingRow])
def platform_list_imaging(
    keyword: str = "",
    modality: str = "",
    db: Session = Depends(get_db),
) -> list[PlatformImagingRow]:
    rows = pet_ct_case.list_all(db, limit=500)
    imaging: list[PlatformImagingRow] = []
    for r in rows:
        item = record_to_imaging_row(pet_ct_case.orm_to_record(r))
        if item:
            imaging.append(item)
    k = keyword.strip().lower()
    m = modality.strip()
    out = imaging
    if k:
        out = [
            x
            for x in out
            if k in x.id.lower()
            or k in x.patientName.lower()
            or k in x.patientId.lower()
            or k in x.reportSummary.lower()
        ]
    if m:
        if m == "MR":
            out = [x for x in out if x.modality in ("MR", "MRI")]
        else:
            out = [x for x in out if x.modality == m]
    return out


@router.get("/imaging/{exam_id}", response_model=PlatformImagingRow)
def platform_get_imaging(exam_id: str, db: Session = Depends(get_db)) -> PlatformImagingRow:
    row = pet_ct_case.get_by_exam_id(db, exam_id)
    if row is None:
        raise HTTPException(status_code=404, detail="影像记录不存在")
    item = record_to_imaging_row(pet_ct_case.orm_to_record(row))
    if item is None:
        raise HTTPException(status_code=404, detail="该病例无影像数据")
    return item


@router.post("/research/run", response_model=PlatformResearchRunResponse)
async def platform_research_run(
    body: PlatformResearchRunBody,
    db: Session = Depends(get_db),
) -> PlatformResearchRunResponse:
    return await run_research_task(db, body)


@router.post("/pathology/grade", response_model=PathologyImagingGradeResult)
async def platform_pathology_grade(
    files: list[UploadFile] = File(...),
    return_base64: bool = Form(True),
) -> PathologyImagingGradeResult:
    """Upload DICOM to classmate pathology grading service."""
    file_items: list[tuple[str, bytes]] = []
    for uf in files:
        file_items.append((uf.filename or "upload.dcm", await uf.read()))
    raw = await predict_grade_from_imaging(file_items, return_base64=return_base64)
    return PathologyImagingGradeResult(
        status=str(raw.get("status", "")),
        message=str(raw.get("message", "")),
        grade_label=str(raw.get("grade_label", "")),
        confidence=raw.get("confidence"),
        result_image_base64=str(raw.get("result_image_base64", "")),
        dicom_count=int(raw.get("dicom_count") or 0),
    )


@router.post("/research/grade-run", response_model=PlatformResearchRunResponse)
async def platform_research_grade_run(
    module: str = Form("imaging"),
    task_id: str = Form("grade-pred"),
    files: list[UploadFile] = File(...),
    inclusion: str = Form(""),
    exclusion: str = Form(""),
    outcome: str = Form(""),
    indicators_json: str = Form("{}"),
    db: Session = Depends(get_db),
) -> PlatformResearchRunResponse:
    """Research workbench: run pathology grade prediction with DICOM upload."""
    import json

    file_items = [(uf.filename or "upload.dcm", await uf.read()) for uf in files]
    mod = module if module in ("clinical", "imaging", "multimodal") else "imaging"
    try:
        indicators = json.loads(indicators_json) if indicators_json else {}
    except json.JSONDecodeError:
        indicators = {}
    body = PlatformResearchRunBody(
        module=mod,  # type: ignore[arg-type]
        task_id=task_id,
        inclusion=inclusion,
        exclusion=exclusion,
        outcome=outcome,
        indicators=indicators,
    )
    return await run_research_task(db, body, dicom_files=file_items)


@router.post("/research/radiomics-run", response_model=PlatformResearchRunResponse)
async def platform_radiomics_run(
    files: list[UploadFile] = File(...),
    target_field: str = Form("病理分级"),
    target_value: str = Form("高级别"),
    roi_defined: bool = Form(True),
    indicators_json: str = Form("{}"),
) -> PlatformResearchRunResponse:
    from app.services.platform_radiomics import run_radiomics_analysis
    import json

    names = [uf.filename or "image.nii.gz" for uf in files]
    for uf in files:
        await uf.read()
    try:
        indicators = json.loads(indicators_json) if indicators_json else {}
    except json.JSONDecodeError:
        indicators = {}
    return run_radiomics_analysis(
        filenames=names,
        target_field=target_field,
        target_value=target_value,
        roi_defined=roi_defined,
        indicators=indicators,
    )


@router.post("/knowledge/search", response_model=PlatformKnowledgeSearchResponse)
def platform_knowledge_search(body: PlatformKnowledgeSearchBody) -> PlatformKnowledgeSearchResponse:
    return search_knowledge(body)


@router.post("/knowledge/generate", response_model=PlatformKnowledgeGenerateResponse)
def platform_knowledge_generate(body: PlatformKnowledgeGenerateBody) -> PlatformKnowledgeGenerateResponse:
    return generate_document(body)


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db)) -> dict[str, Any]:
    rows = pet_ct_case.list_all(db, limit=5000)
    imaging_n = sum(1 for r in rows if record_to_imaging_row(pet_ct_case.orm_to_record(r)))
    return {
        "patients": len(rows),
        "imaging": imaging_n,
        "dicom_estimate": imaging_n * 400,
    }
