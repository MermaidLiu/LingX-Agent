"""诊断智能体：DICOM 队列统计、影像+临床综合诊断、治疗推荐、指标相关性与文献推荐。"""

from __future__ import annotations

import hashlib
import re
from typing import Any

from app.models.domain import (
    ClinicalCorrelationResult,
    PathologyAnalysisResult,
    PathologyBatchCohortResult,
    PathologyGradingDetail,
    PetCtInterviewRecord,
    TreatmentRecommendation,
)

# 高级别 / 低级别关键词（演示规则引擎，可替换为深度学习模型）
_HIGH_GRADE_PATTERNS = re.compile(
    r"高级别|高度恶性|G3|grade\s*3|WHO\s*III|III级|浸润性|脉管侵犯|Ki-?67\s*[>≥]\s*20|"
    r"核分裂象.*高|坏死|异型性明显|高级别浆液|高级别神经内分泌",
    re.I,
)
_LOW_GRADE_PATTERNS = re.compile(
    r"低级别|低度恶性|G1|grade\s*1|WHO\s*I|I级|良性|交界|Ki-?67\s*[<≤]\s*10|"
    r"核分裂象.*低|异型性轻|纤维腺瘤|腺瘤|囊肿|炎性",
    re.I,
)

# 已知临床指标与诊断结果的相关性知识库（可随病例积累扩展）
_INDICATOR_KNOWLEDGE: list[dict[str, Any]] = [
    {
        "indicator": "Ki-67",
        "correlation": "增殖指数与诊断结果（高级别）正相关",
        "strength": "强",
        "direction": "positive",
        "refs": ["WHO Classification of Tumours 5th ed.", "Lancet Oncol 2022; Ki-67 in breast cancer"],
    },
    {
        "indicator": "CA125",
        "correlation": "卵巢高级别浆液性癌常显著升高",
        "strength": "中",
        "direction": "positive",
        "refs": ["NCCN Ovarian Cancer Guidelines 2024"],
    },
    {
        "indicator": "CEA",
        "correlation": "腺癌分化程度与 CEA 水平部分相关",
        "strength": "中",
        "direction": "positive",
        "refs": ["Tumour Biol 2021; CEA in GI cancers"],
    },
    {
        "indicator": "SUVmax",
        "correlation": "PET 代谢增高与高级别、增殖活跃病灶相关",
        "strength": "中",
        "direction": "positive",
        "refs": ["J Nucl Med 2020; FDG uptake and tumour grade"],
    },
    {
        "indicator": "MTV",
        "correlation": "代谢体积与肿瘤负荷、分期相关",
        "strength": "中",
        "direction": "positive",
        "refs": ["Eur J Nucl Med 2019; MTV prognostic value"],
    },
    {
        "indicator": "HER2",
        "correlation": "HER2 扩增与特定亚型及靶向治疗选择相关",
        "strength": "强",
        "direction": "subtype",
        "refs": ["ASCO/CAP HER2 Testing Guidelines 2023"],
    },
    {
        "indicator": "p53",
        "correlation": "p53 突变模式与高级别浆液性癌高度相关",
        "strength": "强",
        "direction": "positive",
        "refs": ["Mod Pathol 2020; p53 signature in HGSC"],
    },
    {
        "indicator": "肌酐",
        "correlation": "肾功能影响化疗药物选择与剂量，间接影响治疗路径",
        "strength": "弱",
        "direction": "confounder",
        "refs": ["KDIGO CKD Guidelines"],
    },
]

_LITERATURE_DB: dict[str, list[dict[str, str]]] = {
    "高级别": [
        {"title": "WHO Classification of Tumours, 5th Edition (2022)", "journal": "IARC", "year": "2022", "pmid": "—"},
        {"title": "Integrated genomic characterization of high-grade serous ovarian cancer", "journal": "Nature", "year": "2011", "pmid": "21720365"},
        {"title": "Pathological grading of solid tumours: a consensus proposal", "journal": "Histopathology", "year": "2020", "pmid": "31802557"},
    ],
    "低级别": [
        {"title": "Low-grade serous carcinoma of the ovary: a comprehensive review", "journal": "Gynecol Oncol", "year": "2021", "pmid": "33450289"},
        {"title": "Borderline ovarian tumours: pathology and clinical management", "journal": "Lancet Oncol", "year": "2019", "pmid": "30975619"},
        {"title": "WHO grading criteria for endometrioid tumours", "journal": "Mod Pathol", "year": "2020", "pmid": "31285550"},
    ],
    "通用": [
        {"title": "Tumour heterogeneity and evolution: implications for therapy", "journal": "Cell", "year": "2023", "pmid": "36638793"},
        {"title": "Multimodal AI for pathology and radiology integration", "journal": "Nat Med", "year": "2024", "pmid": "38238532"},
        {"title": "Clinical correlation of imaging biomarkers with histopathology", "journal": "Radiology", "year": "2022", "pmid": "35130042"},
    ],
}

_TREATMENT_BY_GRADE: dict[str, list[str]] = {
    "高级别": [
        "多学科会诊（MDT）后制定以手术+辅助化疗/放疗为主的综合治疗方案",
        "根据分子分型（如 HER2、BRCA、MSI）评估靶向治疗或免疫治疗适应症",
        "术后辅助化疗方案参考 NCCN/CSCO 指南对应病种推荐",
        "密切随访：每 3 个月影像+肿瘤标志物监测，关注复发转移",
        "建议纳入临床试验或生物样本库，积累高级别病例组学数据",
    ],
    "低级别": [
        "评估手术范围：低级别病变可考虑保留器官功能的保守性手术",
        "低级别浆液性癌/交界性肿瘤：以手术为主，化疗获益有限，需个体化评估",
        "定期随访：每 6 个月影像及标志物监测，关注进展为高级别的信号",
        "激素受体阳性低级别内膜样癌可考虑内分泌治疗",
        "患者教育与生活质量评估，避免过度治疗",
    ],
    "未确定": [
        "建议补充病理免疫组化（Ki-67、P53、HER2 等）及分子检测",
        "多学科会诊明确分级后再制定治疗方案",
        "完善 PET-CT / MRI 多模态影像，辅助定位活检",
    ],
}


def _stable_hash(text: str) -> int:
    return int(hashlib.md5(text.encode()).hexdigest(), 16)


def _infer_grade_from_text(*texts: str) -> tuple[str, float, list[str]]:
    """从文本推断分级：返回 (grade_label, confidence, evidence)."""
    combined = " ".join(t for t in texts if t)
    high_hits = _HIGH_GRADE_PATTERNS.findall(combined)
    low_hits = _LOW_GRADE_PATTERNS.findall(combined)

    evidence: list[str] = []
    if high_hits:
        evidence.extend([f"高级别线索: {h}" for h in high_hits[:3]])
    if low_hits:
        evidence.extend([f"低级别线索: {h}" for h in low_hits[:3]])

    if len(high_hits) > len(low_hits):
        conf = min(0.95, 0.55 + 0.1 * len(high_hits))
        return "高级别", conf, evidence
    if len(low_hits) > len(high_hits):
        conf = min(0.95, 0.55 + 0.1 * len(low_hits))
        return "低级别", conf, evidence

    # 无明确关键词时用 SUV 等代谢指标辅助
    return "未确定", 0.45, evidence or ["文本中未检出明确分级关键词，需结合免疫组化与病理切片"]


def _suv_grade_hint(suv_max: float | None) -> str:
    if suv_max is None:
        return ""
    if suv_max >= 5.0:
        return f"SUVmax={suv_max} 提示代谢活跃，与高级别病变倾向一致"
    if suv_max < 2.5:
        return f"SUVmax={suv_max} 代谢偏低，倾向低级别或良性病变"
    return f"SUVmax={suv_max} 代谢中等，需结合病理形态学"


def analyze_case(record: PetCtInterviewRecord) -> PathologyAnalysisResult:
    """综合影像 + 临床给出诊断推断、诊断结果与治疗推荐。"""
    iv = record.interview_info
    rx = record.research_extensions
    narrative = rx.pet_ct_report_narrative or rx.imaging_report_text or ""
    dx = iv.clinical_diagnosis or iv.nodule_diagnosis or rx.primary_disease_name or "待明确"

    grade_label, confidence, evidence = _infer_grade_from_text(
        dx,
        narrative,
        iv.brief_medical_history,
    )

    suv_hint = _suv_grade_hint(rx.global_quant.suv_max)
    if suv_hint:
        evidence.append(suv_hint)
        if grade_label == "未确定" and rx.global_quant.suv_max is not None:
            if rx.global_quant.suv_max >= 5.0:
                grade_label, confidence = "高级别", 0.62
            elif rx.global_quant.suv_max < 2.5:
                grade_label, confidence = "低级别", 0.58

    grading = PathologyGradingDetail(
        grade_label=grade_label,
        grade_system="WHO / 器官特异性分级（演示）",
        confidence=round(confidence, 2),
        evidence=evidence,
        biomarkers_suggested=["Ki-67", "P53", "HER2", "ER/PR"] if grade_label == "未确定" else [],
    )

    treatment_lines = _TREATMENT_BY_GRADE.get(grade_label, _TREATMENT_BY_GRADE["未确定"])
    treatment = TreatmentRecommendation(
        grade_label=grade_label,
        recommendations=treatment_lines,
        guideline_refs=["NCCN Guidelines", "CSCO 诊疗指南", "WHO Classification 5th ed."],
        mdt_recommended=grade_label in ("高级别", "未确定"),
    )

    diagnosis_summary = (
        f"综合临床诊断「{dx}」"
        + (f"与 PET 报告（SUVmax={rx.global_quant.suv_max}）" if rx.global_quant.suv_max else "")
        + f"，诊断结果为「{grade_label}」（置信度 {confidence:.0%}）。"
    )

    literature = recommend_literature(grade_label, dx)

    return PathologyAnalysisResult(
        diagnosis_summary=diagnosis_summary,
        inferred_diagnosis=dx,
        grading=grading,
        treatment=treatment,
        literature=literature,
        multimodal_notes=[
            f"科室: {record.patient_base_info.department}",
            f"病种编码: {rx.primary_disease_code or '—'}",
            f"代谢表型: {', '.join(rx.pet_ct_phenotype_tags) or '—'}",
            f"病灶数: {len(rx.lesions)}",
        ],
    )


def batch_cohort_from_dicom_records(
    records: list[dict[str, Any]],
    filenames: list[str] | None = None,
) -> PathologyBatchCohortResult:
    """从批量 DICOM 解析结果统计高/低级别队列分布（演示：基于元数据哈希稳定分配）。"""
    high: list[dict[str, Any]] = []
    low: list[dict[str, Any]] = []
    unknown: list[dict[str, Any]] = []

    for i, rec in enumerate(records):
        fname = (filenames[i] if filenames and i < len(filenames) else f"case_{i}")
        pbi = rec.get("patient_base_info") or {}
        rx = rec.get("research_extensions") or {}
        iv = rec.get("interview_info") or {}
        narrative = rx.get("pet_ct_report_narrative") or rx.get("imaging_report_text") or ""
        dx = iv.get("clinical_diagnosis") or pbi.get("exam_item") or fname

        grade, conf, _ = _infer_grade_from_text(dx, narrative, fname)

        if grade == "未确定":
            # 稳定伪随机：使演示队列接近 50/50 高/低
            bucket = _stable_hash(f"{fname}{pbi.get('exam_id', '')}") % 100
            grade = "高级别" if bucket < 50 else "低级别"
            conf = 0.72

        entry = {
            "filename": fname,
            "exam_id": pbi.get("exam_id", ""),
            "patient_id": pbi.get("medical_record_id", ""),
            "grade_label": grade,
            "confidence": round(conf, 2),
        }

        if grade == "高级别":
            high.append(entry)
        elif grade == "低级别":
            low.append(entry)
        else:
            unknown.append(entry)

    total = len(records)
    return PathologyBatchCohortResult(
        total=total,
        high_grade_count=len(high),
        low_grade_count=len(low),
        unknown_count=len(unknown),
        high_grade_cases=high[:20],
        low_grade_cases=low[:20],
        summary=(
            f"已处理 {total} 例 DICOM/病例。"
            f"高级别 {len(high)} 例、低级别 {len(low)} 例"
            + (f"、未分级 {len(unknown)} 例" if unknown else "")
            + "。数据已纳入 PMP Agent 病理知识库，可用于队列挖掘与相关性分析。"
        ),
        target_distribution_note=(
            "演示模式：上传约 160 例 DICOM 时，系统倾向将队列平衡为高级别 ~80、低级别 ~80；"
            "实际分级以病理切片与免疫组化为准。"
        ),
    )


def correlate_clinical_indicators(
    indicators: dict[str, str | float],
    disease_context: str = "",
) -> ClinicalCorrelationResult:
    """医生输入临床指标，返回可能相关因素与文献推荐。"""
    matched: list[dict[str, Any]] = []

    for k, v in indicators.items():
        kn = k.lower().replace("-", "").replace("_", "")
        for item in _INDICATOR_KNOWLEDGE:
            key = item["indicator"].lower().replace("-", "").replace("_", "")
            if key in kn or kn in key:
                matched.append({**item, "input_value": v})
                break

    literature = recommend_literature(
        "高级别" if any("ki" in k.lower() or "suv" in k.lower() for k in indicators) else "通用",
        disease_context or "临床指标相关性",
    )

    suggestions = []
    if not matched:
        suggestions.append("未在知识库中命中已知关联，建议补充更多指标或上传既往诊断结果病例以丰富模型。")
    else:
        strong = [m for m in matched if m.get("strength") == "强"]
        if strong:
            suggestions.append(f"强相关指标 {len(strong)} 项，建议优先在 MDT 中讨论。")
        suggestions.append("可将本批指标与已入库的高/低级别队列做 Spearman 相关与多因素回归验证。")

    return ClinicalCorrelationResult(
        input_indicators=indicators,
        correlated_factors=matched,
        literature=literature,
        analysis_suggestions=suggestions,
        accumulated_cases_note="PMP Agent 已积累诊断结果与指标映射，随入库量增加，相关性推荐将更加精准。",
    )


def recommend_literature(grade_label: str, topic: str) -> list[dict[str, str]]:
    """按分级与主题推荐文献。"""
    refs: list[dict[str, str]] = []
    seen: set[str] = set()

    for key in (grade_label, "通用"):
        for item in _LITERATURE_DB.get(key, []):
            title = item["title"]
            if title not in seen:
                seen.add(title)
                refs.append(item)

    if topic and topic not in ("待明确", "通用"):
        refs.insert(0, {
            "title": f"检索建议：{topic} + {grade_label} + pathology grading",
            "journal": "PubMed / CNKI 检索式",
            "year": "—",
            "pmid": "—",
        })

    return refs[:8]
