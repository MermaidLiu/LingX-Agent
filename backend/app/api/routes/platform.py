"""Platform UI REST API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.domain import PetCtInterviewRecord
from app.models.platform_schemas import (
    AnalysisIntentBody,
    AnnotationDatasetSummary,
    PathologyImagingGradeResult,
    PathologySaveRequest,
    PlatformChatAnalyzeResponse,
    ClinicalDatasetAnalyzeBody,
    ClinicalDatasetAnalyzeResponse,
    PlatformDiagnosisResult,
    PciScoreResult,
    PlatformImagingRow,
    PlatformKnowledgeGenerateBody,
    PlatformKnowledgeGenerateResponse,
    PlatformKnowledgeSearchBody,
    PlatformKnowledgeSearchResponse,
    PlatformPathologyRow,
    PlatformPatientRow,
    PlatformPptGenerateBody,
    PlatformPptGenerateResponse,
    PlatformPublicationTopicsResponse,
    PlatformResearchRunBody,
    PlatformResearchRunResponse,
    PlatformSaveResponse,
)
from app.repositories import pet_ct_case
from app.services.pathology_imaging_client import predict_grade_from_imaging
from app.services.platform_adapters import (
    build_diagnosis,
    record_to_imaging_row,
    record_to_pathology_row,
    record_to_patient_row,
)
from app.services.platform_imaging_persist import persist_pathology_imaging_result
from app.services.platform_annotation_dataset import (
    build_annotation_zip,
    list_annotation_datasets,
    load_annotation_manifest,
    save_annotation_dataset_from_api,
)
from app.services.pci_scoring_client import predict_pci_after_segmentation, predict_pci_score, try_parse_pci_from_manifest
from app.services.platform_analysis import analyze_chat_uploads
from app.services.platform_knowledge import generate_document, search_knowledge
from app.services.platform_research import run_research_task
from app.services.platform_research_outputs import generate_publication_topics, generate_ppt_content

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
    save_to_db: bool = Form(False),
    save_annotation_dataset: bool = Form(True),
    run_pci: bool = Form(True),
    dcm_path: str = Form(""),
    db: Session = Depends(get_db),
) -> PathologyImagingGradeResult:
    """Upload DICOM → CT segmentation → optional PCI scoring."""
    file_items: list[tuple[str, bytes]] = []
    upload_names: list[str] = []
    for uf in files:
        name = uf.filename or "upload.dcm"
        upload_names.append(name)
        file_items.append((name, await uf.read()))
    raw = await predict_grade_from_imaging(file_items, return_base64=return_base64)
    api_payload = raw.pop("_api_payload", None)
    raw_payload = raw.get("raw") if isinstance(raw.get("raw"), dict) else {}

    exam_id = ""
    saved = False
    if save_to_db and raw.get("status") == "ok":
        try:
            saved_record = await persist_pathology_imaging_result(db, raw, file_items=file_items)
            if saved_record is not None:
                exam_id = saved_record.patient_base_info.exam_id
                saved = True
        except Exception:
            saved = False

    annotation_dataset_id = ""
    annotation_slice_count = 0
    annotation_slices_with_mask = 0
    if save_annotation_dataset and raw.get("status") == "ok" and isinstance(api_payload, dict):
        try:
            ann = save_annotation_dataset_from_api(
                api_payload,
                file_items,
                exam_id=exam_id,
                session_id=str(api_payload.get("sessionId") or ""),
            )
            annotation_dataset_id = str(ann.get("dataset_id") or "")
            annotation_slice_count = int(ann.get("slice_count") or 0)
            annotation_slices_with_mask = int(ann.get("slices_with_mask") or 0)
            extra = (
                f"已保存 {annotation_slice_count} 层标注数据（{annotation_slices_with_mask} 层含病灶 mask）"
            )
            raw["message"] = f"{raw.get('message', '')} · {extra}".strip(" ·")
            if isinstance(raw_payload, dict):
                raw_payload["annotation_dataset"] = ann
        except Exception as exc:
            err = f"标注数据集保存失败：{exc}"
            raw["message"] = f"{raw.get('message', '')} · {err}".strip(" ·")

    pci_result: dict[str, Any] | None = None
    segmentation_done = raw.get("status") == "ok" and isinstance(api_payload, dict)
    if run_pci and segmentation_done:
        try:
            pci_result = await predict_pci_after_segmentation(
                api_payload,
                exam_id="",
                dcm_path_override=dcm_path.strip(),
                upload_names=upload_names,
                segmentation_complete=True,
            )
            if pci_result.get("status") == "ok":
                raw["message"] = f"{raw.get('message', '')} · {pci_result.get('message', '')}".strip(" ·")
                if pci_result.get("pci_score") is not None and not raw.get("grade_label"):
                    raw["grade_label"] = f"PCI {pci_result['pci_score']}/36"
            elif pci_result.get("status") == "pending":
                raw["message"] = f"{raw.get('message', '')} · {pci_result.get('message', '')}".strip(" ·")
            elif pci_result.get("status") not in ("skipped",):
                raw["message"] = f"{raw.get('message', '')} · PCI：{pci_result.get('message', '')}".strip(" ·")
            elif pci_result.get("status") == "skipped":
                raw["message"] = f"{raw.get('message', '')} · {pci_result.get('message', '')}".strip(" ·")
            if isinstance(raw_payload, dict) and pci_result:
                raw_payload["pci"] = pci_result
                raw_payload["pci_paths_tried"] = pci_result.get("paths_tried", [])
                if api_payload.get("sessionId"):
                    raw_payload["sessionId"] = api_payload.get("sessionId")
        except Exception as exc:
            raw["message"] = f"{raw.get('message', '')} · PCI 调用异常：{exc}".strip(" ·")
            pci_result = {
                "status": "error",
                "message": str(exc),
                "pci_score": None,
                "regions": [],
                "raw": {},
            }
            if isinstance(raw_payload, dict):
                raw_payload["pci"] = pci_result

    return PathologyImagingGradeResult(
        status=str(raw.get("status", "")),
        message=str(raw.get("message", "")),
        grade_label=str(raw.get("grade_label", "")),
        confidence=raw.get("confidence"),
        result_image_base64=str(raw.get("result_image_base64", "")),
        dicom_count=int(raw.get("dicom_count") or 0),
        raw=raw_payload,
        exam_id=exam_id,
        saved=saved,
        annotation_dataset_id=annotation_dataset_id,
        annotation_slice_count=annotation_slice_count,
        annotation_slices_with_mask=annotation_slices_with_mask,
        pci=PciScoreResult.model_validate(pci_result) if pci_result else None,
    )


@router.post("/pathology/pci", response_model=PciScoreResult)
async def platform_pathology_pci(body: dict[str, Any]) -> PciScoreResult:
    """Direct PCI scoring when DICOM directory path is already known on server."""
    dcm_path = str(body.get("dcm_path") or body.get("dcmPath") or "").strip()
    if not dcm_path:
        raise HTTPException(status_code=400, detail="dcm_path 不能为空")
    result = await predict_pci_score(dcm_path)
    return PciScoreResult.model_validate(result)


@router.post("/pathology/pci/retry", response_model=PciScoreResult)
async def platform_pathology_pci_retry(body: dict[str, Any]) -> PciScoreResult:
    """Retry PCI after segmentation when only session / dataset id is known."""
    session_id = str(body.get("session_id") or body.get("sessionId") or "").strip()
    exam_id = str(body.get("exam_id") or body.get("examId") or "").strip()
    dcm_path = str(body.get("dcm_path") or body.get("dcmPath") or "").strip()
    dataset_id = str(body.get("annotation_dataset_id") or body.get("dataset_id") or "").strip()
    if dcm_path:
        result = await predict_pci_after_segmentation(
            {},
            dcm_path_override=dcm_path,
            segmentation_complete=True,
        )
        return PciScoreResult.model_validate(result)
    if dataset_id:
        try:
            manifest = load_annotation_manifest(dataset_id)
            session_id = session_id or str(manifest.get("session_id") or "")
            exam_id = exam_id or str(manifest.get("exam_id") or "")
            manifest_pci = try_parse_pci_from_manifest(manifest)
            if manifest_pci:
                return PciScoreResult.model_validate(manifest_pci)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not session_id and not exam_id:
        raise HTTPException(status_code=400, detail="需要 session_id、annotation_dataset_id 或 dcm_path")
    ct_payload: dict[str, Any] = {}
    if session_id:
        ct_payload["sessionId"] = session_id
    upload_names = body.get("upload_names") or body.get("uploadNames")
    names = [str(x) for x in upload_names] if isinstance(upload_names, list) else None
    result = await predict_pci_after_segmentation(
        ct_payload,
        exam_id=exam_id,
        upload_names=names,
        segmentation_complete=True,
    )
    return PciScoreResult.model_validate(result)


@router.get("/pathology/annotation-datasets", response_model=list[AnnotationDatasetSummary])
def platform_list_annotation_datasets() -> list[AnnotationDatasetSummary]:
    return [AnnotationDatasetSummary.model_validate(x) for x in list_annotation_datasets()]


@router.get("/pathology/annotation-datasets/{dataset_id}")
def platform_get_annotation_dataset(dataset_id: str) -> dict[str, Any]:
    try:
        return load_annotation_manifest(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/pathology/annotation-datasets/{dataset_id}/download")
def platform_download_annotation_dataset(dataset_id: str) -> FileResponse:
    try:
        zip_path = build_annotation_zip(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=f"{dataset_id}_annotations.zip",
    )


@router.get("/pathology", response_model=list[PlatformPathologyRow])
def platform_list_pathology(keyword: str = "", db: Session = Depends(get_db)) -> list[PlatformPathologyRow]:
    rows = pet_ct_case.list_all(db, limit=500)
    out: list[PlatformPathologyRow] = []
    for r in rows:
        item = record_to_pathology_row(pet_ct_case.orm_to_record(r))
        if item:
            out.append(item)
    k = keyword.strip().lower()
    if k:
        out = [
            x
            for x in out
            if k in x.id.lower()
            or k in x.patientName.lower()
            or k in x.summary.lower()
            or k in x.gradeLabel.lower()
        ]
    return out


@router.post("/pathology/save", response_model=PlatformSaveResponse)
async def platform_pathology_save(body: PathologySaveRequest, db: Session = Depends(get_db)) -> PlatformSaveResponse:
    """Save analysis result to pathology + imaging databases after user confirms."""
    raw = body.result.model_dump()
    saved = await persist_pathology_imaging_result(
        db,
        raw,
        uploaded_file_names=body.uploaded_file_names,
    )
    if saved is None:
        raise HTTPException(status_code=400, detail="仅成功的分析结果可入库")
    patient = record_to_patient_row(saved)
    return PlatformSaveResponse(ok=True, patient=patient, exam_id=saved.patient_base_info.exam_id)


@router.post("/research/publication-topics", response_model=PlatformPublicationTopicsResponse)
def platform_publication_topics(context: dict[str, Any]) -> PlatformPublicationTopicsResponse:
    return generate_publication_topics(context)


@router.post("/research/ppt-generate", response_model=PlatformPptGenerateResponse)
def platform_ppt_generate(body: PlatformPptGenerateBody) -> PlatformPptGenerateResponse:
    return generate_ppt_content(body)


@router.post("/research/grade-run", response_model=PlatformResearchRunResponse)
async def platform_research_grade_run(
    module: str = Form("imaging"),
    task_id: str = Form("grade-pred"),
    files: list[UploadFile] = File(default=[]),
    inclusion: str = Form(""),
    exclusion: str = Form(""),
    outcome: str = Form(""),
    indicators_json: str = Form("{}"),
    workflow_context_json: str = Form("{}"),
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
    try:
        workflow_context = json.loads(workflow_context_json) if workflow_context_json else {}
    except json.JSONDecodeError:
        workflow_context = {}
    body = PlatformResearchRunBody(
        module=mod,  # type: ignore[arg-type]
        task_id=task_id,
        inclusion=inclusion,
        exclusion=exclusion,
        outcome=outcome,
        indicators=indicators,
        workflow_context=workflow_context,
    )
    return await run_research_task(db, body, dicom_files=file_items or None)


@router.post("/research/radiomics-run", response_model=PlatformResearchRunResponse)
async def platform_radiomics_run(
    files: list[UploadFile] = File(default=[]),
    target_field: str = Form("病理分级"),
    target_value: str = Form("高级别"),
    roi_defined: bool = Form(True),
    use_annotated_image: bool = Form(False),
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
    if use_annotated_image:
        indicators["annotated_image_roi"] = "true"
    return run_radiomics_analysis(
        filenames=names or (["annotated_lesion.png"] if use_annotated_image else []),
        target_field=target_field,
        target_value=target_value,
        roi_defined=roi_defined or use_annotated_image,
        indicators=indicators,
    )


@router.post("/knowledge/search", response_model=PlatformKnowledgeSearchResponse)
def platform_knowledge_search(body: PlatformKnowledgeSearchBody) -> PlatformKnowledgeSearchResponse:
    return search_knowledge(body)


@router.post("/knowledge/generate", response_model=PlatformKnowledgeGenerateResponse)
def platform_knowledge_generate(body: PlatformKnowledgeGenerateBody) -> PlatformKnowledgeGenerateResponse:
    return generate_document(body)


@router.post("/clinical-dataset/analyze", response_model=ClinicalDatasetAnalyzeResponse)
def platform_clinical_dataset_analyze(body: ClinicalDatasetAnalyzeBody) -> ClinicalDatasetAnalyzeResponse:
    from app.services.platform_clinical_dataset_stats import analyze_clinical_dataset

    try:
        result = analyze_clinical_dataset(body.model_dump())
        rows = result.pop("rows", [])
        summary = result.pop("summary", "")
        return ClinicalDatasetAnalyzeResponse(
            ok=True,
            analysis=body.analysis,
            summary=summary,
            rows=rows if isinstance(rows, list) else [],
            extra=result,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败：{e}") from e


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db)) -> dict[str, Any]:
    rows = pet_ct_case.list_all(db, limit=5000)
    imaging_n = sum(1 for r in rows if record_to_imaging_row(pet_ct_case.orm_to_record(r)))
    return {
        "patients": len(rows),
        "imaging": imaging_n,
        "dicom_estimate": imaging_n * 400,
    }
