# PMP Agent

病理诊断智能体平台 — 基于 DICOM 影像与临床数据的肿瘤辅助诊断与科研转化系统。

## 功能概览

| 步骤 | 模块 | 说明 |
|------|------|------|
| 1 | 病历输入 | DICOM 批量上传、临床诊断录入、**模型训练**（导出 CSV + 训练分类器） |
| 2 | 诊断结果 | 临床诊断 · 病理分级（高/低级别）· WHO 分级 · 综合评分 |
| 3 | 治疗推荐 | 个体化治疗方案、MDT 建议、指南参考 |
| 4 | 随访队列 | 队列筛选、随访对比、病理衔接 |
| 5 | 知识积累 | 医生输入指标，分析相关因素并推荐文献 |
| 6 | 科研与转化 | 科研智能体分析 + 材料、综述、大纲与 PPT |

## 项目结构

```
PMPAgent/
├── backend/          # FastAPI 后端 API
├── frontend/         # React + Vite + Ant Design 前端
├── deploy/           # nginx / systemd 部署示例
├── docs/             # 部署文档
├── start.sh          # 一键启动前后端
└── README.md
```

## 快速开始（一键启动）

```bash
git clone https://github.com/MermaidLiu/LingX-Agent.git
cd LingX-Agent
chmod +x start.sh
./start.sh
```

启动后访问：

- 前端工作台：http://127.0.0.1:5173
- 后端 API：http://127.0.0.1:8000
- API 文档：http://127.0.0.1:8000/docs

按 `Ctrl+C` 可同时停止前后端。

### 自定义端口

```bash
BACKEND_PORT=8001 FRONTEND_PORT=5174 ./start.sh
```

## 手动启动

### 后端

```bash
cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 可选
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

## 环境变量

在 `backend/.env` 中配置（参考 `backend/.env.example`）：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | 大模型 API Key（留空则走离线演示模式） |
| `DEMO_MODE` | `true` 时强制离线演示 |
| `DATABASE_URL` | 默认 SQLite，可换 PostgreSQL |

## 模型训练

在 **病历输入 → 模型训练** 标签页：

1. 上传 DICOM/JSON 并开启 **「解析后直接入库」**
2. 点击 **导出训练数据**（生成 `data/training/pathology_training.csv`）
3. 点击 **开始训练**（保存至 `models/pathology_grade_classifier.joblib`）

命令行（在 `backend` 目录）：

```bash
pip install pandas scikit-learn joblib
python -m ml.train_pathology export
python -m ml.train_pathology train
python -m ml.train_pathology status
```

训练完成后，**诊断结果** 模块将优先使用已训练模型预测病理分级。

## 技术栈

- **后端**：Python 3.12, FastAPI, SQLAlchemy, pydicom, LangChain
- **前端**：React 18, TypeScript, Vite, Ant Design
- **数据库**：SQLite（默认）/ PostgreSQL（可选）

## 许可证

MIT
