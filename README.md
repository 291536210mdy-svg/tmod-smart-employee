# TMOD 智能员工

面向团队业务线的智能体平台第一版。当前已接入的业务线是 `AI评优`，支持上传评优源数据 Excel、发起评优任务、查看运行状态、QA 报告、候选结果和下载产物。

## 项目结构

- `review_batch.py`：评优批处理核心逻辑。
- `review_platform/server`：FastAPI 后端、SQLite 数据库、运行管理、业务线注册和 REST/SSE API。
- `review_platform/frontend`：Vite React 前端，采用 chat-first 的智能员工交互外壳。
- `*.md`：评优流程、平台化路线和实现说明文档。

## 本地启动

后端：

```powershell
cd review_platform/server
pip install -r requirements.txt
python run_server.py
```

前端：

```powershell
cd review_platform/frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

访问：

- 前端：http://127.0.0.1:5173
- 后端健康检查：http://127.0.0.1:8000/api/health

本地开发默认账号：

- 用户名：`admin`
- 密码：`admin123`

## 环境变量

后端环境变量示例见：

- `review_platform/server/.env.example.local`
- `review_platform/server/.env.example.server`

正式部署前必须替换：

- `SECRET_KEY`
- `SEED_ADMIN_PASSWORD`
- `DIFY_BASE_URL`
- `DIFY_REVIEW_WORKFLOW_API_KEY`
- `DIFY_RANKING_REASON_WORKFLOW_API_KEY`

## 注意

本仓库不包含本地运行输出、SQLite 数据库、`.env`、`node_modules`、前端构建产物和源数据运行结果。
