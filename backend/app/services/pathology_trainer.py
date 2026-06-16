"""病理分级模型：训练集导出、特征工程与 sklearn 训练。"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import PetCtInterviewRecord
from app.models.orm import PetCtCaseORM
from app.repositories import pet_ct_case
from app.services.pathology_grader import analyze_case

DATA_DIR = Path("data/training")
CSV_PATH = DATA_DIR / "pathology_training.csv"
MODEL_PATH = Path("models/pathology_grade_classifier.joblib")
META_PATH = Path("models/pathology_grade_classifier.meta.json")

LABEL_MAP = {"高级别": 1, "低级别": 0}
INV_LABEL_MAP = {1: "高级别", 0: "低级别"}


def _gender_code(g: str) -> int:
    g = (g or "").strip()
    if g in ("男", "M", "male", "Male"):
        return 1
    if g in ("女", "F", "female", "Female"):
        return 0
    return -1


def record_to_feature_row(rec: PetCtInterviewRecord, label: str) -> dict[str, Any]:
    p = rec.patient_base_info
    rx = rec.research_extensions
    gq = rx.global_quant
    return {
        "exam_id": p.exam_id or "",
        "clinical_diagnosis": rec.interview_info.clinical_diagnosis or "",
        "department": p.department or "",
        "age": float(p.age or 0),
        "gender_code": float(_gender_code(p.gender)),
        "height_cm": float(p.height_cm or 0),
        "weight_kg": float(p.weight_kg or 0),
        "suv_max": float(gq.suv_max) if gq.suv_max is not None else 0.0,
        "suv_mean": float(gq.suv_mean) if gq.suv_mean is not None else 0.0,
        "mtv": float(gq.mtv) if gq.mtv is not None else 0.0,
        "tlg": float(gq.tlg) if gq.tlg is not None else 0.0,
        "lesion_count": float(len(rx.lesions or [])),
        "grade_label": label,
        "grade_binary": LABEL_MAP.get(label, -1),
    }


def _resolve_label(rec: PetCtInterviewRecord) -> str | None:
    rx = rec.research_extensions
    stored = (rx.pathology_grade or "").strip()
    if stored in LABEL_MAP:
        return stored
    result = analyze_case(rec)
    label = result.grading.grade_label
    return label if label in LABEL_MAP else None


def build_dataset_from_db(db: Session) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows_orm = db.execute(select(PetCtCaseORM).order_by(PetCtCaseORM.id.desc()).limit(5000)).scalars().all()
    rows: list[dict[str, Any]] = []
    skipped = 0
    for orm in rows_orm:
        rec = pet_ct_case.orm_to_record(orm)
        label = _resolve_label(rec)
        if label is None:
            skipped += 1
            continue
        rows.append(record_to_feature_row(rec, label))

    meta = {
        "source": "database",
        "total_cases_in_db": len(rows_orm),
        "labeled_rows": len(rows),
        "skipped_unlabeled": skipped,
        "high_grade_count": sum(1 for r in rows if r["grade_label"] == "高级别"),
        "low_grade_count": sum(1 for r in rows if r["grade_label"] == "低级别"),
    }
    return rows, meta


def export_training_csv(db: Session) -> dict[str, Any]:
    """导出训练 CSV 到 data/training/pathology_training.csv。"""
    try:
        import pandas as pd
    except ImportError as e:
        raise RuntimeError("请安装 pandas：pip install pandas") from e

    rows, meta = build_dataset_from_db(db)
    if not rows:
        raise ValueError(
            "没有可导出的标注数据。请先在「病历输入」打开「解析后直接入库」上传 DICOM/JSON，"
            "并确保病例含临床诊断或病理分级线索。"
        )

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)
    df.to_csv(CSV_PATH, index=False, encoding="utf-8-sig")

    return {
        "csv_path": str(CSV_PATH),
        "total_rows": len(rows),
        "high_grade_count": meta["high_grade_count"],
        "low_grade_count": meta["low_grade_count"],
        "preview": rows[:10],
        "meta": meta,
    }


def train_pathology_classifier(db: Session) -> dict[str, Any]:
    """读取 CSV 或数据库，训练 RandomForest 二分类模型。"""
    try:
        import joblib
        import pandas as pd
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import accuracy_score
        from sklearn.model_selection import train_test_split
    except ImportError as e:
        raise RuntimeError("请安装训练依赖：pip install pandas scikit-learn joblib") from e

    if CSV_PATH.is_file():
        df = pd.read_csv(CSV_PATH)
    else:
        rows, _ = build_dataset_from_db(db)
        if not rows:
            raise ValueError("无训练数据，请先导出训练集。")
        df = pd.DataFrame(rows)

    df = df[df["grade_binary"].isin([0, 1])].copy()
    if len(df) < 4:
        raise ValueError(f"有效样本仅 {len(df)} 条，至少需要 4 条（建议高级别/低级别各 80 例左右）。")

    feature_cols = [
        "age",
        "gender_code",
        "height_cm",
        "weight_kg",
        "suv_max",
        "suv_mean",
        "mtv",
        "tlg",
        "lesion_count",
    ]
    X = df[feature_cols].fillna(0.0)
    y = df["grade_binary"].astype(int)

    test_size = 0.25 if len(df) >= 8 else 0.2
    stratify = y if len(y.unique()) > 1 and len(df) >= 8 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify
    )

    clf = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    accuracy = float(accuracy_score(y_test, y_pred)) if len(y_test) else 1.0

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": clf, "feature_cols": feature_cols, "label_map": INV_LABEL_MAP}, MODEL_PATH)

    meta = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "samples_total": int(len(df)),
        "samples_train": int(len(X_train)),
        "samples_test": int(len(X_test)),
        "accuracy": accuracy,
        "high_grade_count": int((y == 1).sum()),
        "low_grade_count": int((y == 0).sum()),
        "feature_cols": feature_cols,
        "model_path": str(MODEL_PATH),
    }
    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "ok": True,
        "message": "模型训练完成",
        "accuracy": accuracy,
        "samples": int(len(df)),
        "high_grade_count": meta["high_grade_count"],
        "low_grade_count": meta["low_grade_count"],
        "model_path": str(MODEL_PATH),
        "feature_cols": feature_cols,
        "meta": meta,
    }


def get_training_status(db: Session) -> dict[str, Any]:
    rows_orm = db.execute(select(PetCtCaseORM)).scalars().all()
    meta: dict[str, Any] = {}
    if META_PATH.is_file():
        try:
            meta = json.loads(META_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            meta = {}

    return {
        "db_case_count": len(rows_orm),
        "csv_exists": CSV_PATH.is_file(),
        "csv_path": str(CSV_PATH),
        "model_exists": MODEL_PATH.is_file(),
        "model_path": str(MODEL_PATH),
        "last_training": meta,
    }


def predict_with_trained_model(rec: PetCtInterviewRecord) -> dict[str, Any] | None:
    """若已训练模型，返回预测结果；否则 None。"""
    if not MODEL_PATH.is_file():
        return None
    try:
        import joblib
    except ImportError:
        return None

    bundle = joblib.load(MODEL_PATH)
    clf = bundle["model"]
    feature_cols: list[str] = bundle["feature_cols"]
    label_map: dict[int, str] = bundle.get("label_map", INV_LABEL_MAP)

    label_hint = _resolve_label(rec) or "高级别"
    row = record_to_feature_row(rec, label_hint)
    import pandas as pd

    X = pd.DataFrame([{c: row[c] for c in feature_cols}])
    pred = int(clf.predict(X)[0])
    proba = clf.predict_proba(X)[0]
    return {
        "grade_label": label_map.get(pred, "未确定"),
        "confidence": float(max(proba)),
        "probabilities": {label_map.get(i, str(i)): float(p) for i, p in enumerate(proba)},
        "source": "trained_model",
    }
