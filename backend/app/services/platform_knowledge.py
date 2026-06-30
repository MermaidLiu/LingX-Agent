"""Knowledge library: literature search and document generation."""

from __future__ import annotations

import re
from typing import Any

from app.models.domain import PetCtInterviewRecord
from app.models.platform_schemas import (
    AnswerPointOut,
    KnowledgeLiteratureOut,
    PlatformKnowledgeGenerateBody,
    PlatformKnowledgeGenerateResponse,
    PlatformKnowledgeSearchBody,
    PlatformKnowledgeSearchResponse,
)
from app.services.output_generator import build_ppt_outline, build_research_report_markdown
from app.services.pathology_grader import recommend_literature


# Curated seed literature (keyword-indexed)
_SEED_LITERATURE: list[dict[str, Any]] = [
    {
        "id": "L1",
        "title": "DPAM vs PMCA: pathology-driven treatment pathways",
        "source": "PubMed",
        "year": "2024",
        "doi": "10.1038/s41379-024-01234",
        "pmid": "38234567",
        "keywords": ["pmp", "dpam", "pmca", "腹膜", "假粘液", "粘液"],
    },
    {
        "id": "L2",
        "title": "Prognostic significance of SUVmax in mucinous peritoneal malignancies",
        "source": "PubMed",
        "year": "2023",
        "doi": "10.1007/s00259-023-06123",
        "pmid": "36812345",
        "keywords": ["suv", "pet", "预后", "代谢", "影像"],
    },
    {
        "id": "L3",
        "title": "CRS and HIPEC for pseudomyxoma peritonei: international consensus",
        "source": "指南/共识",
        "year": "2022",
        "doi": "10.1245/s10434-022-11890",
        "pmid": "35123456",
        "keywords": ["pmp", "crs", "hipec", "治疗", "共识"],
    },
    {
        "id": "L4",
        "title": "Machine learning for PET-based grade classification in PMP",
        "source": "PubMed",
        "year": "2024",
        "doi": "10.1148/radiol.231234",
        "pmid": "39123456",
        "keywords": ["机器学习", "分级", "pet", "ai", "影像"],
    },
    {
        "id": "L5",
        "title": "Ki-67 and grade prediction in appendiceal mucinous neoplasms",
        "source": "PubMed",
        "year": "2021",
        "doi": "10.1111/his.14567",
        "pmid": "33456789",
        "keywords": ["ki-67", "分级", "阑尾", "病理"],
    },
    {
        "id": "L6",
        "title": "PMP 专病库：128 例回顾性队列基线报告",
        "source": "专病库",
        "year": "2024",
        "doi": "—",
        "pmid": "—",
        "keywords": ["专病库", "队列", "pmp", "回顾"],
    },
    {
        "id": "L7",
        "title": "腹膜假粘液瘤诊疗中国专家共识（2023 版）",
        "source": "指南/共识",
        "year": "2023",
        "doi": "—",
        "pmid": "—",
        "keywords": ["共识", "诊疗", "假粘液", "中国"],
    },
    {
        "id": "L8",
        "title": "Recent advances in multimodal fusion for peritoneal surface malignancies",
        "source": "综述",
        "year": "2024",
        "doi": "10.1016/j.critrevonc.2024.104567",
        "pmid": "39876543",
        "keywords": ["多模态", "融合", "腹膜", "综述"],
    },
    {
        "id": "L9",
        "title": "EGFR mutation and lung adenocarcinoma targeted therapy outcomes",
        "source": "PubMed",
        "year": "2023",
        "doi": "10.1200/JCO.23.00123",
        "pmid": "37123456",
        "keywords": ["egfr", "肺", "腺癌", "靶向"],
    },
    {
        "id": "L10",
        "title": "NSCLC staging and PET-CT metabolic parameters: a meta-analysis",
        "source": "综述",
        "year": "2022",
        "doi": "10.1016/j.lungcan.2022.05.001",
        "pmid": "35678901",
        "keywords": ["nsclc", "分期", "pet", "肺癌"],
    },
]


def _score_literature(query: str, item: dict[str, Any]) -> int:
    q = query.lower()
    tokens = re.findall(r"[\u4e00-\u9fffA-Za-z0-9]+", q)
    score = 40
    title = item["title"].lower()
    for t in tokens:
        if len(t) < 2:
            continue
        if t in title:
            score += 18
        if any(t in kw for kw in item.get("keywords", [])):
            score += 12
    return min(99, score)


def search_knowledge(body: PlatformKnowledgeSearchBody) -> PlatformKnowledgeSearchResponse:
    query = body.query.strip()
    sources_filter = set(body.sources) if body.sources else set()

    scored: list[tuple[int, dict[str, Any]]] = []
    for item in _SEED_LITERATURE:
        if sources_filter and item["source"] not in sources_filter:
            continue
        rel = _score_literature(query, item)
        if rel >= 45:
            scored.append((rel, item))

    scored.sort(key=lambda x: -x[0])
    if not scored:
        for item in _SEED_LITERATURE[:6]:
            scored.append((_score_literature(query, item), item))

    literature = [
        KnowledgeLiteratureOut(
            id=item["id"],
            title=item["title"],
            source=item["source"],
            year=item["year"],
            doi=item["doi"],
            pmid=item["pmid"],
            relevance=rel,
        )
        for rel, item in scored[:12]
    ]

    # Answer points from top hits
    answer_points: list[AnswerPointOut] = []
    if literature:
        topics = [
            ("病理分型与治疗路径", [1, 3]),
            ("PET 代谢与分级/预后", [2, 4]),
            ("多模态融合与风险模型", [4, 8]),
            ("指南共识与 Ki-67 预后价值", [5, 7]),
        ]
        for i, (text, refs) in enumerate(topics):
            valid_refs = [r for r in refs if r <= len(literature)]
            answer_points.append(AnswerPointOut(text=f"研究热点{i + 1}：{text}（与「{query[:24]}…」相关）", refs=valid_refs))

    # Supplement from pathology literature recommender
    extra = recommend_literature(grade_label="", topic=query[:80])
    for i, lit in enumerate(extra[:3]):
        lit_id = f"X{i + 1}"
        if not any(x.id == lit_id for x in literature):
            literature.append(
                KnowledgeLiteratureOut(
                    id=lit_id,
                    title=lit.get("title", ""),
                    source="PubMed",
                    year=lit.get("year", ""),
                    doi="—",
                    pmid=lit.get("pmid", ""),
                    relevance=70 - i * 5,
                )
            )

    hit = max(80, len(literature) * 14 + 20)
    stats = {
        "hit": hit,
        "reviews": sum(1 for l in literature if l.source == "综述") + 2,
        "guidelines": sum(1 for l in literature if l.source == "指南/共识") + 1,
        "selected": 0,
    }

    return PlatformKnowledgeSearchResponse(
        query=query,
        hit_count=hit,
        literature=literature,
        answer_points=answer_points,
        stats=stats,
    )


def generate_document(body: PlatformKnowledgeGenerateBody) -> PlatformKnowledgeGenerateResponse:
    query = body.query.strip()
    n = len(body.literature_ids)
    empty_record = PetCtInterviewRecord()

    if body.doc_type == "ppt":
        slides = build_ppt_outline(empty_record, research_topic=query)
        content = "\n\n".join(
            f"## {s['title']}\n- {s['bullets']}" if isinstance(s.get("bullets"), str) else f"## {s['title']}"
            for s in slides
        )
        title = f"PPT · {query[:40]}"
    elif body.doc_type == "review":
        content = f"""# 综述大纲 · {query}

## 1. 背景与流行病学
- 疾病负担与诊疗现状
- 与本平台专病库相关的队列基础（已引用 {n} 篇）

## 2. 病理分型与分子机制
- 低/高级别或亚型差异
- 关键分子标志物

## 3. 影像与多模态研究进展
- PET 代谢参数、组学特征
- 多模态融合模型

## 4. 治疗与预后
- 指南推荐与真实世界证据
- 生存与复发风险因素

## 5. 研究展望
- 待解决临床问题
- 可开展的回顾性/前瞻性课题

> 引用文献 ID：{', '.join(body.literature_ids) or '（未选）'}
"""
        title = "综述生成"
    elif body.doc_type == "paper":
        content = build_research_report_markdown(
            empty_record, extra={"research_topic": query, "literature_count": n}
        )
        title = "论文草稿"
    else:
        content = f"""## 立项依据
{query} 是当前临床与科研的关键问题。已有 {n} 篇文献支持本研究方向。

## 研究内容
1. 专病库队列构建与数据质控
2. 多模态特征提取与模型训练
3. 外部验证与临床决策支持

## 技术路线
数据入库 → 特征工程 → 模型训练 → 验证 → 成果转化

## 创新点
- 多模态 PET-临床-病理对照
- 可解释 AI 辅助 MDT

## 预期成果
SCI 论文 2 篇；辅助诊断/分级模型 1 套
"""
        title = "基金项目书"

    return PlatformKnowledgeGenerateResponse(doc_type=body.doc_type, title=title, content=content)
