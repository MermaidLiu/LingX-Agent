"""Real statistical analysis for imported clinical datasets."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    cohen_kappa_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier

try:
    import statsmodels.api as sm
except ImportError:  # pragma: no cover
    sm = None

try:
    from lifelines import CoxPHFitter, KaplanMeierFitter
    from lifelines.statistics import logrank_test
except ImportError:  # pragma: no cover
    CoxPHFitter = None
    KaplanMeierFitter = None
    logrank_test = None


def _fmt_p(p: float) -> str:
    if p < 0.001:
        return "< 0.001"
    if p < 0.01:
        return f"{p:.3f}"
    return f"{p:.3f}"


def _sig(p: float) -> str:
    if p < 0.001:
        return "***"
    if p < 0.01:
        return "**"
    if p < 0.05:
        return "*"
    return "ns"


def _build_frame(rows: list[dict[str, str]], variables: list[dict[str, str]]) -> pd.DataFrame:
    cols = [v["name"] for v in variables if v.get("type") != "file" and not v.get("skipped")]
    data = [{c: (r.get(c) or "").strip() for c in cols} for r in rows]
    df = pd.DataFrame(data)
    for v in variables:
        name = v["name"]
        if name not in df.columns:
            continue
        if v.get("type") == "numerical":
            df[name] = pd.to_numeric(df[name], errors="coerce")
        elif v.get("type") == "date":
            df[name] = pd.to_datetime(df[name], errors="coerce")
    return df


def _numeric_cols(df: pd.DataFrame, variables: list[dict[str, str]], names: list[str] | None = None) -> list[str]:
    allowed = {v["name"] for v in variables if v.get("type") == "numerical"}
    if names:
        return [n for n in names if n in allowed and n in df.columns]
    return [c for c in df.columns if c in allowed]


def _cat_cols(df: pd.DataFrame, variables: list[dict[str, str]], names: list[str] | None = None) -> list[str]:
    allowed = {v["name"] for v in variables if v.get("type") in ("categorical", "text")}
    if names:
        return [n for n in names if n in allowed and n in df.columns]
    return [c for c in df.columns if c in allowed]


def run_descriptive(rows: list[dict[str, str]], variables: list[dict[str, str]], selected: list[str]) -> dict[str, Any]:
    df = _build_frame(rows, variables)
    targets = selected or [v["name"] for v in variables if v.get("type") != "file"]
    out: list[dict[str, Any]] = []
    for name in targets:
        v = next((x for x in variables if x["name"] == name), None)
        if not v or v.get("type") == "file":
            continue
        series = df[name]
        non_null = series.dropna()
        n = int(non_null.shape[0])
        row: dict[str, Any] = {"variable": name, "n": n}
        if v.get("type") == "numerical":
            nums = non_null.astype(float)
            row.update(
                {
                    "type": "数值型",
                    "mean": round(float(nums.mean()), 4) if n else None,
                    "sd": round(float(nums.std(ddof=1)), 4) if n > 1 else None,
                    "median": round(float(nums.median()), 4) if n else None,
                    "min": round(float(nums.min()), 4) if n else None,
                    "max": round(float(nums.max()), 4) if n else None,
                }
            )
        elif v.get("type") == "date":
            row.update(
                {
                    "type": "日期型",
                    "min": str(non_null.min())[:10] if n else None,
                    "max": str(non_null.max())[:10] if n else None,
                }
            )
        else:
            vc = non_null.astype(str).value_counts()
            cats = " · ".join(f"{k}({int(c)})" for k, c in vc.head(8).items())
            row.update({"type": "分类型", "categories": cats or "—"})
        out.append(row)
    return {"rows": out, "summary": f"描述性统计 · {len(out)} 个变量 · n={len(df)}"}


def run_significance(
    rows: list[dict[str, str]],
    variables: list[dict[str, str]],
    selected: list[str],
    split_var: str | None,
    group_a: str | None = None,
    group_b: str | None = None,
) -> dict[str, Any]:
    df = _build_frame(rows, variables)
    if not split_var or split_var not in df.columns:
        raise ValueError("显著性分析需选择拆分维度（分类型变量）")
    groups = df[split_var].dropna().astype(str).unique().tolist()
    if len(groups) < 2:
        raise ValueError("拆分变量至少需要 2 个组")
    ga = group_a or groups[0]
    gb = group_b or groups[1]
    sub_a = df[df[split_var].astype(str) == ga]
    sub_b = df[df[split_var].astype(str) == gb]
    out: list[dict[str, Any]] = []
    targets = selected or _numeric_cols(df, variables) + _cat_cols(df, variables)
    for name in targets:
        if name == split_var:
            continue
        v = next((x for x in variables if x["name"] == name), None)
        if not v:
            continue
        if v.get("type") == "numerical":
            a = sub_a[name].dropna().astype(float)
            b = sub_b[name].dropna().astype(float)
            if len(a) < 2 or len(b) < 2:
                continue
            t_stat, p = stats.ttest_ind(a, b, equal_var=False, nan_policy="omit")
            out.append(
                {
                    "variable": name,
                    "test": "Welch t 检验",
                    "group1": f"{ga}: {a.mean():.3f} (n={len(a)})",
                    "group2": f"{gb}: {b.mean():.3f} (n={len(b)})",
                    "stat": round(float(t_stat), 4),
                    "pValue": _fmt_p(float(p)),
                    "sig": _sig(float(p)),
                }
            )
        elif v.get("type") in ("categorical", "text"):
            ct = pd.crosstab(df[split_var].astype(str), df[name].astype(str))
            if ct.shape[0] < 2 or ct.shape[1] < 2:
                continue
            chi2, p, _, _ = stats.chi2_contingency(ct)
            out.append(
                {
                    "variable": name,
                    "test": "卡方检验",
                    "group1": ga,
                    "group2": gb,
                    "stat": round(float(chi2), 4),
                    "pValue": _fmt_p(float(p)),
                    "sig": _sig(float(p)),
                }
            )
    return {"rows": out, "summary": f"显著性分析 · {ga} vs {gb} · {len(out)} 项检验"}


def run_correlation(
    rows: list[dict[str, str]], variables: list[dict[str, str]], selected: list[str]
) -> dict[str, Any]:
    df = _build_frame(rows, variables)
    cols = _numeric_cols(df, variables, selected or None)
    if len(cols) < 2:
        raise ValueError("相关性分析至少需要 2 个数值型变量")
    out: list[dict[str, Any]] = []
    for i, a in enumerate(cols):
        for b in cols[i + 1 :]:
            pair = df[[a, b]].dropna()
            if len(pair) < 3:
                continue
            r, p = stats.pearsonr(pair[a], pair[b])
            rho, p_s = stats.spearmanr(pair[a], pair[b])
            out.append(
                {
                    "var1": a,
                    "var2": b,
                    "pearson_r": round(float(r), 4),
                    "pearson_p": _fmt_p(float(p)),
                    "spearman_rho": round(float(rho), 4),
                    "spearman_p": _fmt_p(float(p_s)),
                    "n": len(pair),
                }
            )
    return {"rows": out, "summary": f"相关性分析 · Pearson / Spearman · {len(out)} 对"}


def run_roc(
    rows: list[dict[str, str]],
    variables: list[dict[str, str]],
    outcome_var: str,
    predictor: str,
    positive_class: str | None = None,
) -> dict[str, Any]:
    df = _build_frame(rows, variables)
    if outcome_var not in df.columns or predictor not in df.columns:
        raise ValueError("ROC 需要选择结局变量（分类型）与预测变量（数值型）")
    y_raw = df[outcome_var].dropna().astype(str)
    pos = positive_class or y_raw.value_counts().index[0]
    mask = df[outcome_var].notna() & df[predictor].notna()
    sub = df.loc[mask].copy()
    y = (sub[outcome_var].astype(str) == pos).astype(int).values
    x = sub[predictor].astype(float).values
    if len(np.unique(y)) < 2:
        raise ValueError("结局变量需为二分类")
    fpr, tpr, thresholds = roc_curve(y, x)
    auc = roc_auc_score(y, x)
    points = [{"fpr": round(float(a), 4), "tpr": round(float(b), 4)} for a, b in zip(fpr[:: max(1, len(fpr) // 20)], tpr[:: max(1, len(tpr) // 20)])]
    return {
        "auc": round(float(auc), 4),
        "outcome": outcome_var,
        "predictor": predictor,
        "positive_class": pos,
        "curve": points,
        "summary": f"ROC · AUC={auc:.3f} · {predictor} → {outcome_var}",
    }


def run_consistency(
    rows: list[dict[str, str]], variables: list[dict[str, str]], var_a: str, var_b: str
) -> dict[str, Any]:
    df = _build_frame(rows, variables)
    if var_a not in df.columns or var_b not in df.columns:
        raise ValueError("一致性检验需选择两个分类型变量")
    pair = df[[var_a, var_b]].dropna()
    if len(pair) < 2:
        raise ValueError("有效样本不足")
    kappa = cohen_kappa_score(pair[var_a].astype(str), pair[var_b].astype(str))
    return {
        "var_a": var_a,
        "var_b": var_b,
        "kappa": round(float(kappa), 4),
        "interpretation": "几乎一致" if kappa > 0.8 else "中等一致" if kappa > 0.4 else "一致性较弱",
        "n": len(pair),
        "summary": f"Cohen's κ = {kappa:.3f}",
    }


def run_multiple_regression(
    rows: list[dict[str, str]],
    variables: list[dict[str, str]],
    dependent: str,
    independents: list[str],
) -> dict[str, Any]:
    if sm is None:
        raise RuntimeError("statsmodels 未安装，无法运行多元回归")
    df = _build_frame(rows, variables)
    y = df[dependent].astype(float)
    x_df = df[independents].copy()
    for col in x_df.columns:
        if x_df[col].dtype == object:
            x_df[col] = x_df[col].astype("category").cat.codes
    x_df = x_df.apply(pd.to_numeric, errors="coerce")
    mask = y.notna() & x_df.notna().all(axis=1)
    y = y[mask]
    x_df = x_df[mask]
    if len(y) < len(independents) + 2:
        raise ValueError("样本量不足以进行多元回归")
    x = sm.add_constant(x_df)
    model = sm.OLS(y, x).fit()
    out = []
    for name, coef, se, p in zip(model.params.index, model.params, model.bse, model.pvalues):
        out.append(
            {
                "factor": name,
                "coef": round(float(coef), 4),
                "se": round(float(se), 4),
                "pValue": _fmt_p(float(p)),
                "sig": _sig(float(p)),
            }
        )
    return {
        "rows": out,
        "r_squared": round(float(model.rsquared), 4),
        "summary": f"多元线性回归 · R²={model.rsquared:.3f} · n={len(y)}",
    }


def run_logistic_regression(
    rows: list[dict[str, str]],
    variables: list[dict[str, str]],
    outcome_var: str,
    independents: list[str],
    positive_class: str | None = None,
) -> dict[str, Any]:
    df = _build_frame(rows, variables)
    y_raw = df[outcome_var].dropna().astype(str)
    pos = positive_class or y_raw.value_counts().index[0]
    work = df[independents + [outcome_var]].copy()
    for col in independents:
        if work[col].dtype == object:
            work[col] = work[col].astype("category").cat.codes
        work[col] = pd.to_numeric(work[col], errors="coerce")
    work = work.dropna()
    y = (work[outcome_var].astype(str) == pos).astype(int).values
    x = work[independents].values
    if len(np.unique(y)) < 2:
        raise ValueError("结局变量需为二分类")
    if len(y) < len(independents) + 5:
        raise ValueError("样本量不足")
    clf = LogisticRegression(max_iter=1000)
    clf.fit(x, y)
    out = []
    for name, coef in zip(independents, clf.coef_[0]):
        out.append({"factor": name, "coef": round(float(coef), 4), "odds_ratio": round(float(math.exp(coef)), 4)})
    acc = accuracy_score(y, clf.predict(x))
    return {
        "rows": out,
        "accuracy": round(float(acc), 4),
        "positive_class": pos,
        "summary": f"逻辑回归 · 训练准确率={acc:.3f} · n={len(y)}",
    }


def run_survival(
    rows: list[dict[str, str]],
    variables: list[dict[str, str]],
    time_var: str,
    event_var: str,
    split_var: str | None = None,
) -> dict[str, Any]:
    if KaplanMeierFitter is None:
        raise RuntimeError("lifelines 未安装，无法运行生存分析")
    df = _build_frame(rows, variables)
    work = df[[time_var, event_var] + ([split_var] if split_var else [])].copy()
    raw_time = work[time_var]
    work[time_var] = pd.to_numeric(raw_time, errors="coerce")
    if work[time_var].isna().all():
        dt = pd.to_datetime(raw_time, errors="coerce")
        work[time_var] = (dt - dt.min()).dt.days.astype(float)
    work[event_var] = work[event_var].astype(str).str.lower().isin(["1", "true", "是", "yes", "发生", "死亡", "进展"]).astype(int)
    work = work.dropna(subset=[time_var])
    curves: list[dict[str, Any]] = []
    if split_var and split_var in work.columns:
        groups = work[split_var].dropna().astype(str).unique().tolist()
        for g in groups[:4]:
            sub = work[work[split_var].astype(str) == g]
            kmf = KaplanMeierFitter()
            kmf.fit(sub[time_var], sub[event_var], label=str(g))
            surv = kmf.survival_function_.reset_index()
            curves.append(
                {
                    "group": str(g),
                    "points": [{"time": float(r["timeline"]), "survival": float(r[str(g)])} for _, r in surv.iloc[:: max(1, len(surv) // 30)].iterrows()],
                }
            )
        if len(groups) >= 2 and logrank_test:
            a = work[work[split_var].astype(str) == groups[0]]
            b = work[work[split_var].astype(str) == groups[1]]
            lr = logrank_test(a[time_var], b[time_var], a[event_var], b[event_var])
            p = float(lr.p_value)
            summary = f"KM 生存曲线 · Log-rank p={_fmt_p(p)}"
        else:
            p = None
            summary = "KM 生存曲线"
    else:
        kmf = KaplanMeierFitter()
        kmf.fit(work[time_var], work[event_var])
        surv = kmf.survival_function_.reset_index()
        curves.append(
            {
                "group": "全部",
                "points": [{"time": float(r["timeline"]), "survival": float(r["KM_estimate"])} for _, r in surv.iloc[:: max(1, len(surv) // 30)].iterrows()],
            }
        )
        p = None
        summary = f"KM 生存曲线 · n={len(work)}"
    return {"curves": curves, "logrank_p": _fmt_p(p) if p is not None else None, "summary": summary}


def run_cox(
    rows: list[dict[str, str]],
    variables: list[dict[str, str]],
    time_var: str,
    event_var: str,
    covariates: list[str],
) -> dict[str, Any]:
    if CoxPHFitter is None:
        raise RuntimeError("lifelines 未安装，无法运行 Cox 回归")
    df = _build_frame(rows, variables)
    cols = [time_var, event_var] + covariates
    work = df[cols].copy()
    work[time_var] = pd.to_numeric(work[time_var], errors="coerce")
    work[event_var] = work[event_var].astype(str).str.lower().isin(["1", "true", "是", "yes", "发生", "死亡", "进展"]).astype(int)
    for c in covariates:
        if work[c].dtype == object:
            work[c] = work[c].astype("category").cat.codes
        work[c] = pd.to_numeric(work[c], errors="coerce")
    work = work.dropna()
    if len(work) < len(covariates) + 3:
        raise ValueError("样本量不足以进行 Cox 回归")
    cph = CoxPHFitter()
    cph.fit(work, duration_col=time_var, event_col=event_var)
    out = []
    for name in covariates:
        hr = float(math.exp(cph.params_[name]))
        p = float(cph.summary.loc[name, "p"])
        out.append({"factor": name, "hr": round(hr, 4), "pValue": _fmt_p(p), "sig": _sig(p)})
    return {"rows": out, "summary": f"Cox 比例风险回归 · n={len(work)}", "concordance": round(float(cph.concordance_index_), 4)}


def run_ml(
    rows: list[dict[str, str]],
    variables: list[dict[str, str]],
    feature_vars: list[str],
    outcome_var: str,
    model: str = "random_forest",
    positive_class: str | None = None,
    test_size: float = 0.3,
) -> dict[str, Any]:
    df = _build_frame(rows, variables)
    y_raw = df[outcome_var].dropna().astype(str)
    pos = positive_class or y_raw.value_counts().index[0]
    work = df[feature_vars + [outcome_var]].copy()
    num_cols = [c for c in feature_vars if c in _numeric_cols(df, variables)]
    cat_cols = [c for c in feature_vars if c in _cat_cols(df, variables)]
    preprocess = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
            ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("oh", OneHotEncoder(handle_unknown="ignore"))]), cat_cols),
        ]
    )
    y = (work[outcome_var].astype(str) == pos).astype(int)
    mask = y.notna()
    work = work.loc[mask]
    y = y.loc[mask]
    if len(np.unique(y)) < 2:
        raise ValueError("结局变量需为二分类")
    if len(y) < 10:
        raise ValueError("样本量至少 10 例才能训练模型")
    x_train, x_test, y_train, y_test = train_test_split(
        work[feature_vars], y, test_size=test_size, random_state=42, stratify=y if y.value_counts().min() >= 2 else None
    )
    if model == "logistic":
        clf = LogisticRegression(max_iter=2000)
    else:
        clf = RandomForestClassifier(n_estimators=200, random_state=42)
    pipe = Pipeline([("prep", preprocess), ("clf", clf)])
    pipe.fit(x_train, y_train)
    pred = pipe.predict(x_test)
    proba = pipe.predict_proba(x_test)[:, 1] if hasattr(pipe.named_steps["clf"], "predict_proba") else pred
    acc = accuracy_score(y_test, pred)
    auc = roc_auc_score(y_test, proba) if len(np.unique(y_test)) > 1 else None
    return {
        "model": model,
        "accuracy": round(float(acc), 4),
        "auc": round(float(auc), 4) if auc is not None else None,
        "train_n": len(x_train),
        "test_n": len(x_test),
        "positive_class": pos,
        "features": feature_vars,
        "summary": f"机器学习 · {model} · 准确率={acc:.3f}" + (f" · AUC={auc:.3f}" if auc else ""),
    }


def analyze_clinical_dataset(body: dict[str, Any]) -> dict[str, Any]:
    analysis = body.get("analysis", "desc")
    rows = body.get("rows") or []
    variables = body.get("variables") or []
    selected = body.get("selected_vars") or []

    if not rows:
        raise ValueError("数据集为空")

    if analysis == "desc":
        return run_descriptive(rows, variables, selected)
    if analysis == "sig":
        return run_significance(
            rows,
            variables,
            selected,
            body.get("split_var"),
            body.get("group_a"),
            body.get("group_b"),
        )
    if analysis == "corr":
        return run_correlation(rows, variables, selected)
    if analysis == "roc":
        return run_roc(
            rows,
            variables,
            body.get("outcome_var") or "",
            body.get("predictor") or (selected[0] if selected else ""),
            body.get("positive_class"),
        )
    if analysis == "consistency":
        vars_ = selected if len(selected) >= 2 else []
        if len(vars_) < 2:
            raise ValueError("一致性检验需选择两个变量")
        return run_consistency(rows, variables, vars_[0], vars_[1])
    if analysis == "multi_reg":
        return run_multiple_regression(rows, variables, body.get("dependent") or "", body.get("independents") or [])
    if analysis == "logistic":
        return run_logistic_regression(
            rows,
            variables,
            body.get("outcome_var") or body.get("dependent") or "",
            body.get("independents") or [],
            body.get("positive_class"),
        )
    if analysis == "survival":
        return run_survival(
            rows,
            variables,
            body.get("time_var") or body.get("dependent") or "",
            body.get("event_var") or body.get("outcome_var") or "",
            body.get("split_var"),
        )
    if analysis == "cox":
        return run_cox(
            rows,
            variables,
            body.get("time_var") or "",
            body.get("event_var") or "",
            body.get("independents") or body.get("covariates") or [],
        )
    if analysis == "ml":
        return run_ml(
            rows,
            variables,
            body.get("feature_vars") or body.get("independents") or selected,
            body.get("outcome_var") or "",
            body.get("ml_model") or "random_forest",
            body.get("positive_class"),
            float(body.get("test_size") or 0.3),
        )
    raise ValueError(f"未知分析类型：{analysis}")
