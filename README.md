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

### 入口

**病历输入 → 模型训练** 标签页，或命令行 `python3 -m ml.train_pathology`（需先 `cd backend`）。

### 病理分级怎么训？

| 步骤 | 操作 |
|------|------|
| 1 | **数据上传**：批量上传 DICOM / JSON，打开 **「解析后直接入库」** |
| 2 | **准备标签**：每例需能区分 **高级别** / **低级别**（见下方标注方式） |
| 3 | **样本量**：建议高级别 ~80 + 低级别 ~80（至少 4 例才能训练） |
| 4 | **导出** → **开始训练** → 到 **诊断结果** 验证 |

**标签标注方式（三选一）：**

- **临床诊断文本**：如「卵巢高级别浆液性癌」「低级别浆液性癌」「G1 内膜样癌」
- **JSON 字段**：`research_extensions.pathology_grade` = `高级别` 或 `低级别`
- **影像辅助**：上传带 SUV/病灶描述的 DICOM，系统辅助推断（最终以病理为准）

### 影像诊断怎么训？

- **未上传影像**：模型仅使用临床特征（年龄、性别、身高体重等）
- **已上传影像**：自动加入 SUVmax、MTV、TLG、病灶数等影像特征
- **纯影像深度学习**（CNN）：当前为表格特征 + XGBoost；如需 CT/MRI 端到端分类，需在 `ml/` 扩展并自备标注 DICOM

### 命令行

```bash
cd backend
# macOS 请用 python3；若已 source ../.venv/bin/activate 则可用 python
pip3 install -r requirements.txt \
  -i https://pypi.tuna.tsinghua.edu.cn/simple \
  --trusted-host pypi.tuna.tsinghua.edu.cn
python3 -m ml.train_pathology export
python3 -m ml.train_pathology train
python3 -m ml.train_pathology status
```

训练完成后，**诊断结果** 模块将优先使用 `models/pathology_grade_classifier.joblib` 预测病理分级。

### pip 安装失败（SSL / 连不上 PyPI）

若出现 `SSLError` 或 `No matching distribution found for xgboost`，改用国内镜像：

```bash
pip3 install -r requirements.txt \
  -i https://pypi.tuna.tsinghua.edu.cn/simple \
  --trusted-host pypi.tuna.tsinghua.edu.cn
```

仅装 XGBoost：

```bash
pip3 install xgboost \
  -i https://pypi.tuna.tsinghua.edu.cn/simple \
  --trusted-host pypi.tuna.tsinghua.edu.cn
```

## 技术栈

- **后端**：Python 3.12, FastAPI, SQLAlchemy, pydicom, LangChain
- **前端**：React 18, TypeScript, Vite, Ant Design
- **数据库**：SQLite（默认）/ PostgreSQL（可选）

## 许可证

MIT
