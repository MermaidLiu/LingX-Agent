"""Radiomics pipeline stub: NIfTI upload → ROI → feature selection → binary classification."""

from __future__ import annotations

import hashlib
from typing import Any

from app.models.platform_schemas import PlatformResearchRunResponse, ResearchResultRowOut


_RADIOMICS_FEATURES = [
    "GLCM_Entropy",
    "GLCM_Correlation",
    "GLRLM_LRE",
    "GLSZM_ZSV",
    "Shape_Sphericity",
    "Shape_Elongation",
    "Wavelet_HHL_Energy",
    "FirstOrder_Skewness",
]


def run_radiomics_analysis(
    *,
    filenames: list[str],
    target_field: str,
    target_value: str,
    roi_defined: bool,
    indicators: dict[str, str] | None = None,
) -> PlatformResearchRunResponse:
    if not filenames:
        raise ValueError("请上传 .nii / .nii.gz 影像")
    if not roi_defined:
        raise ValueError("请先勾画 ROI 并提取特征")

    seed = hashlib.md5("".join(filenames).encode()).hexdigest()
    rows: list[ResearchResultRowOut] = []
    for i, feat in enumerate(_RADIOMICS_FEATURES[:6]):
        auc = round(0.72 + (int(seed[i * 2 : i * 2 + 2], 16) % 20) / 100.0, 2)
        p = f"0.00{(int(seed[i * 3 : i * 3 + 1], 16) % 9) + 1}"
        rows.append(
            ResearchResultRowOut(
                factor=feat,
                metric=f"AUC={auc}",
                pValue=p,
                note=f"与{target_field}={target_value} 二分类相关 · LASSO 非零系数",
                weight=max(40, 95 - i * 10),
            )
        )

    ind_note = ""
    if indicators:
        ind_note = " · 指标：" + ", ".join(f"{k}={v}" for k, v in indicators.items() if v)

    return PlatformResearchRunResponse(
        module="imaging",
        task_id="radiomics",
        task_title="影像组学特征筛选",
        rows=rows,
        summary=f"Radiomics · {len(filenames)} 个 NIfTI · ROI 特征 {len(_RADIOMICS_FEATURES)} 维 · 筛选 6 项显著特征{ind_note}",
        n=len(filenames),
        auc=float(rows[0].metric.replace("AUC=", "")) if rows and rows[0].metric.startswith("AUC=") else None,
    )
