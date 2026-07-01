#!/usr/bin/env bash
# PMP Agent 服务器一键部署（Ubuntu 22.04+）
# 用法（在仓库根目录）：
#   sudo bash deploy/deploy-server.sh
# 国内 pip 镜像：
#   sudo PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple bash deploy/deploy-server.sh
# 指定域名（写入 nginx server_name 与 CORS）：
#   sudo SERVER_NAME=petct.example.com bash deploy/deploy-server.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
WEB_ROOT="${WEB_ROOT:-/var/www/lingxi/dist}"
SERVICE_NAME="${SERVICE_NAME:-pmp-backend}"
NGINX_SITE="${NGINX_SITE:-pmp-agent}"
SERVER_NAME="${SERVER_NAME:-_}"
PIP_INDEX_URL="${PIP_INDEX_URL:-}"
RUN_USER="${SUDO_USER:-${USER:-ubuntu}}"

log() { printf '[deploy] %s\n' "$*"; }
die() { log "错误: $*"; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "请使用 sudo 运行：sudo bash deploy/deploy-server.sh"

export DEBIAN_FRONTEND=noninteractive

log "项目目录: $ROOT"

log "安装系统依赖…"
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip nginx curl git ca-certificates

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]]; then
  log "安装 Node.js 20…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

log "配置后端虚拟环境…"
if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
python3 -m pip install -q --upgrade pip --default-timeout=120 ${PIP_INDEX_URL:+-i "$PIP_INDEX_URL"}
python3 -m pip install -q --default-timeout=120 ${PIP_INDEX_URL:+-i "$PIP_INDEX_URL"} -r "$BACKEND_DIR/requirements.txt"

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  log "已创建 backend/.env（可按需编辑）"
fi

if [[ "$SERVER_NAME" != "_" ]]; then
  ORIGIN="https://${SERVER_NAME}"
  if ! grep -q '^CORS_ORIGINS=' "$BACKEND_DIR/.env"; then
    echo "CORS_ORIGINS=${ORIGIN}" >> "$BACKEND_DIR/.env"
  fi
fi

if ! grep -q '^PATHOLOGY_IMAGING_API_URL=' "$BACKEND_DIR/.env"; then
  echo "PATHOLOGY_IMAGING_API_URL=http://42.81.102.195:8000/ct-module/dicom/upload" >> "$BACKEND_DIR/.env"
fi
if ! grep -q '^PATHOLOGY_IMAGING_API_TIMEOUT=' "$BACKEND_DIR/.env"; then
  echo "PATHOLOGY_IMAGING_API_TIMEOUT=420" >> "$BACKEND_DIR/.env"
fi

log "构建前端…"
cd "$FRONTEND_DIR"
if [[ -f package-lock.json ]]; then
  npm ci --silent
else
  npm install --silent
fi
npm run build --silent

log "发布静态文件到 $WEB_ROOT …"
mkdir -p "$(dirname "$WEB_ROOT")"
rm -rf "$WEB_ROOT"
cp -a dist "$WEB_ROOT"
chown -R "$RUN_USER":"$RUN_USER" "$(dirname "$WEB_ROOT")" 2>/dev/null || true

log "写入 systemd 服务 $SERVICE_NAME …"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=PMP Agent backend (uvicorn)
After=network.target

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_USER}
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${BACKEND_DIR}/.env
ExecStart=${VENV_DIR}/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

log "写入 Nginx 站点 $NGINX_SITE …"
cat > "/etc/nginx/sites-available/${NGINX_SITE}" <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${WEB_ROOT};
    index index.html;

    client_max_body_size 100m;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host \$host;
    }

    location /schema/ {
        proxy_pass http://127.0.0.1:8000/schema/;
        proxy_set_header Host \$host;
    }
}
EOF

ln -sf "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

log "启动服务…"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
nginx -t
systemctl reload nginx

for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/health >/dev/null; then
    break
  fi
  sleep 2
done

PUBLIC_IP="$(curl -sf --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

log "部署完成 ✓"
log "  站点: http://${PUBLIC_IP}  （若已绑定域名: http://${SERVER_NAME}）"
log "  健康检查: http://${PUBLIC_IP}/health"
log "  API 文档: http://${PUBLIC_IP}/docs  （经 Nginx 反代需直连 8000 或自行加 location）"
log "  后端日志: journalctl -u ${SERVICE_NAME} -f"
log "  重载后端: systemctl restart ${SERVICE_NAME}"
