#!/usr/bin/env bash
# PMP Agent 一键启动：后端 FastAPI + 前端 Vite 开发服务
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
VENV_DIR="$ROOT/.venv"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"

BACKEND_PID=""
FRONTEND_PID=""

log() { printf '[PMP Agent] %s\n' "$*"; }
die() { log "错误: $*"; exit 1; }

cleanup() {
  log "正在停止服务…"
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  log "已退出"
}
trap cleanup EXIT INT TERM

port_busy() {
  lsof -i ":$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

ensure_python() {
  command -v python3 >/dev/null 2>&1 || die "未找到 python3，请先安装 Python 3.10+"
}

ensure_node() {
  command -v npm >/dev/null 2>&1 || die "未找到 npm，请先安装 Node.js 18+"
}

setup_backend() {
  log "配置后端虚拟环境…"
  if [[ ! -d "$VENV_DIR" ]]; then
    python3 -m venv "$VENV_DIR"
  fi
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
  python3 -m pip install -q --upgrade pip --default-timeout=120 ${PIP_INDEX_URL:+-i "$PIP_INDEX_URL"}
  python3 -m pip install -q --default-timeout=120 ${PIP_INDEX_URL:+-i "$PIP_INDEX_URL"} -r "$BACKEND_DIR/requirements.txt"
  if [[ ! -f "$BACKEND_DIR/.env" && -f "$BACKEND_DIR/.env.example" ]]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    log "已从 .env.example 创建 backend/.env"
  fi
}

setup_frontend() {
  log "安装前端依赖…"
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    (cd "$FRONTEND_DIR" && npm install)
  fi
}

start_backend() {
  if port_busy "$BACKEND_PORT"; then
    die "端口 $BACKEND_PORT 已被占用。可执行: kill \$(lsof -t -i :$BACKEND_PORT) 或设置 BACKEND_PORT=8001"
  fi
  log "启动后端 http://${BACKEND_HOST}:${BACKEND_PORT}（首次加载可能需 1–2 分钟）"
  (
    cd "$BACKEND_DIR"
    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate"
    exec uvicorn app.main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
  ) &
  BACKEND_PID=$!

  for i in $(seq 1 180); do
    if curl -sf "http://${BACKEND_HOST}:${BACKEND_PORT}/health" >/dev/null 2>&1; then
      log "后端就绪 ✓"
      return
    fi
    if (( i % 15 == 0 )); then
      log "仍在等待后端就绪… (${i}s)"
    fi
    sleep 1
  done
  die "后端启动超时（180s），请手动运行: cd backend && source ../.venv/bin/activate && uvicorn app.main:app --reload --port 8000"
}

start_frontend() {
  if port_busy "$FRONTEND_PORT"; then
    die "端口 $FRONTEND_PORT 已被占用。可设置 FRONTEND_PORT=5174"
  fi
  log "启动前端 http://127.0.0.1:${FRONTEND_PORT}"
  (
    cd "$FRONTEND_DIR"
    export VITE_PROXY_TARGET="http://${BACKEND_HOST}:${BACKEND_PORT}"
    exec npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT"
  ) &
  FRONTEND_PID=$!
  sleep 2
  log "前端已启动 ✓"
}

main() {
  log "PMP Agent 一键部署"
  ensure_python
  ensure_node
  setup_backend
  setup_frontend
  start_backend
  start_frontend
  log "全部就绪"
  log "  前端: http://127.0.0.1:${FRONTEND_PORT}"
  log "  后端: http://${BACKEND_HOST}:${BACKEND_PORT}"
  log "  API 文档: http://${BACKEND_HOST}:${BACKEND_PORT}/docs"
  log "按 Ctrl+C 停止前后端"
  wait
}

main "$@"
