# 团队业务智能体平台第一版技术路线

> 目标读者：Codex（直接照此创建目录、写代码、迁移评优流程、做前端、实现 SSE、本地与服务器部署）。
> 生成依据：需求包 `给Claude的团队业务智能体平台技术路线需求包.md` + 实读 `review_batch.py`(2015 行)、`award_config.json`。
> 总原则：**评优业务逻辑不重写，只包装抽象**。平台是外壳，`review_batch.py` 是被包装的第一条业务线引擎。
>
> **决策摘要（已锁定，2026-06-19，Codex 必读）**：本文件为单一权威交付件，可独立实施，无需其他文档。
> 已锁定 5 项：① 阶段 0 先做固定优先级业务修复（与平台改造解耦）；② 数据库本地 SQLite / 服务器 PostgreSQL（正式路径 PG）；③ SSE 用 **DB 轮询**（非内存总线、非 Redis）；④ viewer **保守只读**（不可创建 run、不可下载任何产物）；⑤ QA 失败 = run `succeeded` + `qa_passed=false`（非系统失败）。
> 八项工程约束：优先级开关走函数参数、禁止运行时改 global；`ReviewBatchConfig` dataclass 放全部常量之后；EventBus 退化为“持久化器”（写表+jsonl，无内存队列）；取消为协作式、不打断在途 Dify 请求（加 `cancelling` 过渡态）；权限最小化（创建/下载/详情 ≥reviewer）；模型 SQLite/PG 可移植。

---

## 0. 代码现状核对（实读 review_batch.py 后的更正，Codex 必读）

需求包的描述与真实代码有几处不一致，按真实代码为准：

| 项 | 需求包说法 | 真实代码 | 处理 |
|---|---|---|---|
| **固定优先级是否生效** | §6 称“只保留代码内置固定优先级”，是硬要求 | `review_batch.py:40` `ENABLE_LEADERSHIP_PRIORITY = False`，且 `load_leadership_priorities()`(668-678) 在 False 时直接 `return []`，**固定优先级当前完全不触发** | ✅ **已定**：作为独立**阶段 0** 业务修复——`review_batch.py:40` 翻 `True`，`load_leadership_priorities(paths, enabled=None)` 加参数，平台经 `config.enable_leadership_priority` 显式传入，**禁止运行时改 global**（见 §7、阶段 0）。这是 §23“固定优先级命中逻辑不丢”的前提 |
| 固定优先级别名 | §6 只列了 `HLX11项目组→HLX11 产品组` | 代码(45-81)还额外内置：`全球产品开发部←HLX10项目组`、`税务团队←财务部`、`全球创新中心←HAI Club` | 全部**原样保留**，别名以代码为准，不要删 |
| 输出文件名 | §11/§20 列 `review_results.xlsx` 等 | 真实带时间戳：`review_results_{stamp}.xlsx`、`internal_review_pack_{stamp}.jsonl`、`qa_report_{stamp}.json`、`待补充清单_{stamp}.xlsx`，外加一份原始 `review_results_{stamp}.jsonl`(逐行 Dify 原始响应) | 平台按真实名落盘，artifact 表记录真实路径 |
| Dify Key | §21 列两个 Key | 真实用两个：`DIFY_REVIEW_WORKFLOW_API_KEY`(评审)、`DIFY_RANKING_REASON_WORKFLOW_API_KEY`(排名理由)，同一 `DIFY_BASE_URL`，用户标识 `DIFY_USER` | 两个 Key 都由服务器环境注入，绝不下发前端 |
| QA 失败行为 | — | `main()` 末尾 QA 不过会 `raise SystemExit`(2010) | 迁移后 `run_review_batch` **不再 sys.exit**，改为返回 `qa_passed=False`；CLI 的 `main()` 自己判定后再 SystemExit |

`review_batch.py` 真实主流程(`main()` 1866-2010)：解析参数 → 载入 env → `read_excel_records` → award_filter/limit 过滤 → `load_award_config` → `load_leadership_priorities` → **逐行循环**(build_workflow_inputs → call_dify_workflow → parse → build_result_row → calculate_score → match/apply_leadership_priority，边写 raw jsonl) → `rank_candidates` → `generate_ranking_reasons` → 组装 result_rows → `write_results_xlsx` → `write_internal_pack` → `write_completion_xlsx` → `run_quality_checks` → `write_quality_report` → 打印 → QA 不过则退出。

---

## 1. 产品目标与边界

### 1.1 目标
团队业务流程智能体平台第一版。把“重复、复杂、需材料处理、规则判断、智能体辅助、人工复核、结果产出”的业务流程，封装成**可运行、可追踪、可复核、可扩展**的业务线。第一版只上线**评优业务线**，但平台外壳必须按“可接入第 2、第 3 条线”来设计。

### 1.2 第一版必须做到（来自 §8）
1. 可部署到服务器，团队用浏览器访问。
2. 网页创建评优任务，上传/选择 Excel，选奖项筛选，选 full / dry-run / award_filter，可设 limit、timeout。
3. 后台执行**现有评优逻辑**，前端实时看进度与事件。
4. 完成后看结果表、QA 结论、候选人审查依据，下载 4 类产物。
5. 每次运行独立 `run_id`，参数/事件/产物全可追溯。
6. 架构允许未来接入新业务线。

### 1.3 第一版边界
- **做**：单平台外壳 + 评优 1 条线；FastAPI 后端 + React 前端；SSE 事件；SQLite(可切 PostgreSQL)；本地磁盘 artifacts；线程池后台执行；基础登录 + 三级角色(viewer/reviewer/admin)；Docker Compose 部署；HTTPS/内网。
- **不做（留接口/字段，不实现）**：LangGraph/deepagents、复杂 MCP、复杂 RBAC、SSO、对象存储、K8s、多实例高可用、多租户。
- **不碰**：`review_batch.py` 的评分算法、排序逻辑、固定优先级、QA 规则、Excel 模板写法——只做“提取函数 + 加事件回调 + 加结果对象 + 由 runner 调用”。

---

## 2. 总体架构

```
浏览器 (React 工作台)
  │  HTTP + SSE
  ▼
FastAPI (app.main)  ── 静态文件(前端 build) ──┐
  │ REST: business-lines / runs / artifacts / candidates / auth
  │ SSE: /api/runs/{id}/events/stream
  ▼
平台层 platform/
  RunManager ──(ThreadPoolExecutor)── 后台 Worker 线程
  EventBus  ──(per-run queue + 持久化 run_events + events.jsonl)
  ArtifactStore / Storage(本地磁盘)
  BusinessLineRegistry
  │
  ▼
业务线层 lines/award_review/
  AwardReviewLine(manifest/validate) → AwardReviewRunner.run(ctx)
  adapter.py  ──import──▶  review_batch.run_review_batch(config, event_sink, should_cancel)
  │
  ▼
智能体运行层
  Dify Workflow(评审 / 排名理由)  +  本地评分排序/优先级/Excel 导出/QA
  │
  ▼
SQLite(app.db) + data/runs/<run_id>/(input, outputs, events.jsonl, run_config.json, run_summary.json)
```

对应 §10.2 的命名映射：AgentFactory→`BusinessLineRegistry`；BaseGraphAgent→`AwardReviewRunner`；TaskManager→`RunManager`；Presenter→`EventSink`/`EventBus`；EventProcessor→前端 `runEventReducer`；Session/Run→`run_id`/`line_id`/`artifact_id`。

---

## 3. 第一版功能清单

后端：业务线列表/详情；创建 run(multipart 上传)；run 列表/详情/取消；SSE 事件流(支持断线重连/刷新重放)；产物列表/下载(经后端鉴权)；候选人结果表/详情；QA 报告；登录/当前用户/(admin)建号。
评优线：full / dry-run / award_filter / limit / timeout；固定优先级生效且只做槽内重排；4 类产物 + 原始 jsonl；QA 通过/失败明细。
前端：工作台、业务线、评优新建任务表单、历史任务、任务详情(状态/进度/事件日志/当前候选人/QA/下载卡/候选人表)、候选人详情弹窗、登录页。
部署：本地开发、内网/云服务器、Docker Compose、Nginx+HTTPS、.env 注入密钥。

---

## 4. 目录结构

`review_batch.py` **原地不动**，仍在 `E:\工作文件夹\TMOD\6月评优\testing\`（部署后为 `PROJECT_ROOT`）。平台新建在其下 `review_platform/`：

```
PROJECT_ROOT/                         # 现状目录，evev_batch.py 等都在这
├─ review_batch.py                    # 仅 §7 的“提取函数”改造，不搬家
├─ apply_manual_rank_patch.py         # 保留
├─ award_config.json                  # 保留
├─ 评选结果输出格式.xlsx                # 模板，保留
└─ review_platform/                   # ★ 新建：平台
   ├─ server/
   │  ├─ app/
   │  │  ├─ main.py                   # FastAPI 入口 + 静态托管 + 启动注册业务线
   │  │  ├─ core/
   │  │  │  ├─ config.py              # pydantic-settings 读 .env
   │  │  │  ├─ paths.py               # PROJECT_ROOT / DATA_DIR / run 目录推导
   │  │  │  ├─ logging.py             # 统一日志
   │  │  │  └─ security.py            # 密码哈希 / token / 角色依赖
   │  │  ├─ api/
   │  │  │  ├─ deps.py                # get_db / get_current_user / require_role
   │  │  │  ├─ schemas.py             # Pydantic 请求/响应模型
   │  │  │  └─ routes/
   │  │  │     ├─ health.py
   │  │  │     ├─ auth.py
   │  │  │     ├─ business_lines.py
   │  │  │     ├─ runs.py             # 创建/列表/详情/取消/事件/SSE
   │  │  │     ├─ artifacts.py        # 列表/下载
   │  │  │     └─ candidates.py       # 候选人表/详情/qa-report
   │  │  ├─ platform/
   │  │  │  ├─ business_line.py       # Protocol + dataclass(manifest/context/artifact/event)
   │  │  │  ├─ registry.py            # BusinessLineRegistry
   │  │  │  ├─ run_manager.py         # RunManager + ThreadPoolExecutor
   │  │  │  ├─ events.py              # EventBus + EventSink 实现
   │  │  │  ├─ artifacts.py           # ArtifactStore：登记/定位/读出
   │  │  │  └─ storage.py             # 本地磁盘路径与读写
   │  │  ├─ lines/
   │  │  │  └─ award_review/
   │  │  │     ├─ line.py             # AwardReviewLine：manifest + validate_config
   │  │  │     ├─ runner.py           # AwardReviewRunner.run(ctx)
   │  │  │     ├─ adapter.py          # import review_batch，构 config/EventSink，落 artifact
   │  │  │     ├─ ingest.py           # internal_pack.jsonl → candidate_results
   │  │  │     ├─ schemas.py          # 评优表单/配置模型
   │  │  │     └─ README.md
   │  │  └─ db/
   │  │     ├─ base.py                # Declarative Base / engine / SessionLocal
   │  │     ├─ models.py              # 全部 ORM 表
   │  │     └─ init_db.py             # 建表 + seed business_lines + seed admin
   │  ├─ tests/                       # pytest
   │  ├─ requirements.txt
   │  ├─ run_server.py                # uvicorn 启动器
   │  └─ .env.example
   ├─ frontend/
   │  ├─ index.html
   │  ├─ package.json / vite.config.ts / tsconfig.json / tailwind.config.js
   │  └─ src/
   │     ├─ main.tsx / App.tsx / router.tsx
   │     ├─ api/client.ts             # fetch 封装 + 鉴权头
   │     ├─ api/types.ts              # 与后端 schema 对齐的 TS 类型
   │     ├─ hooks/useRunEvents.ts     # SSE 订阅 + reducer
   │     ├─ hooks/runEventReducer.ts  # 事件→进度/日志/候选表
   │     ├─ pages/{Dashboard,Lines,AwardReviewHome,Runs,RunDetail,RunCandidates,RunArtifacts,Login}.tsx
   │     └─ components/{NewRunForm,EventLog,ProgressBar,QaPanel,ArtifactCard,CandidateTable,CandidateDetailDrawer}.tsx
   ├─ data/                           # 运行时生成(git 忽略)
   │  ├─ app.db
   │  ├─ uploads/<run_id>/source.xlsx
   │  └─ runs/<run_id>/{input,outputs,events.jsonl,run_config.json,run_summary.json}
   ├─ docker-compose.yml
   ├─ Dockerfile.server
   └─ nginx.conf
```

**为什么不搬 review_batch.py**：脚本含大量业务细节，搬家=高风险且无收益。`adapter.py` 通过 `sys.path` 注入 `PROJECT_ROOT` 后 `import review_batch`（路径由 `settings.review_batch_dir` 提供，默认 `PROJECT_ROOT`）。

---

## 5. 后端设计

### 5.1 配置 `core/config.py`（pydantic-settings）
读取 §21 的 `.env`：
```python
class Settings(BaseSettings):
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_data_dir: Path = Path("./data")
    database_url: str = ""               # 空→sqlite:///{data}/app.db
    redis_url: str = ""                  # 第一版可空
    secret_key: str = "change-me"
    public_base_url: str = ""
    project_root: Path = Path(__file__).resolve().parents[5]   # 指到 testing/
    review_batch_dir: Path | None = None # 默认=project_root
    dify_base_url: str = ""
    dify_review_workflow_api_key: str = ""
    dify_ranking_reason_workflow_api_key: str = ""
    dify_user: str = "review-platform"
    run_max_workers: int = 2
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
```

### 5.2 后台执行模型（回答 §24-Q4）
- `review_batch` 是**同步阻塞**(requests + openpyxl + CPU)，asyncio task 无益。**用 `concurrent.futures.ThreadPoolExecutor(max_workers=settings.run_max_workers)`**，每个 run 跑在 worker 线程。
- `RunManager.submit(run_id)` → `executor.submit(self._execute, run_id)`，立即返回 `run_id`（创建即 `created→queued`）。
- 第一版即“单/少 Worker”形态；`should_cancel()` **读数据库 `runs.cancel_requested`**（非内存 Event），故取消请求落到哪个进程都生效。§8 表“可替换为 Redis/Worker”——`RunManager` 接口预留 `submit/cancel`，未来换 RQ/Arq 只替换实现，不动路由与业务线。

### 5.3 事件总线 `platform/events.py`（**DB 轮询**，回答 §24-Q5/Q6）
- 第一版 `EventBus` **退化为持久化器**，不维护任何内存订阅队列：
  - `publish(event)`：① 写 `run_events` 表（自增 `id` 即 SSE 的 `event_id`）；② 追加 `data/runs/<run_id>/events.jsonl`。worker 线程用自己的 DB Session，每条事件一个短事务——**不需要 `run_coroutine_threadsafe`、不需要跨线程桥接**。
  - `get_events(run_id, after_id=0)`：`SELECT * FROM run_events WHERE run_id=? AND id>after_id ORDER BY id`。SSE 与“历史重放”是同一条查询。
- **为什么不用内存队列**：内存总线只在单进程有效，与 uvicorn 多 worker 冲突（worker A 跑任务、SSE 落到 worker B 收不到实时事件）。DB 轮询多 worker / 重启都安全，且 worker 本就把事件落库，轮询近零成本。
- **刷新/重连**：SSE 连接读 `Last-Event-ID`/`after_id` 起轮询即可；页面刷新另调 `GET /runs/{id}` 取当前状态。事件持久化是“刷新后还能看到完整过程”的根本保证。

### 5.4 `EventSink`（给业务线/review_batch 用的极简发射器）
```python
class EventSink(Protocol):
    def emit(self, event_type: str, *, message: str = "", level: str = "info",
             progress: tuple[int, int] | None = None, payload: dict | None = None) -> None: ...
class NullEventSink:  # review_batch 单测/CLI 用，全程 no-op
    def emit(self, *a, **k): ...
class BusEventSink:    # 平台实现，转 EventBus.publish
    def __init__(self, run_id, line_id, bus): ...
```

---

## 6. 业务线抽象设计（回答 §13、§24-Q14）

`platform/business_line.py`：
```python
@dataclass
class BusinessLineManifest:
    line_id: str; name: str; description: str
    input_types: list[str]            # ["xlsx"]
    run_modes: list[str]              # ["full","dry_run","award_filter"]
    artifacts: list[str]              # 产物逻辑名
    config_schema: dict               # 驱动前端表单的字段定义
    supports_events: bool = True
    supports_result_query: bool = True
    supports_export: bool = True

@dataclass
class Artifact:
    artifact_type: str; name: str; file_path: Path
    content_type: str; size_bytes: int; metadata: dict

@dataclass
class RunContext:
    run_id: str; line_id: str
    config: dict                      # validate_config 后的规范化配置
    input_dir: Path; output_dir: Path
    emit: Callable[..., None]         # = EventSink.emit
    add_artifact: Callable[[Artifact], None]
    should_cancel: Callable[[], bool]
    settings: "Settings"

class BusinessLine(Protocol):
    manifest: BusinessLineManifest
    def get_manifest(self) -> BusinessLineManifest: ...
    def validate_config(self, raw: dict, files: dict[str, Path]) -> dict: ...
    def create_runner(self) -> "BusinessLineRunner": ...

class BusinessLineRunner(Protocol):
    def run(self, ctx: RunContext) -> None: ...   # 产事件、写 output_dir、调 ctx.add_artifact
```
平台只懂“某线能 create run → 出事件 → 出 artifacts”，**不懂评优怎么评分**。`registry.py` 在 `main.py` 启动时 `register(AwardReviewLine())`，并 upsert 到 `business_lines` 表。新线只需新增 `lines/<x>/` 并注册，路由零改动——这就是“线→面”的扩展点。

---

## 7. 评优业务线迁移设计（review_batch.py 改造，§7/§19/§24-Q2/Q9）

迁移分两动作，**都在 review_batch.py 内、纯增量**：先抽函数，再加回调。需求包的“先提取可复用函数→加事件回调→加结果对象→由 runner 调用→最后再模块化”路线**合理，采纳**。

### 7.1 新增 dataclass（放在**全部模块常量之后**——否则 `DEFAULT_TEMPLATE` 等尚未定义会 NameError）
```python
from dataclasses import dataclass, field
from typing import Protocol, Callable

@dataclass
class ReviewBatchConfig:
    input_path: Path
    output_dir: Path
    template_path: Path | None = None            # __post_init__ 兜底为 DEFAULT_TEMPLATE
    award_config_path: Path | None = None        # __post_init__ 兜底为 DEFAULT_AWARD_CONFIG
    leadership_priority_paths: list[Path] = field(default_factory=list)
    enable_leadership_priority: bool = True       # 业务修复在阶段0；此处仅作平台默认
    top_n: int = 2
    award_filters: list[str] = field(default_factory=list)
    limit: int = 0
    sleep: float = 0.2
    timeout: int = 120
    dry_run: bool = False
    dify_base_url: str = ""
    dify_review_api_key: str = ""
    dify_ranking_reason_api_key: str = ""
    dify_user: str = "review-batch"

    def __post_init__(self):
        if self.template_path is None: self.template_path = DEFAULT_TEMPLATE
        if self.award_config_path is None: self.award_config_path = DEFAULT_AWARD_CONFIG

@dataclass
class ReviewBatchResult:
    output_dir: Path
    xlsx_path: Path
    raw_jsonl_path: Path
    internal_pack_path: Path
    completion_path: Path
    qa_report_path: Path
    qa_passed: bool
    expected_rows: int
    processed_rows: int
    award_counts: dict
    qa_report: dict

class EventSink(Protocol):
    def emit(self, event_type: str, *, message: str = "", level: str = "info",
             progress=None, payload: dict | None = None) -> None: ...
class NullEventSink:
    def emit(self, *a, **k): ...

class RunCancelled(Exception): ...
```

### 7.2 新增 `run_review_batch`（把 main() 解析参数之后的全部逻辑搬进来，参数化）
```python
def run_review_batch(config: ReviewBatchConfig,
                     event_sink: EventSink | None = None,
                     should_cancel: Callable[[], bool] | None = None) -> ReviewBatchResult:
    sink = event_sink or NullEventSink()
    cancelled = should_cancel or (lambda: False)

    # ★ 固定优先级开关只走参数，禁止运行时改全局(多线程竞态)。
    #   阶段0 已给 load_leadership_priorities 加 enabled 参数；下方调用处显式传入。

    # —— 取代 main() 中环境变量读取：直接用 config 里的 Dify 凭据(由服务器注入) ——
    base_url = config.dify_base_url
    api_key = config.dify_review_api_key
    ranking_reason_api_key = config.dify_ranking_reason_api_key
    user = config.dify_user or "review-batch"
    if not base_url: raise ValueError("缺少 DIFY_BASE_URL")
    if not config.dry_run and not api_key: raise ValueError("缺少 DIFY_REVIEW_WORKFLOW_API_KEY")

    records = read_excel_records(config.input_path)
    if config.award_filters:
        filters = [t.strip() for t in config.award_filters if t and t.strip()]
        records = [r for r in records if any(k in str(r["values"].get("申报项目","")) for k in filters)]
    if config.limit: records = records[:config.limit]
    sink.emit("excel:loaded", message=f"载入 {len(records)} 个候选", progress=(0, len(records)),
              payload={"total": len(records)})

    award_config = load_award_config(config.award_config_path, config.top_n)
    leadership_priorities = load_leadership_priorities(
        config.leadership_priority_paths or DEFAULT_LEADERSHIP_PRIORITIES,
        enabled=config.enable_leadership_priority)   # ★ 显式传参，不改 global

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = config.output_dir; output_dir.mkdir(parents=True, exist_ok=True)
    jsonl_path = output_dir / f"review_results_{stamp}.jsonl"
    xlsx_path = output_dir / f"review_results_{stamp}.xlsx"
    internal_pack_path = output_dir / f"internal_review_pack_{stamp}.jsonl"
    completion_path = output_dir / f"待补充清单_{stamp}.xlsx"
    qa_report_path = output_dir / f"qa_report_{stamp}.json"

    candidate_entries = []
    with jsonl_path.open("w", encoding="utf-8") as jsonl:
        for idx, record in enumerate(records, start=1):
            if cancelled(): raise RunCancelled()
            inputs = build_workflow_inputs(record)
            sink.emit("candidate:started", message=f"第 {idx}/{len(records)} 行开始",
                      progress=(idx-1, len(records)),
                      payload={"candidate_id": inputs["candidate_id"], "award_name": inputs["award_name"]})
            # …… 完全保留原 1921-1972 的本行处理逻辑(调用 Dify、打分、优先级、组 entry、写 raw jsonl) ……
            # 成功分支末尾：
            sink.emit("candidate:reviewed", message=f"第 {idx}/{len(records)} 行完成",
                      progress=(idx, len(records)),
                      payload={"candidate_id": inputs["candidate_id"], "workflow_status": workflow_status})
            # 异常分支(workflow_status=='failed')改 emit("candidate:failed", level="warn", payload={"error": error})
    sink.emit("ranking:started")
    rank_candidates(candidate_entries, award_config, dry_run=config.dry_run)
    sink.emit("ranking:done")
    sink.emit("reason:started")
    generate_ranking_reasons(candidate_entries, base_url, ranking_reason_api_key, user, config.timeout, dry_run=config.dry_run)
    sink.emit("reason:done")
    # …… 保留原 result_rows 组装(1986-1991) ……
    sink.emit("export:started")
    write_results_xlsx(config.template_path, xlsx_path, result_rows, detail_rows)
    sink.emit("artifact:created", payload={"artifact_type":"review_results_xlsx","name":xlsx_path.name,"path":str(xlsx_path)})
    write_internal_pack(internal_pack_path, candidate_entries)
    sink.emit("artifact:created", payload={"artifact_type":"internal_review_pack","name":internal_pack_path.name,"path":str(internal_pack_path)})
    write_completion_xlsx(completion_path, candidate_entries)
    sink.emit("artifact:created", payload={"artifact_type":"completion_xlsx","name":completion_path.name,"path":str(completion_path)})
    sink.emit("qa:started")
    qa_report = run_quality_checks(xlsx_path, internal_pack_path, expected_rows=len(records),
                                   require_dify_reasons=not config.dry_run)
    write_quality_report(qa_report_path, qa_report)
    sink.emit("artifact:created", payload={"artifact_type":"qa_report","name":qa_report_path.name,"path":str(qa_report_path)})
    sink.emit("qa:done", level=("info" if qa_report["passed"] else "warn"),
              payload={"passed": qa_report["passed"],
                       "failed_checks":[c["id"] for c in qa_report["checks"] if not c["passed"]]})

    award_counts = {}
    for e in candidate_entries: award_counts[e["award_name"]] = award_counts.get(e["award_name"],0)+1
    return ReviewBatchResult(output_dir, xlsx_path, jsonl_path, internal_pack_path,
                             completion_path, qa_report_path, qa_report["passed"],
                             len(records), len(candidate_entries), award_counts, qa_report)
```

### 7.3 `main()` 收敛为薄壳（保留 CLI 行为，§23 验收“原命令行仍可用”）
```python
def main():
    parser = argparse.ArgumentParser(...)   # 全部参数原样保留
    args = parser.parse_args()
    load_env_files([Path(p) for p in args.env_file] + DEFAULT_ENV_FILES)
    config = ReviewBatchConfig(
        input_path=Path(args.input), output_dir=Path(args.output_dir),
        template_path=Path(args.template), award_config_path=Path(args.award_config),
        leadership_priority_paths=[Path(p) for p in args.leadership_priority],
        top_n=args.top_n, award_filters=args.award_filter, limit=args.limit,
        sleep=args.sleep, timeout=args.timeout, dry_run=args.dry_run,
        dify_base_url=os.environ.get("DIFY_BASE_URL","").strip(),
        dify_review_api_key=os.environ.get("DIFY_REVIEW_WORKFLOW_API_KEY","").strip(),
        dify_ranking_reason_api_key=os.environ.get("DIFY_RANKING_REASON_WORKFLOW_API_KEY","").strip(),
        dify_user=os.environ.get("DIFY_USER","review-batch").strip() or "review-batch",
    )
    result = run_review_batch(config)
    print(f"Excel: {result.xlsx_path}"); print(f"QA Passed: {result.qa_passed}")
    if not result.qa_passed:
        failed = [c["id"] for c in result.qa_report["checks"] if not c["passed"]]
        raise SystemExit(f"QA failed: {', '.join(failed)}")
```
**风险控制**：循环体内逐行处理代码**逐字复制**自原 1921-1972，只在头尾插 `sink.emit` 与 `if cancelled()`。不动 `calculate_score / rank_candidates / generate_ranking_reasons / write_* / run_quality_checks / 固定优先级`。验证：`python -m py_compile review_batch.py` + 跑一次 dry-run 全量对比产物与改造前一致。

### 7.4 业务线侧 `adapter.py`
```python
def run_award_review(ctx: RunContext) -> None:
    import sys; sys.path.insert(0, str(ctx.settings.review_batch_dir or ctx.settings.project_root))
    import review_batch as rb
    cfg = rb.ReviewBatchConfig(
        input_path=ctx.input_dir / "source.xlsx",
        output_dir=ctx.output_dir,
        template_path=ctx.settings.project_root / "评选结果输出格式.xlsx",
        award_config_path=ctx.settings.project_root / "award_config.json",
        enable_leadership_priority=True,
        award_filters=ctx.config.get("award_filters", []),
        limit=ctx.config.get("limit", 0),
        timeout=ctx.config.get("timeout", 120),
        dry_run=ctx.config.get("dry_run", False),
        dify_base_url=ctx.settings.dify_base_url,
        dify_review_api_key=ctx.settings.dify_review_workflow_api_key,
        dify_ranking_reason_api_key=ctx.settings.dify_ranking_reason_workflow_api_key,
        dify_user=ctx.settings.dify_user,
    )
    sink = _CtxSink(ctx)                     # 把 emit 透传到 ctx.emit
    result = rb.run_review_batch(cfg, event_sink=sink, should_cancel=ctx.should_cancel)
    for art in _result_to_artifacts(result):  # 4 产物 + 原始 jsonl 登记
        ctx.add_artifact(art)
    ingest_candidate_results(ctx.run_id, result.internal_pack_path)   # §7.5
    ctx.emit("run:succeeded" if result.qa_passed else "run:succeeded",
             payload={"qa_passed": result.qa_passed, "award_counts": result.award_counts})
```

### 7.5 internal_pack → candidate_results（回答 §24-Q8）`ingest.py`
逐行读 `internal_review_pack_*.jsonl`（`read_internal_pack` 已有），映射入库：
```python
# 每行 payload(write_internal_pack 1582-1620 的结构) → candidate_results 行
candidate_id          = item["candidate_id"]
excel_row             = item["excel_row"]
award_name            = item["award_name"]
subject               = item["final_result_fields"].get("主体","")
rank                  = item["recommendation"]["rank"]
recommendation_status = item["recommendation"]["status"]
workflow_status       = item["workflow_status"]
normal_review_score   = item["scoring"]["normal_review_score"]
internal_score        = item["scoring"]["internal_score"]
manual_review_required= item["recommendation"]["manual_review_required"]
ranking_reason        = item["recommendation"]["ranking_reason"]
raw_json              = json.dumps(item, ensure_ascii=False)   # 整行存档，供详情弹窗展开证据/优先级
```
候选人详情(§18)所需的证据等级/命中规则/缺失证据/风险/优先级命中，全在 `raw_json` 的 `evidence` 与 `scoring.leadership_priority` 中，前端从 `GET candidates/{id}` 返回的 `raw_json` 解析即可，**第一版不必为每个证据维度单独建列**(符合 §16 末“可先不全展开入库”)。

---

## 8. 数据库设计（本地 SQLite / 服务器 PostgreSQL，SQLAlchemy 2.0，模型可移植）

口径：本地开发/测试用 SQLite（零依赖）；服务器/团队第一版用 **PostgreSQL**（正式路径）。SQLAlchemy 模型必须同时兼容两者；SQLite 专属 `PRAGMA journal_mode=WAL`（允许 SSE 读与 worker 写并发）**只在 dialect 为 sqlite 时**经 `event.listens_for(engine,"connect")` 设置，PG 不执行。表（在 §16 基础上加 `users`）：

```python
# db/models.py（要点字段，类型 SQLite/PG 通用）
class User(Base):           # 鉴权
    id, username(unique), password_hash, role(viewer|reviewer|admin), enabled, created_at
class BusinessLine(Base):
    id, line_id(unique), name, description, enabled, created_at, updated_at
class Run(Base):
    id, run_id(unique idx), line_id, status, title,
    config_json, input_files_json, output_dir,
    cancel_requested(bool, default False),     # 取消信号；worker 边界读，跨进程安全
    created_by, created_at, started_at, finished_at, error_message, summary_json
    # summary_json 含 {"execution_completed":bool,"qa_passed":bool|null,"failed_checks":[...]}
class RunEvent(Base):       # id 自增 = SSE event_id
    id(pk), run_id(idx), event_type, level, message,
    progress_current, progress_total, payload_json, created_at
class Artifact(Base):
    id, artifact_id(unique), run_id(idx), artifact_type, name,
    file_path, content_type, size_bytes, created_at, metadata_json
class CandidateResult(Base):
    id, run_id(idx), candidate_id, excel_row, award_name, subject, rank,
    recommendation_status, workflow_status, normal_review_score, internal_score,
    manual_review_required, ranking_reason, raw_json, created_at
class ManualAction(Base):   # 第一版建表占位，UI 暂不写入
    id, run_id, candidate_id, action_type, before_json, after_json, reason, operator, created_at
```
状态机主状态(存 `Run.status`)：`created → queued → running → succeeded | failed | cancelled`，外加过渡态 `cancelling`（已请求取消、worker 未到边界）。**QA 是否通过不进主状态**——跑完即 `succeeded`，QA 结果走 `summary_json.qa_passed`（见 §15）。细粒度阶段（reading_excel/reviewing_candidates/…）只走事件流，前端据事件展示阶段标签。

---

## 9. API 设计（回答 §17：上传方式）

**上传方式推荐：`POST /api/runs` 用 `multipart/form-data` 一次性带文件创建 run**。理由：原子（文件与 run 绑定，无孤儿上传）、少一次往返、前端简单。另保留 `POST /api/files/upload` 供“复用/大文件预上传”，返回 `upload_id`，创建时传 `source_upload_id` 二选一。

```
GET  /api/health                                  → {status:"ok", time}
POST /api/auth/login        {username,password}    → {access_token, role}
GET  /api/auth/me                                  → {username, role}
POST /api/auth/users  (admin)                      → 建号

GET  /api/business-lines                           → [manifest...]
GET  /api/business-lines/{line_id}                 → manifest(含 config_schema 驱动表单)

POST /api/runs   (multipart: file + fields)        → {run_id, status:"queued"}   # 见下
GET  /api/runs?line_id=&status=&page=              → [{run_id,status,title,line_id,created_at,summary}]
GET  /api/runs/{run_id}                            → run 详情(状态/进度摘要/QA/错误)
POST /api/runs/{run_id}/cancel                     → {run_id, status:"cancelling"}
GET  /api/runs/{run_id}/events?after_id=0          → [event...]            # 历史，刷新重放
GET  /api/runs/{run_id}/events/stream              → text/event-stream      # SSE，支持 Last-Event-ID

GET  /api/runs/{run_id}/artifacts                  → [{artifact_id,type,name,size,created_at}]
GET  /api/runs/{run_id}/artifacts/{artifact_id}/download  → 文件流(经鉴权)
GET  /api/runs/{run_id}/candidates                 → [候选行]
GET  /api/runs/{run_id}/candidates/{candidate_id}  → 单候选(含 raw_json)
GET  /api/runs/{run_id}/qa-report                  → qa_report.json 内容
```

`POST /api/runs` 请求(multipart 字段)：
```
file: <source.xlsx>
line_id: "award_review"
title: "2026 全量评优"
config: '{"dry_run":false,"award_filters":["全球业务突破奖"],"limit":0,"timeout":120}'
```
响应：`201 {"run_id":"run_20260619_101530_a1b2c3","status":"queued"}`

`GET /api/runs/{run_id}` 响应样例：
```json
{"run_id":"run_20260619_101530_a1b2c3","line_id":"award_review","status":"running",
 "title":"2026 全量评优","created_by":"mdy","created_at":"2026-06-19T10:15:30",
 "progress":{"current":12,"total":38,"percent":31.6,"phase":"reviewing_candidates"},
 "qa":{"passed":null},"error_message":null,
 "config":{"dry_run":false,"award_filters":["全球业务突破奖"]}}
```

---

## 10. SSE 事件设计（§15；回答 §24-Q5/Q6）

格式（与需求包一致，`id` 即 `run_events.id`）：
```
id: 1234
event: candidate:reviewed
data: {"run_id":"run_...","line_id":"award_review","type":"candidate:reviewed",
       "level":"info","message":"第 12 / 38 行评审完成",
       "progress":{"current":12,"total":38,"percent":31.58},
       "payload":{"candidate_id":"row_00012","workflow_status":"succeeded"},
       "created_at":"2026-06-19T10:18:00"}
```
事件类型全集（按 §15）：`run:created / run:started / input:validated / excel:loaded / candidate:started / candidate:reviewed / candidate:failed / ranking:started / ranking:done / reason:started / reason:done / export:started / artifact:created / qa:started / qa:done / run:succeeded / run:failed / run:cancelled`。

SSE 端点逻辑（**DB 轮询**）：协程把 `Last-Event-ID`/`after_id` 设为 `last_id` → 循环 `SELECT * FROM run_events WHERE run_id=? AND id>last_id ORDER BY id`，逐条 `yield` 并推进 `last_id`；run 到终态且无新行则关闭，否则 `await asyncio.sleep(0.75)`。历史与实时同一条查询，天然支持刷新/重连，多 worker / 重启都安全。前端用 `@microsoft/fetch-event-source`（带鉴权头、自动重连、断点续传）。

**前端消费**（`runEventReducer`，§15 要求）：
| 事件 | UI 更新 |
|---|---|
| excel:loaded | 进度条 total，状态→“评审中” |
| candidate:started/reviewed/failed | 进度条 current/percent，当前候选人，事件日志追加 |
| ranking:* / reason:* / export:* | 阶段标签切换，日志追加 |
| artifact:created | 产物下载卡新增一张 |
| qa:done | QA 面板：通过(绿)/失败列 failed_checks(红) |
| run:succeeded/failed/cancelled | 终态徽标；succeeded 后拉 `GET candidates` 渲染结果表 |

---

## 11. 前端设计（§18）

路由：`/`(工作台) `/lines` `/lines/award-review` `/runs` `/runs/:runId` `/runs/:runId/candidates` `/runs/:runId/artifacts` `/login`。

- **评优新建任务表单 `NewRunForm`**：文件上传(或选服务器现有源)、任务标题、奖项筛选(可加多条 tag)、dry-run 开关、limit(可选)、timeout(可选)、创建按钮。字段由 `manifest.config_schema` 驱动。
- **任务详情 `RunDetail`**：状态徽标 + `ProgressBar` + 当前候选人 + `EventLog`(SSE) + `QaPanel` + `ArtifactCard`×N + `CandidateTable` + 错误区。
- **`CandidateTable` 列**(§18)：奖项 / 排名 / 主体 / 推荐状态 / workflow状态 / 正常评审分 / 内部排序分 / 是否人工复核 / 排名理由 / 查看详情。
- **`CandidateDetailDrawer`**：从 `raw_json` 展开——原始行、评分细节(score_detail.dimensions)、证据等级(evidence.grades)、命中规则(matched_rules)、缺失证据(missing_evidence)、风险(risk_flags)、优先级命中(scoring.leadership_priority)、排名理由。
- **权限联动**：内部排序分列、候选人详情、internal_pack 下载仅 reviewer/admin 可见(viewer 隐藏/灰)。

---

## 12. 文件与产物管理（§20；回答 §24-Q7）

目录(每 run 独立)：
```
data/uploads/<run_id>/source.xlsx                # 原始上传留存
data/runs/<run_id>/input/source.xlsx             # 运行输入(拷贝)
data/runs/<run_id>/outputs/review_results_<stamp>.xlsx
                          internal_review_pack_<stamp>.jsonl
                          qa_report_<stamp>.json
                          待补充清单_<stamp>.xlsx
                          review_results_<stamp>.jsonl   # 原始逐行响应
data/runs/<run_id>/events.jsonl / run_config.json / run_summary.json
```
1. **命名**：保留 review_batch 的 `<name>_<stamp>` 时间戳，`<run_id>` 目录隔离。2. **不覆盖**：`run_id` + stamp 双隔离，多 run 并行天然不撞(回应 §23“多个 run 不互相覆盖”)。3. **定位**：`Artifact.file_path` 绝对/相对(相对 `DATA_DIR`)路径入库，下载按 `artifact_id` 查表取路径。4. **下载**：仅经 `GET artifacts/{id}/download`，`FileResponse` + 鉴权 + 路径前缀校验(防穿越)，**前端不接触磁盘路径**。5. **清理**：保留期(如 90 天)定时任务删 `data/runs/<旧>`，先删盘再标 `artifacts` 失效。6. **迁 NAS/对象存储**：所有读写过 `platform/storage.py` 抽象(`save/open/url`)，第一版本地实现，未来换 MinIO/OSS 只改该层。

---

## 13. 权限与安全（§22；回答 §24-Q13）

三角色（§22）：`viewer 普通用户` / `reviewer 评审管理员` / `admin 系统管理员`。**viewer 保守只读**（评优数据含姓名/申报理由/评审分，最小权限）：
| 能力 | viewer | reviewer | admin |
|---|---:|---:|---:|
| 登录、看被授权 run 的状态/进度/QA结论 | ✓ | ✓ | ✓ |
| 看所有 run | ✗ | ✓ | ✓ |
| 创建 run | ✗ | ✓ | ✓ |
| 取消 run | ✗ | 本人/全部 | ✓ |
| 下载最终 Excel、待补充清单 | ✗ | ✓ | ✓ |
| 看候选人详情、下载 internal_pack / qa_report | ✗ | ✓ | ✓ |
| 建账号、改角色、清理产物 | ✗ | ✗ | ✓ |

viewer 第一版=只读旁观（仅状态，无任何下载）。“普通用户也能下载最终结果”留作后续可配置项。

实现：`security.py` 用 `passlib[bcrypt]` 存哈希；登录发 JWT(HS256，`SECRET_KEY`)；`require_role(min_role)` 依赖做接口级校验；artifact 下载按 `artifact_type` 判级（internal_pack/qa_report 需 reviewer+）。
**最小保护方案**(若暂不做完整登录)：单一共享口令 + 全站置于内网/VPN，但**数据库仍保留 user/role 字段**，便于平滑升级。
铁律(§22)：Dify Key 只在服务器 env，绝不进前端/响应；上传与产物只落服务器受控目录；前端下载必经后端。

---

## 14. 部署方案（§21；回答 §24-Q11/Q12）

`.env`（§21）：`APP_HOST/APP_PORT/APP_DATA_DIR/DATABASE_URL/REDIS_URL/SECRET_KEY/PUBLIC_BASE_URL/DIFY_BASE_URL/DIFY_REVIEW_WORKFLOW_API_KEY/DIFY_RANKING_REASON_WORKFLOW_API_KEY/DIFY_USER`。

**本地开发**：后端 `python review_platform/server/run_server.py`(uvicorn reload, :8000)；前端 `cd frontend && npm run dev`(Vite :5173，proxy /api→8000)。SQLite 自动建。
**内网/云服务器**：`npm run build` 出 `frontend/dist` → FastAPI `StaticFiles` 托管(或 Nginx)；HTTPS。SSE 用 DB 轮询、取消用 DB 标志，故 uvicorn worker 数非硬约束；第一版默认 1–2 个即可（每进程一个 ThreadPoolExecutor 跑后台 run）。
- Linux 优先(更顺)；Windows 服务器可行(用 NSSM/计划任务托管 uvicorn，路径用 `pathlib`，本方案已无硬编码 `E:\`，全部走 `settings.project_root`/`DATA_DIR`)。
- 配置：最低 2C4G+SSD；稳妥 4C8G。安全组只开 80/443(+管理用 22/3389 限源 IP)，**不对全网开 SSH/RDP**。建议 Docker Compose。
- 云上合规(§21)：先确认内部评优数据可否上云、地域/备案；Dify 须从该服务器可达(内网打通或白名单)；优先 VPN/白名单 + HTTPS。

**A. 快速上线**：单云服务器 = FastAPI + 前端静态 + PostgreSQL + 单 Worker + 本地磁盘 + Nginx/HTTPS + 基础登录。
**B. 稍正式**：Nginx + FastAPI(API) + 独立 Worker 服务 + PostgreSQL + Redis + 本地/NAS + HTTPS + 三级权限 + 定期备份。

提供两份 env：`.env.example.local`(SQLite) 与 `.env.example.server`(PostgreSQL)。`docker-compose.yml`(A 版骨架)：`server`(uvicorn) + `db`(postgres:16) + `nginx`(443→server，托管 dist)；volume 挂 `data/`；env_file `.env.example.server`。Windows 路径迁移：删除对 `E:\...` 的依赖，源数据改由网页上传或放 `DATA_DIR` 下；模板/award_config 随 `review_batch.py` 同目录由 `project_root` 定位。

---

## 15. 测试与验收（§23）

后端(pytest + httpx)：① 创建 run 返回 run_id；② 跑完 QA 通过→`succeeded`+qa_passed=true；跑完 QA 不过→**仍 `succeeded`**+qa_passed=false+failed_checks；异常(Key缺失/读文件失败/导出失败)→`failed` 记 error_message；③ SSE(DB 轮询)实时收到事件且刷新/重连可重放；④ 产物下载经鉴权(≥reviewer)；⑤ 取消：请求后→`cancelling`，到边界→`cancelled`（不承诺打断在途 Dify 请求）；⑥ 并行 2 run 输出互不覆盖(不同 run_id 目录)；⑦ dry-run 可跑；⑧ award_filter 可跑；⑨ qa_report 可解析展示。
评优线：① 全量跑完；② 仅全球业务突破奖；③ 仅 AI价值领航奖；④ **固定优先级命中(需 enable=True，见 §0)**；⑤ `复宏汉霖 HLX11项目组`↔`HLX11 产品组` 别名；⑥ 优先级只槽内重排(`apply_leadership_slot_adjustment` 行为不变，不全局置顶)；⑦ 结果 Excel 仍套用模板(表头=`TARGET_HEADERS`，A 列同奖项合并)；⑧ internal_pack 完整；⑨ QA 通过→前端绿；⑩ QA 失败→前端列 failed_checks。
前端：新建/看进度/看日志/看候选表/看详情/下载/看错误。
部署：他机可访问；前端能请求后端；下载不依赖本机路径；**浏览器代码中无 Dify Key**(构建产物 grep 校验)。

---

## 16. 分阶段代码落地计划（文件级，§25 要求的颗粒度）

**阶段 0 — 固定优先级业务修复与验证（独立提交，先于平台）**
- 修改：`review_batch.py`
- `review_batch.py:40` `ENABLE_LEADERSHIP_PRIORITY = True`（**业务修复点**）
- `load_leadership_priorities(paths, enabled=None)`：`if enabled is None: enabled = ENABLE_LEADERSHIP_PRIORITY`；`if not enabled: return []`（不再无条件 return）
- `main()` 加 `--disable-leadership-priority`，调用 `load_leadership_priorities(paths, enabled=not args.disable_leadership_priority)`；**不引入任何运行时 global 修改**
- 验证：跑“仅全球业务突破奖 + 仅 AI价值领航奖”，人工核对复宏汉霖/复星健康**槽位内重排** + `HLX11项目组`↔`HLX11 产品组`
- 验收：非命中奖项排序与修复前一致；命中奖项按本地固定规则在原槽位内重排

**阶段 1 — 提取 run_review_batch（结构改造 + 明确业务修复，不再叫“零行为变更”）**
- 修改：`review_batch.py`
- 新增 dataclass（放**全部常量之后**）：`ReviewBatchConfig`(template/award_config 用 `None`+`__post_init__`) / `ReviewBatchResult`；Protocol `EventSink` + `NullEventSink`；异常 `RunCancelled`
- 新增函数：`run_review_batch(config, event_sink=None, should_cancel=None) -> ReviewBatchResult`（搬入 main() 解析后全部逻辑 + 头尾插 emit/cancel；`load_leadership_priorities(..., enabled=config.enable_leadership_priority)`，**不写 global**）
- 调整：`main()` 组装 config 后调用 `run_review_batch`；`run_review_batch` 不 sys.exit，QA 不过由 `main()` 自己 SystemExit
- 验证：`python -m py_compile review_batch.py`
- 验收：CLI 三种命令仍可用；**非固定优先级命中奖项排序不变**；命中奖项槽内重排；HLX11 别名命中；QA 报告仍生成；结果 Excel 格式不变（**不再要求“全量 diff 为空”**——启用优先级本就会改命中奖项排序）

**阶段 2 — 后端骨架 + DB**
- 新建：`server/app/core/{config,paths,logging,security}.py`、`db/{base,models,init_db}.py`、`api/{deps,schemas}.py`、`api/routes/{health,auth}.py`、`main.py`、`run_server.py`、`requirements.txt`、`.env.example`
- 验证：`uvicorn` 起，`GET /api/health` 200；`init_db` 建表并 seed admin
- 验收：登录拿 token；建表完整

**阶段 3 — 平台层**
- 新建：`platform/{business_line,registry,run_manager,events,artifacts,storage}.py`
- 验证：单测 EventBus 持久化+重放、RunManager 线程提交/取消、Storage 路径隔离
- 验收：可创建一个“假业务线”跑通 created→running→succeeded 全事件链

**阶段 4 — 评优业务线接入**
- 新建：`lines/award_review/{line,runner,adapter,ingest,schemas}.py`、`README.md`
- 接线：`main.py` 启动注册 `AwardReviewLine`；`adapter` import `review_batch.run_review_batch`
- 验证：`POST /api/runs`(multipart, dry-run) → SSE 出全事件 → 产物落 `data/runs/<id>/outputs` → `candidate_results` 入库 → `GET candidates` 有数据
- 验收：§15 评优线 10 条全过(尤其 ④⑤⑥)

**阶段 5 — REST/SSE 路由补全**
- 新建：`api/routes/{business_lines,runs,artifacts,candidates}.py`
- 验证：§9 全端点 httpx 测试；SSE `Last-Event-ID` 重放
- 验收：§15 后端 9 条全过

**阶段 6 — 前端**
- 新建：`frontend/` 全量(见 §4)；`hooks/useRunEvents` + `runEventReducer`
- 验证：`npm run build` 通过；新建任务→实时进度→候选表→下载→详情弹窗
- 验收：§15 前端 7 条全过

**阶段 7 — 权限 + 部署**
- 新建：`Dockerfile.server`、`docker-compose.yml`、`nginx.conf`；前端 dist 托管
- 验证：他机浏览器访问；产物下载鉴权；构建产物无 Dify Key
- 验收：§15 部署 4 条全过；A/B 两套部署文档可复现

---

## 17. Codex 执行清单（可直接照做）

```
[阶段0] review_batch.py 业务修复（最先做，独立提交）
 0a. review_batch.py:40 → ENABLE_LEADERSHIP_PRIORITY = True
 0b. load_leadership_priorities(paths, enabled=None) 首部：if enabled is None: enabled = ENABLE_LEADERSHIP_PRIORITY；if not enabled: return []
 0c. main() argparse 加 --disable-leadership-priority(store_true)；
     leadership_priorities = load_leadership_priorities(paths, enabled=not args.disable_leadership_priority)
 0d. 跑：python review_batch.py --input <源> --output-dir .\outputs\_p0 --award-filter "全球业务突破奖" --award-filter "AI价值领航奖"
     人工核对复宏汉霖/复星健康槽位内重排 + HLX11项目组↔HLX11 产品组

[阶段1] review_batch.py 结构改造
 1. 全部常量定义之后加：dataclass ReviewBatchConfig(template/award_config 用 None+__post_init__)/ReviewBatchResult、Protocol EventSink、NullEventSink、RunCancelled
 2. 写 run_review_batch(config,event_sink=None,should_cancel=None)：搬 main() 逻辑，参数化路径/Dify凭据/过滤；
    leadership_priorities = load_leadership_priorities(paths, enabled=config.enable_leadership_priority)  # ★ 不写 global
    在 excel载入/每候选起止/ranking/reason/export/每产物/qa 处插 sink.emit；循环顶 if should_cancel(): raise RunCancelled
    run_review_batch 不 sys.exit；main() 收 result 后 QA 不过再 SystemExit
 3. run_quality_checks 后不退出，return ReviewBatchResult；main() 改为组 config→调用→QA不过再 SystemExit
 4. 跑：python -m py_compile review_batch.py；python review_batch.py --input <源> --output-dir .\outputs\_diff --dry-run，对比产物

[阶段2] 后端骨架
 5. mkdir review_platform/server/app/{core,api/routes,platform,lines/award_review,db}；写 requirements.txt(fastapi,uvicorn[standard],pydantic-settings,SQLAlchemy>=2,psycopg[binary],passlib[bcrypt],python-jose,python-multipart,openpyxl,requests)
 6. core/config.py(Settings 见 §5.1)、core/paths.py(run/upload 目录推导)、core/security.py(hash/jwt/require_role)
 7. db/base.py(engine+SessionLocal；仅 sqlite dialect 设 WAL PRAGMA，PG 跳过)、db/models.py(§8 全表，含 Run.cancel_requested，SQLite/PG 可移植)、db/init_db.py(create_all + seed admin + seed business_lines)
 8. api/schemas.py(Run/Event/Artifact/Candidate/Login DTO)、api/deps.py、routes/health.py、routes/auth.py、main.py(app+CORS+StaticFiles+startup:init_db+注册线)、run_server.py
 9. 跑：python run_server.py；curl /api/health；登录拿 token

[阶段3] 平台层
10. platform/business_line.py(§6 全 dataclass+Protocol)、registry.py、storage.py(本地读写+路径前缀校验)
11. events.py(EventBus 退化为持久化器：publish=写 run_events 表 + 追加 events.jsonl；get_events=SELECT id>after_id；无内存订阅队列)
12. run_manager.py(ThreadPoolExecutor；create_run/submit/_execute/get/list/cancel；should_cancel=读 runs.cancel_requested；
    _execute：正常→succeeded(无论 qa_passed) / 异常→failed(记 error) / RunCancelled→cancelled；写 summary_json{execution_completed,qa_passed,failed_checks})
13. 单测：EventBus 重放、RunManager 取消、并发两 run 目录隔离

[阶段4] 评优线
14. lines/award_review/line.py(manifest+config_schema+validate_config)、schemas.py
15. adapter.py(§7.4 run_award_review)、runner.py(AwardReviewRunner.run=调 adapter)、ingest.py(§7.5 映射入库)
16. main.py startup 注册 AwardReviewLine；跑 dry-run run，验 SSE/产物/candidate_results/QA

[阶段5] 路由
17. routes/business_lines.py、runs.py(POST multipart 创建 + 列表/详情 + cancel[set cancel_requested,status=cancelling,返回 {status:"cancelling"}] + events + SSE stream[DB 轮询 id>last_id, Last-Event-ID, sleep 0.75s])、artifacts.py(列表/下载 FileResponse+鉴权≥reviewer)、candidates.py(表/详情/qa-report，≥reviewer)
18. httpx 跑 §15 后端 9 条

[阶段6] 前端
19. npm create vite(react-ts)；装 tailwind/lucide-react/@microsoft/fetch-event-source/react-router-dom
20. api/client.ts(鉴权头)、api/types.ts；hooks/useRunEvents.ts+runEventReducer.ts(§10 映射)
21. pages/components(§4 §11)；vite proxy /api→8000
22. npm run build；走通新建→进度→候选表→下载→详情

[阶段7] 权限+部署
23. require_role：创建 run/取消/下载任意产物/候选详情/internal_pack/qa_report 均 ≥reviewer；账号/改角色/清理 admin；viewer 只读无下载。前端按 role 隐藏“新建任务”与全部下载按钮
24. Dockerfile.server、docker-compose.yml(server+db(pg)+nginx)、nginx.conf(443→server, 托管 dist)
25. 他机访问验收；grep dist 确认无 DIFY key；写 A/B 部署 README
```

---

## 附：需求包 §24 关键问题逐条对照
1. 建哪些目录/文件 → §4 + §16/§17。
2. review_batch.py 最小风险改造 → §7（提取 `run_review_batch`，main 变薄壳，逻辑逐字复制）。
3. run_id 在哪生成 → 服务器 `RunManager.create_run`，格式 `run_{YYYYMMDD_HHMMSS}_{6hex}`。
4. 后台任务怎么执行 → ThreadPoolExecutor worker 线程（§5.2）。
5. SSE 怎么推 → EventBus per-run queue + 持久化（§5.3/§10）。
6. 刷新如何恢复 → 事件持久化 + `GET /runs/{id}` + `GET events?after_id`/`Last-Event-ID` 重放（§5.3）。
7. 产物保存/下载 → run 目录隔离 + Artifact 表 + 鉴权下载（§12）。
8. internal_pack 解析候选表 → `ingest.py` 字段映射（§7.5）。
9. 固定优先级如何保持 → 不动算法，仅把开关收敛到 config 且默认 True，别名全保留（§0/§7）。
10. 前端组织 → §11 路由/组件。
11. 本地启动 → §14（uvicorn + vite）。
12. 服务器部署 → §14（A 快速 / B 稍正式 + Docker Compose）。
13. 保护内部数据 → §13（三角色 + Key 服务器侧 + 经后端下载）。
14. 第二条线接入 → 新增 `lines/<x>/` 实现 `BusinessLine` 并注册，路由零改（§6）。
```
