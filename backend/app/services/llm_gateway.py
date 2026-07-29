"""Unified OpenAI-compatible LLM gateway (ReachAPI / DeepSeek / OpenAI).

Prefer REACHAPI_* env, then fall back to OPENAI_* / DEEPSEEK_* for compatibility.
Default chat path uses POST {base}/chat/completions.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_REACHAPI_BASE = "https://direct.reachapi.ai/v1"
DEFAULT_CHAT_MODEL = "gpt-5.4-mini"


def llm_api_key() -> str:
    return (
        settings.reachapi_api_key
        or settings.openai_api_key
        or settings.deepseek_api_key
        or ""
    ).strip()


def llm_base_url() -> str:
    base = (
        settings.reachapi_base_url
        or settings.openai_base_url
        or settings.deepseek_base_url
        or DEFAULT_REACHAPI_BASE
    )
    return str(base).strip().rstrip("/")


def llm_chat_model() -> str:
    return (
        settings.reachapi_chat_model
        or settings.deepseek_chat_model
        or settings.research_llm_model
        or DEFAULT_CHAT_MODEL
    ).strip()


def is_llm_available() -> bool:
    if settings.demo_mode:
        return False
    return bool(llm_api_key())


def llm_auth_headers() -> dict[str, str]:
    """ReachAPI OpenAI-compatible auth — must be: Authorization: Bearer <key>."""
    key = llm_api_key()
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


async def chat_completions(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 2048,
    timeout: float = 120.0,
) -> tuple[str, str]:
    """Return (content, model_id). Raises on HTTP / empty response."""
    if not is_llm_available():
        raise RuntimeError("LLM API Key 未配置（请在 backend/.env 设置 REACHAPI_API_KEY）")

    model_id = (model or llm_chat_model()).strip()
    url = f"{llm_base_url()}/chat/completions"
    headers = llm_auth_headers()
    body = {
        "model": model_id,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, headers=headers, json=body)
        if resp.status_code >= 400:
            # Surface ReachAPI body so ops can verify header / model / balance
            detail = (resp.text or "")[:800]
            logger.error(
                "ReachAPI chat failed status=%s url=%s model=%s auth_scheme=%s body=%s",
                resp.status_code,
                url,
                model_id,
                "Bearer" if headers.get("Authorization", "").startswith("Bearer ") else "missing",
                detail,
            )
            raise RuntimeError(f"ReachAPI HTTP {resp.status_code}: {detail}")
        data = resp.json()
    if isinstance(data, dict) and data.get("error"):
        err = data["error"]
        msg = err.get("message") if isinstance(err, dict) else str(err)
        raise RuntimeError(f"ReachAPI error: {msg}")
    choices = data.get("choices") or []
    if not choices:
        raise ValueError(f"LLM 返回空 choices: {str(data)[:400]}")
    content = (choices[0].get("message") or {}).get("content") or ""
    content = str(content).strip()
    if not content:
        raise ValueError("LLM 返回空内容")
    return content, model_id


async def list_models(*, timeout: float = 20.0) -> list[dict[str, Any]]:
    """GET /models — ReachAPI returns OpenAI-style { data: [{ id, ... }] }."""
    if not is_llm_available():
        return []
    url = f"{llm_base_url()}/models"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, headers=llm_auth_headers())
            resp.raise_for_status()
            data = resp.json()
        rows = data.get("data") if isinstance(data, dict) else data
        if not isinstance(rows, list):
            return []
        return [r for r in rows if isinstance(r, dict) and r.get("id")]
    except Exception as exc:
        logger.warning("ReachAPI /models failed: %s", exc)
        return []


async def count_models() -> int:
    return len(await list_models())
