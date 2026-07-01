"""DeepSeek chat completions for platform smart dialogue."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.models.domain import PetCtInterviewRecord
from app.models.platform_schemas import (
    AnalysisIntentBody,
    PathologyImagingGradeResult,
    PlatformDiagnosisResult,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是 PMP（腹膜假黏液瘤）多模态科研平台的智能助手，面向临床医生与科研人员。
请基于用户提供的病例数据、影像/病理信息与分析需求，给出专业、结构清晰的中文回答。

要求：
1. 先回应用户的具体分析需求，再给出诊断/鉴别诊断要点
2. 引用已提供的客观数据（SUV、病理分级、检验等），不要编造未给出的数值
3. 使用 Markdown 小标题与列表，语气专业但易懂
4. 若信息不足，明确说明还需补充哪些检查
5. 不做最终临床决策，必要时提醒结合病理与 MDT 讨论"""


def _effective_api_key() -> str:
    return (settings.deepseek_api_key or settings.openai_api_key or "").strip()


def _effective_base_url() -> str:
    base = (settings.deepseek_base_url or settings.openai_base_url or "https://api.deepseek.com").strip()
    return base.rstrip("/")


def _effective_model() -> str:
    return (settings.deepseek_chat_model or settings.research_llm_model or "deepseek-chat").strip()


def is_deepseek_available() -> bool:
    if settings.demo_mode:
        return False
    return bool(_effective_api_key())


def _build_context(
    intent: AnalysisIntentBody,
    record: PetCtInterviewRecord,
    diagnosis: PlatformDiagnosisResult,
    fusion_summary: str,
    ingest_notes: list[str],
    pathology_imaging: PathologyImagingGradeResult | None,
) -> str:
    p = record.patient_base_info
    iv = record.interview_info
    rx = record.research_extensions
    gq = rx.global_quant

    payload: dict[str, Any] = {
        "user_question": intent.question,
        "user_notes": intent.notes,
        "patient": {
            "name": p.name,
            "age": p.age,
            "gender": p.gender,
            "department": p.department,
            "clinical_diagnosis": iv.clinical_diagnosis,
            "brief_history": iv.brief_medical_history,
        },
        "imaging": {
            "suv_max": gq.suv_max,
            "mtv": gq.mtv,
            "tlg": gq.tlg,
            "report_excerpt": (rx.pet_ct_report_narrative or rx.imaging_report_text or "")[:2000],
        },
        "pathology": {
            "grade": rx.pathology_grade,
            "confidence": rx.pathology_confidence,
            "evidence": rx.pathology_evidence,
        },
        "labs": rx.lab_snapshot,
        "structured_diagnosis": {
            "title": diagnosis.title,
            "confidence": diagnosis.confidence,
            "staging": diagnosis.staging,
            "differential": [{"label": x.label, "pct": x.pct} for x in diagnosis.probabilities],
            "evidence": diagnosis.evidence,
        },
        "fusion_summary": fusion_summary,
        "file_ingest_notes": ingest_notes,
    }

    if pathology_imaging and pathology_imaging.grade_label:
        payload["pathology_imaging_api"] = {
            "grade_label": pathology_imaging.grade_label,
            "confidence": pathology_imaging.confidence,
            "message": pathology_imaging.message,
            "dicom_count": pathology_imaging.dicom_count,
        }

    return json.dumps(payload, ensure_ascii=False, indent=2)


def format_fallback_reply(
    diagnosis: PlatformDiagnosisResult,
    intent_question: str,
    extra_notes: list[str],
) -> str:
    lines = [
        f"**首要怀疑：** {diagnosis.title}",
        f"置信度 {diagnosis.confidence * 100:.0f}% · {diagnosis.staging}",
        "",
        "**鉴别诊断：**",
        *[f"• {p.label}（{p.pct}%）" for p in diagnosis.probabilities],
        "",
        "**支持依据：**",
        *[f"• {e}" for e in diagnosis.evidence],
    ]
    for note in extra_notes:
        if note.strip():
            lines.append(f"\n> {note.strip()}")
    if intent_question:
        lines.extend(["", f"**按您的分析需求：** {intent_question}"])
    if not is_deepseek_available():
        lines.append("\n> 提示：未配置 DeepSeek API Key，当前为规则引擎结果。请在 backend/.env 设置 DEEPSEEK_API_KEY。")
    return "\n".join(lines)


async def generate_chat_reply(
    intent: AnalysisIntentBody,
    record: PetCtInterviewRecord,
    diagnosis: PlatformDiagnosisResult,
    fusion_summary: str,
    ingest_notes: list[str],
    pathology_imaging: PathologyImagingGradeResult | None,
) -> tuple[str, str, bool]:
    """Return (reply_text, model_name, used_llm)."""
    extra = [n for n in ingest_notes if n]
    if pathology_imaging and pathology_imaging.message:
        extra.append(pathology_imaging.message)

    if not is_deepseek_available():
        return format_fallback_reply(diagnosis, intent.question, extra), "rule-engine", False

    user_content = (
        f"请根据以下 JSON 上下文回答用户问题。\n\n"
        f"```json\n{_build_context(intent, record, diagnosis, fusion_summary, ingest_notes, pathology_imaging)}\n```"
    )

    url = f"{_effective_base_url()}/chat/completions"
    model = _effective_model()
    headers = {
        "Authorization": f"Bearer {_effective_api_key()}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.3,
        "max_tokens": 2048,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            raise ValueError("DeepSeek 返回空 choices")
        content = choices[0].get("message", {}).get("content", "").strip()
        if not content:
            raise ValueError("DeepSeek 返回空内容")
        return content, model, True
    except Exception as exc:
        logger.warning("DeepSeek chat failed, using fallback: %s", exc)
        fallback = format_fallback_reply(diagnosis, intent.question, extra + [f"DeepSeek 调用失败：{exc}"])
        return fallback, model, False
