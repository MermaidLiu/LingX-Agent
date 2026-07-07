"""Clinical care pathway: imaging report from CT API + DeepSeek treatment suggestions."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import settings
from app.models.domain import PetCtInterviewRecord
from app.models.platform_schemas import PathologyImagingGradeResult
from app.services.pathology_grader import _TREATMENT_BY_GRADE, infer_histologic_grade_label, recommend_literature

logger = logging.getLogger(__name__)

GUIDELINE_REFS = [
    "UpToDate 临床决策",
    "中国肿瘤临床",
    "中华胃肠外科杂志",
    "消化肿瘤杂志（电子版）",
    "CSCO 诊疗指南",
]

TREATMENT_SYSTEM_PROMPT = """你是腹膜假粘液瘤（PMP）及腹膜肿瘤多学科临床路径助手。
请根据 CT 合并接口返回的 PCI/病理结论与临床信息，给出中文治疗建议。

要求：
1. 输出 4–6 条独立建议，每条一行，不要编号，不要 Markdown 标题
2. 语气简洁、专业，类似临床路径条目，例如：
   评估手术范围：低级别病变可考虑保留器官功能的保守性手术
   低级别浆液性癌/交界性肿瘤：以手术为主，化疗获益有限，需个体化评估
   定期随访：每 6 个月影像及标志物监测，关注进展为高级别的信号
3. 参考 UpToDate 临床决策支持、中国肿瘤临床、中华胃肠外科杂志、消化肿瘤杂志（电子版）及 CSCO 原则；grade_label 必须与 api_conclusion 中的病理分级一致（PCI 总分不代表组织学分级），不要编造具体未提供的检验数值
4. 不做最终临床决策；必要时提醒 MDT 讨论
5. 仅输出 JSON：{"recommendations":["...","..."],"mdt_recommended":true/false,"grade_label":"高级别|低级别|未确定"}"""


def _deepseek_key() -> str:
    return (settings.deepseek_api_key or settings.openai_api_key or "").strip()


def _deepseek_base() -> str:
    return (settings.deepseek_base_url or "https://api.deepseek.com").strip().rstrip("/")


def _deepseek_model() -> str:
    return (settings.deepseek_chat_model or "deepseek-chat").strip()


def _get_pci_block(imaging: PathologyImagingGradeResult) -> dict[str, Any]:
    if imaging.pci:
        return imaging.pci.model_dump(mode="json")
    raw = imaging.raw or {}
    pci = raw.get("pci")
    return pci if isinstance(pci, dict) else {}


def _api_conclusion(imaging: PathologyImagingGradeResult, pci: dict[str, Any]) -> str:
    for source in (pci, imaging.raw or {}):
        if not isinstance(source, dict):
            continue
        for key in ("conclusion", "report", "pathologyReport", "pathology_report", "summary", "diagnosis"):
            val = source.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
    msg = imaging.message or ""
    for part in msg.split(" · "):
        if any(k in part for k in ("结论", "病理分级", "检测结果", "PCI")):
            return part.strip()
    return msg.split(" · ")[0].strip() if msg else "接口未返回文字结论，请查看 PCI 评分与分割结果。"


def _infer_grade(imaging: PathologyImagingGradeResult, pci: dict[str, Any], record: PetCtInterviewRecord) -> str:
    conclusion = _api_conclusion(imaging, pci)
    rx = record.research_extensions
    return infer_histologic_grade_label(
        conclusion,
        str(pci.get("conclusion") or ""),
        imaging.grade_label or "",
        rx.pathology_grade if rx else "",
        imaging.message or "",
    )


def build_imaging_report_text(
    imaging: PathologyImagingGradeResult,
    record: PetCtInterviewRecord,
) -> str:
    pci = _get_pci_block(imaging)
    conclusion = _api_conclusion(imaging, pci)
    iv = record.interview_info
    rx = record.research_extensions
    lab = rx.lab_snapshot or {}

    lines = [
        "【影像分析报告】",
        "来源：CT 合并接口（分割 + PCI）",
        "",
        conclusion,
        "",
    ]
    if pci.get("pci_score") is not None:
        lines.append(f"PCI 总分：{pci.get('pci_score')}/36")
    if pci.get("is_positive") is not None:
        rate = pci.get("positive_rate")
        rate_txt = ""
        if rate is not None:
            rate_txt = f"（阳性概率 {float(rate) * 100 if float(rate) <= 1 else float(rate):.0f}%）"
        lines.append(f"PCI 阴阳性：{'阳性' if pci.get('is_positive') else '阴性'}{rate_txt}")
    if imaging.dicom_count:
        lines.append(f"DICOM 层数：{imaging.dicom_count}")
    if iv.clinical_diagnosis:
        lines.append(f"临床诊断：{iv.clinical_diagnosis}")
    lab_parts = [
        f"{k} {v}"
        for k, v in lab.items()
        if v and k in ("CEA", "CA125", "CA19-9", "TNM分期", "治疗方式", "第几次手术", "是否静脉化疗", "CC评分")
    ]
    if lab_parts:
        lines.append("临床/实验室：" + " · ".join(lab_parts))
    return "\n".join(lines)


def _parse_recommendation_lines(text: str) -> list[str]:
    lines: list[str] = []
    for raw in text.splitlines():
        s = raw.strip()
        s = re.sub(r"^[\d]+[.)、]\s*", "", s)
        s = re.sub(r"^[-*•]\s*", "", s)
        if s and len(s) > 4:
            lines.append(s)
    return lines[:8]


def _fallback_treatment(grade_label: str) -> tuple[list[str], bool]:
    recs = list(_TREATMENT_BY_GRADE.get(grade_label, _TREATMENT_BY_GRADE["未确定"]))
    return recs, grade_label in ("高级别", "未确定")


async def generate_treatment_recommendations(
    imaging: PathologyImagingGradeResult,
    record: PetCtInterviewRecord,
) -> dict[str, Any]:
    pci = _get_pci_block(imaging)
    conclusion = _api_conclusion(imaging, pci)
    grade_label = _infer_grade(imaging, pci, record)
    iv = record.interview_info
    rx = record.research_extensions

    context = {
        "api_conclusion": conclusion,
        "grade_label": grade_label,
        "pci_score": pci.get("pci_score"),
        "is_positive": pci.get("is_positive"),
        "positive_rate": pci.get("positive_rate"),
        "clinical_diagnosis": iv.clinical_diagnosis,
        "brief_history": iv.brief_medical_history,
        "labs": rx.lab_snapshot,
        "treatment_history": {
            "治疗方式": rx.lab_snapshot.get("治疗方式") if rx.lab_snapshot else None,
            "第几次手术": rx.lab_snapshot.get("第几次手术") if rx.lab_snapshot else None,
            "是否静脉化疗": rx.lab_snapshot.get("是否静脉化疗") if rx.lab_snapshot else None,
            "CC评分": rx.lab_snapshot.get("CC评分") if rx.lab_snapshot else None,
        },
    }

    if not _deepseek_key() or settings.demo_mode:
        recs, mdt = _fallback_treatment(grade_label)
        return {
            "recommendations": recs,
            "grade_label": grade_label,
            "mdt_recommended": mdt,
            "guideline_refs": GUIDELINE_REFS,
            "llm_used": False,
            "llm_model": "rule-engine",
        }

    user_msg = f"请基于以下 JSON 生成治疗建议：\n```json\n{json.dumps(context, ensure_ascii=False, indent=2)}\n```"
    url = f"{_deepseek_base()}/chat/completions"
    body = {
        "model": _deepseek_model(),
        "messages": [
            {"role": "system", "content": TREATMENT_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.25,
        "max_tokens": 1200,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {_deepseek_key()}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
        content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
        parsed = json.loads(content) if content.startswith("{") else {}
        recs = parsed.get("recommendations") if isinstance(parsed.get("recommendations"), list) else []
        recs = [str(x).strip() for x in recs if str(x).strip()]
        if not recs:
            recs = _parse_recommendation_lines(content)
        grade_out = str(parsed.get("grade_label") or grade_label).strip() or grade_label
        if grade_label in ("高级别", "低级别"):
            grade_out = grade_label
        mdt = bool(parsed.get("mdt_recommended", grade_out in ("高级别", "未确定")))
        if not recs:
            recs, mdt = _fallback_treatment(grade_out)
        return {
            "recommendations": recs,
            "grade_label": grade_out,
            "mdt_recommended": mdt,
            "guideline_refs": GUIDELINE_REFS,
            "llm_used": True,
            "llm_model": _deepseek_model(),
        }
    except Exception as exc:
        logger.warning("DeepSeek treatment failed: %s", exc)
        recs, mdt = _fallback_treatment(grade_label)
        return {
            "recommendations": recs,
            "grade_label": grade_label,
            "mdt_recommended": mdt,
            "guideline_refs": GUIDELINE_REFS,
            "llm_used": False,
            "llm_model": _deepseek_model(),
            "error": str(exc),
        }


async def analyze_care_pathway(
    imaging: PathologyImagingGradeResult,
    record: PetCtInterviewRecord,
) -> dict[str, Any]:
    imaging_report = build_imaging_report_text(imaging, record)
    treatment = await generate_treatment_recommendations(imaging, record)
    grade = treatment.get("grade_label", "未确定")
    literature = recommend_literature(grade, record.interview_info.clinical_diagnosis or "")
    return {
        "imaging_report": imaging_report,
        "api_conclusion": _api_conclusion(imaging, _get_pci_block(imaging)),
        "treatment": treatment,
        "literature": [lit.model_dump(mode="json") if hasattr(lit, "model_dump") else lit for lit in literature[:5]],
        "inferred_diagnosis": record.interview_info.clinical_diagnosis
        or record.research_extensions.primary_disease_name
        or "待明确",
    }
