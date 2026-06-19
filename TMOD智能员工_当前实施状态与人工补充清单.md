# TMOD智能员工当前实施状态与人工补充清单

生成日期：2026-06-19  
项目目录：`E:\工作文件夹\TMOD\6月评优\testing`

## 一句话结论

当前版本已经从“本地单机评优工具”推进到“具备生产化外壳的第一版平台”：本地仍可直接运行，同时已经补上生产配置、上传安全、用户管理、运行记录治理、PostgreSQL/Alembic、Redis/Celery、对象存储接口、Docker、systemd、Nginx、K8s 清单和 CI。

但需要明确：PostgreSQL、Redis/Celery、S3/对象存储、K8s 目前是“代码与部署资产已接入”，还没有在真实云服务器、真实域名、真实数据库、真实对象存储和真实 K8s 集群上完成上线验证。

## 已完成

### 1. 生产配置基线

已完成内容：

- 后端 `reload` 已从硬编码开启改为配置项 `DEBUG_RELOAD`。
- 默认 `DEBUG_RELOAD=false`，避免生产环境自动 reload。
- 增加 CORS 白名单配置 `CORS_ALLOW_ORIGINS`。
- 增加上传文件大小配置 `UPLOAD_MAX_BYTES`。
- 增加上传文件扩展名配置 `UPLOAD_ALLOWED_EXTENSIONS`。
- 新增生产环境样例文件：
  - `review_platform/server/.env.example.production`
- 更新本地和服务器样例文件：
  - `review_platform/server/.env.example.local`
  - `review_platform/server/.env.example.server`

关键文件：

- `review_platform/server/app/core/config.py`
- `review_platform/server/app/main.py`
- `review_platform/server/run_server.py`

### 2. 上传安全加固

已完成内容：

- 上传入口限制为 `.xlsx`。
- 前端文件选择器也从 `.xlsx,.xls` 改为 `.xlsx`。
- 后端上传时先写入临时文件，再创建运行任务。
- 校验空文件。
- 校验文件大小是否超过配置上限。
- 使用 `openpyxl` 检查 Excel 是否能打开。
- 检查至少存在一个可见工作表。
- 检查至少包含表头和一行数据。
- 错误提示改为更适合非技术用户理解的中文。

关键文件：

- `review_platform/server/app/api/routes/runs.py`
- `review_platform/frontend/src/pages/ChatWorkspacePage.tsx`

### 3. 用户管理能力

已完成内容：

- 后端新增管理员用户管理接口：
  - 查看用户列表
  - 创建用户
  - 修改角色
  - 启用/停用用户
  - 重置密码
- 前端新增管理员页面：
  - `review_platform/frontend/src/pages/AdminUsersPage.tsx`
- 管理员可以从左侧栏进入“成员管理”。
- 普通用户不会看到管理员入口。

角色仍保持第一版简化模型：

- `viewer`：查看
- `reviewer`：提交和查看评优任务
- `admin`：管理员

关键文件：

- `review_platform/server/app/api/routes/auth.py`
- `review_platform/server/app/api/schemas.py`
- `review_platform/frontend/src/App.tsx`
- `review_platform/frontend/src/components/Shell.tsx`
- `review_platform/frontend/src/pages/AdminUsersPage.tsx`

### 4. 运行记录归档、删除和保留策略

已完成内容：

- `runs` 表新增字段：
  - `archived`
  - `archived_at`
  - `deleted_at`
- 运行列表默认隐藏归档任务和已删除任务。
- 前端运行记录页增加“含归档”开关。
- 终态任务支持归档和取消归档。
- 管理员支持删除终态任务。
- 删除任务时会尝试清理本地运行目录。
- 新增保留策略清理接口：
  - 根据 `RUN_RETENTION_DAYS`
  - 根据 `RUN_RETENTION_KEEP_LAST`
- 为旧 SQLite 数据库增加轻量自动补列逻辑，避免老库启动时报缺列。

关键文件：

- `review_platform/server/app/db/models.py`
- `review_platform/server/app/db/init_db.py`
- `review_platform/server/app/api/routes/runs.py`
- `review_platform/frontend/src/pages/RunsPage.tsx`

### 5. PostgreSQL 和 Alembic

已完成内容：

- 新增 PostgreSQL 驱动依赖：
  - `psycopg[binary]`
- 新增 Alembic 依赖和迁移目录：
  - `review_platform/server/alembic.ini`
  - `review_platform/server/alembic/env.py`
  - `review_platform/server/alembic/versions/20260619_0001_initial_schema.py`
- Alembic 会读取同一套 `Settings` 中的 `DATABASE_URL`。
- 生产部署时可以执行：

```bash
cd review_platform/server
alembic upgrade head
```

关键文件：

- `review_platform/server/requirements.txt`
- `review_platform/server/alembic.ini`
- `review_platform/server/alembic/`

### 6. Redis 和 Celery

已完成内容：

- 新增 Celery/Redis 依赖：
  - `celery[redis]`
  - `redis`
- 新增运行后端切换配置：
  - `RUN_EXECUTION_BACKEND=thread`
  - `RUN_EXECUTION_BACKEND=celery`
- 本地默认仍使用线程执行，不依赖 Redis。
- 当配置为 `celery` 时，提交任务会进入 Celery 队列。
- 新增 worker 包：
  - `review_platform/server/app/worker/celery_app.py`
  - `review_platform/server/app/worker/tasks.py`
- worker 会自行初始化数据库、数据目录和业务线注册。

关键文件：

- `review_platform/server/app/platform/run_manager.py`
- `review_platform/server/app/worker/`

### 7. 对象存储接口

已完成内容：

- 新增 S3 相关依赖：
  - `boto3`
- 新增对象存储配置：
  - `ARTIFACT_STORAGE_BACKEND`
  - `S3_ENDPOINT_URL`
  - `S3_REGION_NAME`
  - `S3_BUCKET_NAME`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
  - `S3_PREFIX`
- `ArtifactStore` 支持本地和 S3 两种产物存储方式。
- 业务线仍然先生成本地文件。
- 平台层在登记 artifact 时负责上传到 S3。
- 产物下载接口已兼容本地文件和 S3 文件。
- QA 报告读取已兼容本地文件和 S3 文件。

关键文件：

- `review_platform/server/app/platform/artifacts.py`
- `review_platform/server/app/api/routes/artifacts.py`
- `review_platform/server/app/api/routes/candidates.py`

### 8. 部署资产

已完成新增目录：

- `deploy/`

已新增内容：

- Nginx 配置：
  - `deploy/nginx/tmod-smart-employee.conf`
  - `deploy/nginx/tmod-smart-employee.docker.conf`
- systemd 服务：
  - `deploy/systemd/tmod-smart-employee-api.service`
  - `deploy/systemd/tmod-smart-employee-worker.service`
- 脚本：
  - `deploy/scripts/backup_local_data.sh`
  - `deploy/scripts/smoke_test.sh`
- Docker：
  - `deploy/docker/Dockerfile.api`
  - `deploy/docker/Dockerfile.frontend`
  - `deploy/docker/docker-compose.yml`
- K8s：
  - `deploy/k8s/00-namespace.yaml`
  - `deploy/k8s/01-configmap.yaml`
  - `deploy/k8s/02-secret.example.yaml`
  - `deploy/k8s/03-postgres.yaml`
  - `deploy/k8s/04-redis.yaml`
  - `deploy/k8s/05-app.yaml`
  - `deploy/k8s/06-web.yaml`
  - `deploy/k8s/07-ingress.yaml`
- 部署说明：
  - `deploy/README.md`

### 9. CI

已完成内容：

- 新增 GitHub Actions：
  - `.github/workflows/ci.yml`
- CI 包含：
  - 后端依赖安装
  - 后端 `python -m compileall app`
  - 前端 `npm ci`
  - 前端 `npm run build`

### 10. 本地验证

已完成验证：

```bash
python -m compileall app alembic
npm run build
```

已验证接口：

- `GET http://127.0.0.1:8000/api/health`
- `POST http://127.0.0.1:8000/api/auth/login`

本地服务已启动：

- 前端：`http://127.0.0.1:5173/`
- 后端：`http://127.0.0.1:8000/`

当前默认登录：

- 账号：`admin`
- 密码：`admin123`

## 还没完成

### 1. 尚未部署到真实云服务器

目前只是本地开发环境已经跑通，部署资产已经准备好。还没有完成：

- 购买或准备真实云服务器
- 配置公网 IP
- 配置域名
- 配置 HTTPS
- 配置服务器防火墙和安全组
- 配置 Linux 用户、目录和权限
- 配置 Nginx 正式站点
- 配置 systemd 正式服务
- 配置生产日志和服务重启策略验证

### 2. 尚未真实切换到 PostgreSQL

代码已经支持 PostgreSQL，Alembic 迁移也已经准备好，但当前本地仍在使用默认 SQLite。

还没有完成：

- 创建真实 PostgreSQL 实例
- 创建数据库和用户
- 设置 `DATABASE_URL`
- 执行 `alembic upgrade head`
- 验证 API 在 PostgreSQL 下完整运行
- 验证历史运行、候选结果、产物记录、用户管理等表写入正常
- 设置数据库备份策略

### 3. 尚未真实运行 Redis/Celery 队列

代码已经支持 Celery 模式，但当前本地默认仍是 `RUN_EXECUTION_BACKEND=thread`。

还没有完成：

- 启动真实 Redis
- 设置 `RUN_EXECUTION_BACKEND=celery`
- 启动 Celery worker
- 提交真实评优任务验证 worker 消费
- 验证 API 进程和 worker 进程共享数据目录或对象存储
- 验证任务取消、失败、日志、产物生成在 Celery 模式下表现一致

注意：Celery 生产建议跑在 Linux 环境；Windows 本地更适合继续用 `thread` 模式试用。

### 4. 尚未真实接入对象存储

代码已支持 S3-compatible 对象存储，但当前没有真实 bucket 和密钥。

还没有完成：

- 选择对象存储服务，例如阿里云 OSS、腾讯云 COS、AWS S3、MinIO
- 创建 bucket
- 创建访问密钥
- 设置 S3 相关环境变量
- 切换 `ARTIFACT_STORAGE_BACKEND=s3`
- 提交真实任务验证产物上传
- 验证产物下载
- 验证 QA 报告从对象存储读取
- 验证删除运行记录时对象存储清理逻辑

当前对象存储仅覆盖产物 artifact。源数据 Excel 仍保存在本地运行目录；如果未来要完全云原生，需要进一步把输入文件也对象存储化。

### 5. 尚未真实运行 Docker Compose

Docker Compose 文件已经准备好，但还没有执行完整验证。

还没有完成：

- 构建 API 镜像
- 构建 frontend 镜像
- 启动 Postgres、Redis、API、worker、web
- 验证容器间网络
- 验证前端访问 API
- 验证评优任务在容器环境中运行
- 验证 volume 持久化

### 6. 尚未真实运行 K8s

K8s 清单已经准备好，但还没有在真实集群验证。

还没有完成：

- 准备 K8s 集群
- 准备 Ingress Controller
- 准备镜像仓库
- 构建并推送 API 镜像
- 构建并推送 web 镜像
- 替换清单中的 `ghcr.io/your-org/...`
- 创建真实 Secret
- 应用 K8s 清单
- 执行 DB migration Job
- 验证 API、worker、web、Ingress
- 验证 PVC 存储能力

注意：当前 K8s 清单假设有 `ReadWriteMany` 存储用于 API 和 worker 共享本地运行文件。如果集群不支持 RWX，建议优先把输入文件和产物都对象存储化。

### 7. 尚未做完整自动化测试

目前完成的是编译和构建验证，还没有完整测试套件。

还没有完成：

- 后端单元测试
- API 集成测试
- 上传异常测试
- 用户管理接口测试
- 运行归档/删除测试
- Celery 模式测试
- S3 artifact 测试
- 前端 Playwright 端到端测试

### 8. 尚未做生产级安全闭环

第一版已经比本地工具安全很多，但还不是完整企业级安全。

还没有完成：

- SSO
- 企业微信/飞书/钉钉登录
- 更细粒度 RBAC
- 用户操作审计页面
- 密码策略
- 登录失败限流
- CSRF/更严格 Cookie 策略
- HTTPS 强制跳转
- 安全响应头
- 生产日志脱敏

### 9. 尚未完成真实业务端到端验收

还没有用真实源数据完整跑一遍新版本流程并验收：

- 上传真实源数据 Excel
- 选择目标奖项
- dry-run
- 正式跑
- 生成排序结果
- 生成 QA 报告
- 下载产物
- 检查复宏汉霖、复星健康优先级逻辑仍然符合预期
- 检查归档/删除不影响已下载产物

## 需要人手动补充或拍板

### 1. 服务器和部署方式

需要人决定：

- 先买单台云服务器，还是直接上容器/K8s
- 云厂商选择
- 服务器规格
- 操作系统
- 是否使用云数据库
- 是否使用云 Redis
- 是否使用对象存储

建议第一步：

- 单台 Linux 云服务器
- Nginx + systemd
- PostgreSQL 可以先用云数据库或同机自建
- Redis 可以先同机自建
- 对象存储可以先暂缓，继续本地磁盘，等真实使用量上来再切换

### 2. 域名、HTTPS 和访问策略

需要人补充：

- 正式域名
- DNS 解析
- HTTPS 证书
- 是否仅内网/VPN 访问
- 是否开放公网
- 公司安全要求

对应需要修改：

- `PUBLIC_BASE_URL`
- `CORS_ALLOW_ORIGINS`
- Nginx `server_name`
- K8s Ingress `host`

### 3. 生产环境密钥

需要人补充：

- `SECRET_KEY`
- `SEED_ADMIN_PASSWORD`
- `DATABASE_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- Dify Workflow API key
- S3/OSS/COS 密钥，如启用对象存储

注意：不要把真实密钥提交到 GitHub。

### 4. Dify 配置

需要人补充：

- `DIFY_BASE_URL`
- `DIFY_REVIEW_WORKFLOW_API_KEY`
- `DIFY_RANKING_REASON_WORKFLOW_API_KEY`
- `DIFY_USER`

还需要确认：

- 服务器能访问 Dify
- Dify workflow 的输入输出字段仍与当前代码兼容
- dry-run 和正式运行在生产环境表现一致

### 5. GitHub 提交与发布节奏

当前大量改动还在本地工作区，尚未 commit/push。

需要人决定：

- 是否现在提交到 `main`
- 是否先开分支
- commit message
- 是否立即推送 GitHub
- 是否打一个第一版生产化 tag

建议：

```bash
git checkout -b production-baseline
git add .
git commit -m "Add production deployment baseline"
git push origin production-baseline
```

然后通过 PR 合并到 `main`。

### 6. 生产数据库迁移策略

需要人补充：

- 第一次上线是否空库
- 是否需要迁移当前 SQLite 历史数据
- 是否保留历史运行记录
- 是否需要导入已有用户

如果是空库，执行：

```bash
cd review_platform/server
alembic upgrade head
```

如果要迁移 SQLite 历史数据，需要单独写数据迁移脚本。

### 7. 对象存储选择

需要人决定：

- 暂时继续本地磁盘
- 使用云对象存储
- 使用自建 MinIO

如果切对象存储，需要补充：

```bash
ARTIFACT_STORAGE_BACKEND=s3
S3_BUCKET_NAME=...
S3_REGION_NAME=...
S3_ENDPOINT_URL=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

### 8. K8s 前置条件

如果要上 K8s，需要人补充：

- 镜像仓库地址
- API 镜像构建和推送
- Web 镜像构建和推送
- Secret 管理方式
- Ingress Controller
- StorageClass
- 是否支持 ReadWriteMany
- 日志采集
- 监控告警

如果没有这些基础设施，不建议第一版直接上 K8s。

### 9. 业务验收数据

需要人准备：

- 一份真实但可用于测试的源数据 Excel
- 覆盖全球业务突破奖
- 覆盖 AI价值领航奖
- 覆盖企业经营乘长奖
- 覆盖复宏汉霖和复星健康优先级规则
- 明确预期排序结果

这些数据用于上线前最后验收。

## 当前建议的下一步

建议按这个顺序继续：

1. 先用当前本地版本，以 `admin / admin123` 登录，人工试用新增页面。
2. 用一份真实 Excel 跑 dry-run，确认上传校验没有误伤真实文件。
3. 确认运行记录归档、删除、成员管理是否符合非技术用户习惯。
4. 决定是否 commit/push 当前改动。
5. 准备云服务器和域名。
6. 用 systemd + Nginx 方式先部署第一版。
7. 再接 PostgreSQL。
8. 再接 Redis/Celery。
9. 使用量起来后再切对象存储。
10. 等团队需要弹性扩容时再上 K8s。

## 本地试用入口

前端：

```text
http://127.0.0.1:5173/
```

后端健康检查：

```text
http://127.0.0.1:8000/api/health
```

默认账号：

```text
admin / admin123
```

## 验证命令

后端：

```bash
cd review_platform/server
python -m compileall app alembic
```

前端：

```bash
cd review_platform/frontend
npm run build
```

本地启动：

```bash
cd review_platform/server
python run_server.py
```

```bash
cd review_platform/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
