"""应用配置：不依赖 pydantic-settings，仅使用 pydantic.BaseModel + 环境变量 / .env。"""

from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field


def _load_dotenv() -> None:
    """从 backend 目录下的 .env 注入环境变量（不覆盖已存在的变量）。"""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def _e(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _e_opt(key: str) -> str | None:
    v = os.environ.get(key)
    return v if v else None


def _e_bool(key: str, default: bool = False) -> bool:
    v = os.environ.get(key)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _e_cors_origins() -> list[str]:
    """逗号分隔；留空则仅允许本地 Vite 开发源。"""
    raw = (_e("CORS_ORIGINS", "") or "").strip()
    if not raw:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]
    return [x.strip() for x in raw.split(",") if x.strip()]


_load_dotenv()


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    app_name: str = Field(default_factory=lambda: _e("APP_NAME", "PMP Agent"))
    api_prefix: str = Field(default_factory=lambda: _e("API_PREFIX", "/api/v1"))
    database_url: str = Field(default_factory=lambda: _e("DATABASE_URL", "sqlite:///./petct_research.db"))
    mongodb_url: str = Field(default_factory=lambda: _e("MONGODB_URL", "mongodb://localhost:27017"))
    openai_api_key: str = Field(default_factory=lambda: _e("OPENAI_API_KEY", ""))
    openai_base_url: str | None = Field(default_factory=lambda: _e_opt("OPENAI_BASE_URL"))
    research_llm_model: str = Field(default_factory=lambda: _e("RESEARCH_LLM_MODEL", "gpt-4o"))
    deepseek_api_key: str = Field(default_factory=lambda: _e("DEEPSEEK_API_KEY", ""))
    deepseek_base_url: str = Field(default_factory=lambda: _e("DEEPSEEK_BASE_URL", "https://api.deepseek.com"))
    deepseek_chat_model: str = Field(default_factory=lambda: _e("DEEPSEEK_CHAT_MODEL", "deepseek-chat"))
    petct_model_path: str = Field(default_factory=lambda: _e("PETCT_MODEL_PATH", "models/petct_seg_model.pth"))
    demo_mode: bool = Field(default_factory=lambda: _e_bool("DEMO_MODE", False))
    pathology_imaging_api_url: str = Field(
        default_factory=lambda: _e(
            "PATHOLOGY_IMAGING_API_URL",
            "http://42.81.102.195:8000/ct-module/dicom/upload",
        )
    )
    pathology_imaging_api_timeout: float = Field(
        default_factory=lambda: float(_e("PATHOLOGY_IMAGING_API_TIMEOUT", "420"))
    )
    cors_allow_origins: list[str] = Field(default_factory=_e_cors_origins)


settings = Settings()
