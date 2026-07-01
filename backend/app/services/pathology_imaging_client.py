"""External pathology grading from DICOM via classmate CT module API."""

from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path
from typing import Any

import httpx

from app.core.config import settings

DEFAULT_PATHOLOGY_IMAGING_API_URL = "http://42.81.102.195:8000/ct-module/dicom/upload"
DICOM_SUFFIXES = frozenset({".dcm", ".dicom"})
IMAGING_GRADE_TASK_IDS = frozenset({"grade-pred", "grade-subtype"})

_GRADE_KEY_HINTS = (
    "grade",
    "grade_label",
    "pathology_grade",
    "prediction",
    "predicted_class",
    "class",
    "label",
    "result",
    "diagnosis",
    "level",
)
_CONF_KEY_HINTS = ("confidence", "score", "probability", "prob", "certainty")
_IMAGE_KEY_HINTS = (
    "image",
    "result_image",
    "resultImage",
    "png",
    "base64",
    "result_base64",
    "resultBase64",
    "visualization",
    "overlay",
)


def is_imaging_grade_task(task_id: str) -> bool:
    return task_id in IMAGING_GRADE_TASK_IDS


def collect_dicom_files(file_items: list[tuple[str, bytes]] | None) -> list[tuple[str, bytes]]:
    """Extract .dcm / .dicom from uploads and ZIP archives."""
    if not file_items:
        return []
    out: list[tuple[str, bytes]] = []
    for name, content in file_items:
        suffix = Path(name).suffix.lower()
        if suffix in DICOM_SUFFIXES:
            out.append((name, content))
        elif suffix == ".zip":
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    for member in zf.namelist():
                        if member.endswith("/"):
                            continue
                        if Path(member).suffix.lower() in DICOM_SUFFIXES:
                            out.append((member, zf.read(member)))
            except zipfile.BadZipFile:
                continue
    # 去重：避免前端重复上传同一文件导致数量翻倍
    seen: set[tuple[str, int]] = set()
    unique: list[tuple[str, bytes]] = []
    for name, content in out:
        key = (Path(name).name.lower(), len(content))
        if key in seen:
            continue
        seen.add(key)
        unique.append((name, content))
    return unique


def _slim_raw_for_client(data: Any, *, max_str_len: int = 400) -> Any:
    """Remove large base64 / binary blobs from API payload before sending to the browser."""
    if isinstance(data, dict):
        out: dict[str, Any] = {}
        for key, value in data.items():
            key_lower = str(key).lower()
            if any(h in key_lower for h in ("base64", "image", "png", "jpg", "jpeg", "dicom", "slice", "buffer", "bytes")):
                if isinstance(value, str) and len(value) > max_str_len:
                    out[key] = f"<omitted {len(value)} chars>"
                    continue
                if isinstance(value, list) and len(value) > 3:
                    out[key] = f"<omitted list len={len(value)}>"
                    continue
            slimmed = _slim_raw_for_client(value, max_str_len=max_str_len)
            if isinstance(slimmed, str) and len(slimmed) > max_str_len * 2:
                out[key] = f"<omitted {len(slimmed)} chars>"
            else:
                out[key] = slimmed
        return out
    if isinstance(data, list):
        if len(data) > 20:
            return f"<omitted list len={len(data)}>"
        return [_slim_raw_for_client(item, max_str_len=max_str_len) for item in data]
    if isinstance(data, str) and len(data) > max_str_len:
        return f"<omitted {len(data)} chars>"
    return data


def _normalize_grade_text(raw: Any) -> str:
    if raw is None:
        return ""
    text = str(raw).strip()
    if not text:
        return ""
    if re.search(r"高|high|G3|III", text, re.I):
        return "高级别"
    if re.search(r"低|low|G1|I级|良性", text, re.I):
        return "低级别"
    return text


def _find_in_obj(obj: Any, key_hints: tuple[str, ...]) -> Any:
    if isinstance(obj, dict):
        lower_map = {str(k).lower(): k for k in obj.keys()}
        for hint in key_hints:
            h = hint.lower()
            if h in lower_map:
                val = obj[lower_map[h]]
                if val is not None and str(val).strip() != "":
                    return val
        for v in obj.values():
            found = _find_in_obj(v, key_hints)
            if found is not None and str(found).strip() != "":
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _find_in_obj(item, key_hints)
            if found is not None and str(found).strip() != "":
                return found
    return None


def parse_grading_response(data: Any) -> dict[str, Any]:
    """Map unknown API JSON into a stable internal shape."""
    if not isinstance(data, dict):
        return {
            "status": "error",
            "message": "外部接口返回非 JSON 对象",
            "grade_label": "",
            "confidence": None,
            "result_image_base64": "",
            "raw": data,
        }

    grade_raw = _find_in_obj(data, _GRADE_KEY_HINTS)
    conf_raw = _find_in_obj(data, _CONF_KEY_HINTS)
    image_raw = _find_in_obj(data, _IMAGE_KEY_HINTS)

    grade_label = _normalize_grade_text(grade_raw) or (str(grade_raw).strip() if grade_raw else "")
    confidence: float | None = None
    if conf_raw is not None:
        try:
            confidence = float(conf_raw)
            if confidence > 1.0:
                confidence = confidence / 100.0
        except (TypeError, ValueError):
            confidence = None

    image_b64 = ""
    if isinstance(image_raw, str):
        image_b64 = image_raw
        if image_b64.startswith("data:image"):
            image_b64 = image_b64.split(",", 1)[-1]

    msg_parts: list[str] = []
    if grade_label:
        msg_parts.append(f"影像诊断分析：{grade_label}")
    if confidence is not None:
        msg_parts.append(f"置信度 {(confidence * 100):.0f}%")
    api_msg = data.get("message") or data.get("msg") or data.get("detail")
    if api_msg and str(api_msg) not in msg_parts:
        msg_parts.append(str(api_msg))

    return {
        "status": "ok" if grade_label or image_b64 else "ok",
        "message": " · ".join(msg_parts) if msg_parts else "DICOM 已提交至影像诊断分析服务",
        "grade_label": grade_label,
        "confidence": confidence,
        "result_image_base64": image_b64,
        "raw": _slim_raw_for_client(data),
    }


async def predict_grade_from_imaging(
    files: list[tuple[str, bytes]] | None = None,
    *,
    return_base64: bool = True,
) -> dict[str, Any]:
    """Upload DICOM files to external pathology grading service."""
    dicom_files = collect_dicom_files(files)
    if not dicom_files:
        return {
            "status": "skipped",
            "message": "未检测到 DICOM 文件（.dcm / .dicom 或含 DICOM 的 ZIP），跳过影像诊断分析。",
            "grade_label": "",
            "confidence": None,
            "result_image_base64": "",
            "dicom_count": 0,
            "raw": {},
        }

    url = (settings.pathology_imaging_api_url or DEFAULT_PATHOLOGY_IMAGING_API_URL).strip()
    read_timeout = max(60.0, float(settings.pathology_imaging_api_timeout))
    timeout = httpx.Timeout(connect=30.0, read=read_timeout, write=300.0, pool=30.0)

    multipart_files: list[tuple[str, tuple[str, bytes, str]]] = []
    for idx, (name, content) in enumerate(dicom_files):
        fname = Path(name).name or f"slice_{idx + 1}.dcm"
        if Path(fname).suffix.lower() not in DICOM_SUFFIXES:
            fname = f"{fname}.dcm"
        multipart_files.append(("files", (fname, content, "application/dicom")))

    form_data = {"returnBase64": "true" if return_base64 else "false"}

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, files=multipart_files, data=form_data)
            resp.raise_for_status()
            payload = resp.json()
    except httpx.TimeoutException:
        return {
            "status": "error",
            "message": f"影像诊断分析接口超时（连接 30s / 读取 {int(read_timeout)}s），分析通常需约 5 分钟，请稍后重试或增大 PATHOLOGY_IMAGING_API_TIMEOUT：{url}",
            "grade_label": "",
            "confidence": None,
            "result_image_base64": "",
            "dicom_count": len(dicom_files),
            "raw": {},
        }
    except httpx.HTTPStatusError as e:
        detail = e.response.text[:500] if e.response is not None else str(e)
        return {
            "status": "error",
            "message": f"影像诊断分析接口 HTTP {e.response.status_code}：{detail}",
            "grade_label": "",
            "confidence": None,
            "result_image_base64": "",
            "dicom_count": len(dicom_files),
            "raw": {},
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"影像诊断分析接口调用失败：{e}",
            "grade_label": "",
            "confidence": None,
            "result_image_base64": "",
            "dicom_count": len(dicom_files),
            "raw": {},
        }

    parsed = parse_grading_response(payload)
    parsed["dicom_count"] = len(dicom_files)
    if parsed["status"] == "ok" and not parsed.get("message"):
        parsed["message"] = f"已分析 {len(dicom_files)} 个 DICOM 切片"
    return parsed
