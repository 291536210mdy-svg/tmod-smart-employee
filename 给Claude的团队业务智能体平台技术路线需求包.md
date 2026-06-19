# 给 Claude 的技术路线需求包：团队业务智能体平台第一版

生成日期：2026-06-18  
当前项目目录：`E:\工作文件夹\TMOD\6月评优\testing`  
第一条业务线：评优业务线  
目标读者：Claude  
目标输出：请基于本文，为 Codex 生成一份可以直接代码落地的详细技术路线

---

## 1. 请 Claude 先明确理解我的真实诉求

我不是只想做一个“评优脚本的网页壳”，也不是只想做一个一次性的评优工具。

我想为团队做一个长期可扩展的 **团队业务智能体平台**。现在的评优工作只是第一条业务线，是一条已经跑通、业务复杂度足够高、可以作为样板的业务线。未来还会有其他条线加入，每条线都是这个团队的一类真实业务流程。

请 Claude 把这件事理解为：

> 做一个面向团队的内部智能体工作台，把团队里重复、复杂、需要材料处理、规则判断、智能体辅助、人工复核和结果产出的业务流程，封装成一条条可运行、可追踪、可复核、可扩展的业务线。

第一版请不要叫“临时 MVP”。我希望把第一版当作完整的一版来设计：  
它可以先只包含“评优业务线”，但这条线要完整、能给团队正式使用、能部署到服务器上、其他同事能用自己电脑浏览器访问。

---

## 2. 我希望 Claude 输出什么

请 Claude 输出一份 **细致到 Codex 可以直接按文件落地编码** 的技术路线。

不要只写抽象概念，不要只说“可以使用 FastAPI、React、数据库”。请输出到以下颗粒度：

1. 目标产品定义
2. 第一版边界
3. 总体架构图
4. 后端目录结构
5. 前端目录结构
6. 业务线插件/模块抽象
7. 如何迁移现有 `review_batch.py`
8. 数据模型设计
9. API 设计
10. SSE 事件设计
11. 文件产物管理设计
12. 运行状态机设计
13. 评优业务线完整流程
14. 前端页面与交互设计
15. 权限与部署设计
16. 测试与验收标准
17. 分阶段实施顺序
18. 每个阶段具体要新建/修改哪些文件
19. 每个关键模块建议的类名、函数名、参数、返回值
20. 哪些地方保持现有逻辑不动，哪些地方需要抽象出来

最终效果应该是：我把 Claude 输出的技术路线发给 Codex，Codex 可以照着直接开始创建目录、写 FastAPI、包装现有评优流程、做前端页面、实现 SSE、实现本地部署。

---

## 3. 当前业务背景：评优工作是什么

当前项目是一个评优辅助智能体流程，目标是把申报 Excel 中的候选材料，结合评优规则和 Dify Workflow 的智能评审能力，生成：

- 评优结果 Excel
- 内部审查包 JSONL
- QA 报告
- 待补充清单
- 排名理由
- 可复核的证据与评分信息

项目不是要让 AI 自动决定谁获奖，而是辅助评审团队形成：

> 可比较、可解释、可追溯、可人工复核的拟推荐结果。

当前输入源数据：

```text
E:\工作文件夹\TMOD\6月评优\2026实战\源数据v2.xlsx
```

当前工作目录：

```text
E:\工作文件夹\TMOD\6月评优\testing
```

当前核心脚本：

```text
E:\工作文件夹\TMOD\6月评优\testing\review_batch.py
```

当前输出目录通常在：

```text
E:\工作文件夹\TMOD\6月评优\testing\outputs
```

当前模板文件：

```text
E:\工作文件夹\TMOD\6月评优\testing\评选结果输出格式.xlsx
```

当前奖项配置：

```text
E:\工作文件夹\TMOD\6月评优\testing\award_config.json
```

当前手动排名调整脚本：

```text
E:\工作文件夹\TMOD\6月评优\testing\apply_manual_rank_patch.py
```

---

## 4. 当前代码已经具备的能力

当前 `review_batch.py` 已经是一条完整的命令行批处理流水线。它大致包含以下能力：

1. 读取输入 Excel
2. 识别表头和候选行
3. 构造 Dify Workflow 输入
4. 调用 Dify 评审 Workflow
5. 解析 Dify 返回 JSON
6. 按证据维度计算本地评分
7. 应用风险扣分
8. 应用 tie-break 逻辑
9. 应用固定优先级规则
10. 在同奖项内排序
11. 对特定主体执行“槽位内重排”
12. 生成排名理由
13. 修复低质量排名理由
14. 导出结果 Excel
15. 导出内部审查包 JSONL
16. 导出待补充清单 Excel
17. 运行 QA 检查
18. 输出 QA 报告 JSON

重要函数包括：

```text
build_workflow_inputs(record)
call_dify_workflow(base_url, api_key, inputs, user, timeout)
calculate_score(review_json, award_config)
match_leadership_priority(row, award_name, priorities)
apply_leadership_priority(base_score, priority)
apply_leadership_slot_adjustment(sorted_entries)
rank_candidates(entries, config, dry_run=False)
generate_ranking_reasons(entries, base_url, api_key, user, timeout, dry_run=False)
write_results_xlsx(template_path, output_path, result_rows, detail_rows)
write_internal_pack(path, entries)
write_completion_xlsx(path, entries)
run_quality_checks(xlsx_path, internal_pack_path, expected_rows, require_dify_reasons=True)
main()
```

当前命令行参数包括：

```text
--input
--template
--output-dir
--award-config
--leadership-priority
--top-n
--env-file
--award-filter
--limit
--sleep
--timeout
--dry-run
```

这些能力应该被保留，但要从“只能命令行运行”升级为“能通过网站创建任务、后台运行、前端看进度和结果”。

---

## 5. 当前评优评分逻辑

当前默认评分配置来自 `award_config.json`。默认权重是：

```json
{
  "rule_match": 0.25,
  "quantitative": 0.20,
  "value_impact": 0.25,
  "innovation": 0.15,
  "strategy_align": 0.15
}
```

含义：

| 维度 | 含义 |
|---|---|
| `rule_match` | 与奖项规则的匹配程度 |
| `quantitative` | 量化证据充分性 |
| `value_impact` | 业务价值和结果贡献 |
| `innovation` | 创新性、突破性、复杂度 |
| `strategy_align` | 与集团战略和奖项导向的契合 |

风险扣分：

```text
risk_penalty_per_flag = 5
max_risk_penalty = 15
```

tie-break 关键词：

```text
一线
海外
```

请 Claude 不要建议第一版重写评分算法。第一版应该先把现有算法稳定包装成服务化能力。

---

## 6. 当前已经写入本地代码的固定优先级规则

以前参考过两个 Excel：

```text
E:\工作文件夹\TMOD\6月评优\2026实战\汉霖优先级.xlsx
E:\工作文件夹\TMOD\6月评优\2026实战\复星健康优先级.xlsx
```

但现在用户希望优先级逻辑写成本地固定逻辑，默认不再参考这些 xlsx。当前代码中已经把默认外部优先级文件设为空，只保留代码内置固定优先级。

非常重要：这些优先级不是全局置顶，不是把某个主体直接推到奖项第一名。它的业务含义是：

> 只在这些主体原本已经占据的槽位内重排。其他公司、其他主体原本靠前的位置不能被挤掉。

### 6.1 复宏汉霖：全球业务突破奖

当申报项目为：

```text
全球业务突破奖 Global Business Breakthrough Award
```

复宏汉霖获奖主体的优先级必须为：

```text
复宏汉霖 -药政注册部
>
复宏汉霖  全球产品开发部
>
复宏汉霖  HLX11 产品组
>
复宏汉霖商务拓展部
>
复宏汉霖 税务团队
```

兼容别名：

```text
复宏汉霖  HLX11项目组
```

应被识别为：

```text
复宏汉霖  HLX11 产品组
```

### 6.2 复宏汉霖：AI价值领航奖

当申报项目为：

```text
AI价值领航奖 AI Value Navigator Award
```

复宏汉霖获奖主体优先级必须为：

```text
复宏汉霖 全球创新中心
>
复宏汉霖 数智创新部
```

### 6.3 复星健康：企业经营乘长奖

当申报项目为：

```text
企业经营乘长奖 Corporate Transformational Growth Award
```

复星健康获奖主体优先级必须为：

```text
上海星晨儿童医院
>
宿迁钟吾医院院委会
```

### 6.4 复星健康：AI价值领航奖

当申报项目为：

```text
AI价值领航奖 AI Value Navigator Award
```

复星健康获奖主体优先级必须为：

```text
广州复星禅诚医院
>
中国药科大学附属重庆星荣整形外科医院新媒体营销部
```

### 6.5 固定优先级权重要求

在这些固定优先级命中的情况下：

```text
优先级权重 = 100%
正常评审权重 = 0%
```

但是排名理由不能暴露“人为操控”痕迹。理由仍然必须像普通候选一样说明：

- 项目事实
- 证据
- 量化结果
- 奖项匹配程度
- 排序原因

内部审计包可以保留优先级元数据，但最终对外展示的排名理由不能只写“因为内部优先级更高”。

---

## 7. 现在命令行是怎么跑的

全量运行示例：

```powershell
cd "E:\工作文件夹\TMOD\6月评优\testing"

& "C:\Users\miaodeyu\AppData\Local\Programs\Python\Python311\python.exe" .\review_batch.py `
  --input "E:\工作文件夹\TMOD\6月评优\2026实战\源数据v2.xlsx" `
  --output-dir ".\outputs\2026_fixed_priority_full_run"
```

只跑全球业务突破奖：

```powershell
cd "E:\工作文件夹\TMOD\6月评优\testing"

& "C:\Users\miaodeyu\AppData\Local\Programs\Python\Python311\python.exe" .\review_batch.py `
  --input "E:\工作文件夹\TMOD\6月评优\2026实战\源数据v2.xlsx" `
  --output-dir ".\outputs\2026_fixed_priority_global_only" `
  --award-filter "全球业务突破奖"
```

只跑全球业务突破奖和 AI价值领航奖：

```powershell
cd "E:\工作文件夹\TMOD\6月评优\testing"

& "C:\Users\miaodeyu\AppData\Local\Programs\Python\Python311\python.exe" .\review_batch.py `
  --input "E:\工作文件夹\TMOD\6月评优\2026实战\源数据v2.xlsx" `
  --output-dir ".\outputs\2026_fixed_priority_global_ai" `
  --award-filter "全球业务突破奖" `
  --award-filter "AI价值领航奖"
```

请 Claude 在技术路线中说明：第一版网页应该把这些命令行参数变成表单和任务配置，而不是让用户再手敲命令。

---

## 8. 第一版产品定位

第一版是：

> 团队业务智能体平台的第一版，其中评优业务线是第一条完整上线的业务线。

第一版必须做到：

1. 可以部署到服务器
2. 团队其他人在自己电脑浏览器访问
3. 用户通过网页创建评优任务
4. 用户上传或选择 Excel 源数据
5. 用户选择是否筛选奖项
6. 用户可以选择正式运行或 dry-run
7. 后台执行现有评优逻辑
8. 前端实时显示运行进度
9. 运行完成后可以查看结果
10. 可以下载 Excel、内部审查包、QA 报告、待补充清单
11. 可以查看每个候选人的审查依据
12. 可以看到 QA 是否通过
13. 每次运行都有独立 `run_id`
14. 每次运行的参数、事件、产物路径都可追溯
15. 架构上允许未来接入第二条、第三条业务线

第一版不应做成简陋 demo，而应做成可部署、可多人访问、可持续迭代的轻量生产版。

如果有可用的内网服务器或自购云服务器，第一版建议优先具备：

- 基础账号登录
- 管理员/普通用户两级权限
- PostgreSQL 或可平滑迁移到 PostgreSQL 的数据层
- Redis + 后台 Worker，或至少明确可替换为 Redis/Worker 的任务执行层
- 服务器本地磁盘或 NAS 文件存储
- HTTPS 或位于可信内网/VPN 后的访问方式
- 完整运行日志、事件日志和产物记录

第一版可以不强制实现的重型企业能力是：

- 复杂 RBAC
- SSO/企业统一身份认证
- 对象存储
- Kubernetes
- 多实例高可用
- 跨部门多租户治理

请 Claude 不要把这些能力简单写成“不做”，而要区分为：

| 能力 | 第一版轻量生产实现 | 后续增强 |
|---|---|---|
| 权限 | 基础登录 + 管理员/普通用户 | 复杂 RBAC、业务线级权限、文件级权限 |
| 身份认证 | 本地账号或内网访问控制 | SSO、企业微信/AD/飞书统一认证 |
| 任务执行 | 单 Worker 或 Redis 队列 | Celery/RQ/Arq 多 Worker、任务恢复 |
| 数据库 | PostgreSQL 推荐，SQLite 仅作本地开发兜底 | PostgreSQL 备份、迁移、审计 |
| 文件存储 | 服务器磁盘或 NAS | MinIO/S3/OSS 对象存储 |
| 部署 | 单机 Docker Compose 或普通服务部署 | Kubernetes、高可用、灰度发布 |

---

## 9. 从“线”到“面”的平台抽象

现在评优是一条线。未来每条业务线都应该遵循统一结构：

```text
输入材料
  -> 业务线识别
  -> 规则/知识检索
  -> 智能体处理
  -> 本地确定性逻辑
  -> 生成结果
  -> QA 校验
  -> 人工复核
  -> 最终产物
  -> 可追问解释
```

平台层应该通用化：

```text
团队智能体平台
├─ 通用平台层
│  ├─ 文件上传/解析
│  ├─ 任务运行 run_id
│  ├─ 实时进度事件
│  ├─ 结果产物管理
│  ├─ 规则/知识库管理
│  ├─ 人工复核与调整
│  ├─ 审计日志
│  └─ 对话问答
│
├─ 业务线插件层
│  ├─ 评优业务线
│  ├─ 会议纪要业务线
│  ├─ 制度问答业务线
│  ├─ 项目复盘业务线
│  ├─ 培训材料业务线
│  └─ 未来其他业务线
│
└─ 智能体运行层
   ├─ Dify Workflow
   ├─ 本地规则逻辑
   ├─ Excel/Word/PDF 处理
   ├─ 排序/评分/校验
   ├─ 产物导出
   └─ 解释与问答
```

请 Claude 重点设计“业务线插件层”或“业务线模块层”。第一版可以只有 `award_review`，但接口要能承载未来业务线。

建议每条业务线都有类似配置：

```json
{
  "line_id": "award_review",
  "name": "评优业务线",
  "description": "基于申报 Excel、评优规则和 Dify Workflow 生成拟推荐名单、审查包和 QA 报告。",
  "input_types": ["xlsx"],
  "run_modes": ["full", "dry_run", "award_filter"],
  "artifacts": [
    "review_results.xlsx",
    "internal_review_pack.jsonl",
    "qa_report.json",
    "completion.xlsx"
  ],
  "supports_events": true,
  "supports_result_query": true,
  "supports_export": true
}
```

---

## 10. 要学习的 LambChat 设计

参考项目：

```text
https://github.com/Yanyutin753/LambChat/tree/main
```

LambChat 不是要照搬代码，而是学习它的工业化外壳。

### 10.1 LambChat 的关键设计

LambChat 是一个完整的 AI Agent 平台，而不是简单聊天 demo。它的结构包括：

- React/Vite 前端工作台
- FastAPI 后端
- SSE/WebSocket 流式事件
- AgentFactory
- BaseGraphAgent
- deepagents/LangGraph 执行
- Presenter
- EventProcessor
- TaskManager
- MCP 工具管理
- Skills
- Memory
- 权限、团队、会话、文件、任务、模型配置等平台能力

可以参考的源码文件：

- `README.md`  
  https://github.com/Yanyutin753/LambChat/blob/main/README.md

- `src/api/main.py`  
  https://github.com/Yanyutin753/LambChat/blob/main/src/api/main.py

- `src/api/routes/chat.py`  
  https://github.com/Yanyutin753/LambChat/blob/main/src/api/routes/chat.py

- `src/agents/core/base.py`  
  https://github.com/Yanyutin753/LambChat/blob/main/src/agents/core/base.py

- `src/agents/fast_agent/nodes.py`  
  https://github.com/Yanyutin753/LambChat/blob/main/src/agents/fast_agent/nodes.py

- `frontend/src/hooks/useAgent/sseConnection.ts`  
  https://github.com/Yanyutin753/LambChat/blob/main/frontend/src/hooks/useAgent/sseConnection.ts

- `frontend/src/hooks/useAgent/eventProcessor.ts`  
  https://github.com/Yanyutin753/LambChat/blob/main/frontend/src/hooks/useAgent/eventProcessor.ts

### 10.2 LambChat 对本项目最有价值的抽象

| LambChat 抽象 | 本项目对应 |
|---|---|
| AgentFactory | `BusinessLineFactory` 或 `ReviewRunFactory` |
| BaseGraphAgent | `BusinessLineRunner` 或 `AwardReviewRunner` |
| TaskManager | `RunManager`，管理 `run_id`、状态、取消、失败、产物 |
| Presenter | `RunEventEmitter`，把运行过程变成事件 |
| EventProcessor | 前端 `runEventReducer`，把事件更新为进度、日志、表格 |
| SSE | 前端实时查看评优进度 |
| Tools/Skills/MCP | 本项目中的 Dify Workflow、规则库、本地评分、Excel 导出、QA 检查 |
| Session/Run | 本项目中的 `run_id`、`business_line_id`、`artifact_id` |

### 10.3 建议学习但不要照搬的点

可以学习：

1. 后端用 FastAPI 做统一服务壳
2. 长任务提交后立即返回 `run_id`
3. 后台任务独立运行
4. 前端通过 SSE 看事件流
5. 运行过程与 UI 展示解耦
6. 产物、日志、状态都围绕 `run_id` 组织
7. Agent/业务线通过工厂注册，而不是写死在路由里

不要第一版照搬：

1. 不要引入 LangGraph/deepagents 作为核心执行层  
   当前 Dify Workflow 已经承担智能评审，Python 本地逻辑承担确定性排序和导出。

2. 不要引入复杂 MCP 系统  
   第一版只需要把 Dify、本地 Excel 处理、QA 作为业务线能力。

3. 不要一开始做完整多租户和复杂 RBAC  
   可以先做简单登录或内网访问控制，但架构要留权限字段。

4. 不要为了像 LambChat 而牺牲现有稳定流程  
   当前 `review_batch.py` 的业务逻辑必须保留，优先包装和抽象。

---

## 11. 我希望第一版采用的推荐技术栈

请 Claude 可以评估，但建议第一版采用：

### 后端

```text
Python 3.11
FastAPI
Uvicorn
Pydantic
SQLite
SQLAlchemy 或轻量 sqlite3 封装
本地文件系统存储 artifacts
后台线程或 asyncio task 执行 run
SSE 推送事件
```

### 前端

```text
React
Vite
TypeScript
TailwindCSS
lucide-react
fetch-event-source 或 EventSource
```

### 第一版轻量生产建议

```text
PostgreSQL
Redis 或轻量后台 Worker
基础账号登录
管理员/普通用户两级权限
服务器本地磁盘或 NAS 文件存储
SSE 推送运行事件
Docker Compose 或普通服务部署
```

### 第一版可暂缓的重型能力

```text
复杂 RBAC
SSO
对象存储
Kubernetes
多实例高可用
跨部门多租户治理
```

### 部署

第一版目标部署方式：

```text
公司内网服务器或自购云服务器
浏览器访问
FastAPI 提供 API
前端 build 后由 FastAPI 或 Nginx 提供静态文件
Dify 仍通过内网 API 调用
```

未来升级：

```text
Nginx
FastAPI
Worker
Redis
PostgreSQL
对象存储/NAS
Docker Compose
```

---

## 12. 期望的后端核心设计

请 Claude 在技术路线中设计类似下面的后端结构，但可以优化命名：

```text
server/
├─ app/
│  ├─ main.py
│  ├─ core/
│  │  ├─ config.py
│  │  ├─ paths.py
│  │  └─ logging.py
│  ├─ api/
│  │  ├─ routes/
│  │  │  ├─ business_lines.py
│  │  │  ├─ runs.py
│  │  │  ├─ artifacts.py
│  │  │  └─ health.py
│  │  └─ schemas.py
│  ├─ platform/
│  │  ├─ business_line.py
│  │  ├─ registry.py
│  │  ├─ run_manager.py
│  │  ├─ events.py
│  │  ├─ artifacts.py
│  │  └─ storage.py
│  ├─ lines/
│  │  └─ award_review/
│  │     ├─ line.py
│  │     ├─ runner.py
│  │     ├─ adapter.py
│  │     ├─ schemas.py
│  │     └─ README.md
│  └─ db/
│     ├─ models.py
│     └─ session.py
├─ requirements.txt
└─ run_server.py
```

如果 Claude 认为放在当前项目根目录更合适，也可以设计为：

```text
review_platform/
```

但必须说明和现有 `review_batch.py` 的关系。

---

## 13. 期望的业务线接口抽象

请 Claude 给出一个清晰的 Python 接口，例如：

```python
class BusinessLine(Protocol):
    line_id: str
    name: str
    description: str

    def get_manifest(self) -> BusinessLineManifest:
        ...

    def validate_config(self, config: dict) -> None:
        ...

    def run(self, context: RunContext) -> Iterator[RunEvent]:
        ...
```

或者：

```python
class BaseBusinessLineRunner:
    def prepare(self, context: RunContext) -> None:
        ...

    def execute(self, context: RunContext) -> Iterator[RunEvent]:
        ...

    def collect_artifacts(self, context: RunContext) -> list[Artifact]:
        ...
```

重点是：

1. 平台不知道评优内部怎么评分
2. 平台只知道某条业务线可以创建 run、产出事件、产出 artifacts
3. 评优逻辑在 `award_review` 业务线内部
4. 未来会议纪要、制度问答、复盘报告可以按同样接口加入

---

## 14. 期望的运行状态机

请 Claude 设计 `run` 的状态机。建议至少包含：

```text
created
queued
running
succeeded
failed
cancelled
```

如果要更细，可以加入：

```text
validating_input
reading_excel
reviewing_candidates
ranking
generating_reasons
exporting
qa_checking
completed
```

但数据库中的主状态应简单，细节通过事件流表达。

---

## 15. 期望的 SSE 事件设计

第一版必须有事件流。用户不应该盯着一个卡住的网页。

建议事件格式：

```json
{
  "id": "event_000001",
  "run_id": "run_20260618_001",
  "line_id": "award_review",
  "type": "candidate:reviewed",
  "level": "info",
  "message": "第 1 / 38 行评审完成",
  "created_at": "2026-06-18T10:00:00",
  "progress": {
    "current": 1,
    "total": 38,
    "percent": 2.63
  },
  "payload": {
    "candidate_id": "row_00001",
    "workflow_status": "succeeded"
  }
}
```

建议事件类型：

```text
run:created
run:started
input:validated
excel:loaded
candidate:started
candidate:reviewed
candidate:failed
ranking:started
ranking:done
reason:started
reason:done
export:started
artifact:created
qa:started
qa:done
run:succeeded
run:failed
run:cancelled
```

请 Claude 说明前端如何消费这些事件，如何更新进度条、日志、结果区、下载区。

---

## 16. 期望的数据模型

请 Claude 设计 SQLite 数据表。建议至少包括：

### business_lines

```text
id
line_id
name
description
enabled
created_at
updated_at
```

### runs

```text
id
run_id
line_id
status
title
config_json
input_files_json
output_dir
created_by
created_at
started_at
finished_at
error_message
summary_json
```

### run_events

```text
id
run_id
event_type
level
message
progress_current
progress_total
payload_json
created_at
```

### artifacts

```text
id
artifact_id
run_id
artifact_type
name
file_path
content_type
size_bytes
created_at
metadata_json
```

### candidate_results

```text
id
run_id
candidate_id
excel_row
award_name
subject
rank
recommendation_status
workflow_status
normal_review_score
internal_score
manual_review_required
ranking_reason
raw_json
created_at
```

### manual_actions

```text
id
run_id
candidate_id
action_type
before_json
after_json
reason
operator
created_at
```

第一版可以先不把所有审查包字段展开入库，但至少要能从 internal_pack 解析出候选人结果供前端查看。

---

## 17. 期望的 API 设计

请 Claude 给出详细 API，包括请求/响应样例。

建议第一版至少有：

```text
GET  /api/health
GET  /api/business-lines
GET  /api/business-lines/{line_id}

POST /api/runs
GET  /api/runs
GET  /api/runs/{run_id}
POST /api/runs/{run_id}/cancel
GET  /api/runs/{run_id}/events
GET  /api/runs/{run_id}/events/stream

GET  /api/runs/{run_id}/artifacts
GET  /api/runs/{run_id}/artifacts/{artifact_id}/download

GET  /api/runs/{run_id}/candidates
GET  /api/runs/{run_id}/candidates/{candidate_id}
GET  /api/runs/{run_id}/qa-report
```

如果涉及文件上传：

```text
POST /api/files/upload
```

或者在 `POST /api/runs` 中使用 multipart form-data。

请 Claude 明确推荐哪种方式，并说明原因。

---

## 18. 期望的前端设计

第一版前端不是要做华丽营销页，而是要做团队内部工具。

页面建议：

```text
/                         工作台首页
/lines                    业务线列表
/lines/award-review       评优业务线首页
/runs                     历史任务列表
/runs/:runId              任务详情页
/runs/:runId/candidates   候选人结果表
/runs/:runId/artifacts    产物下载
```

评优业务线页面应该包含：

1. 新建任务表单
2. 上传或选择 Excel
3. 输出任务标题
4. 奖项筛选输入，可多个
5. dry-run 开关
6. limit 输入，可选
7. timeout 输入，可选
8. 创建任务按钮

任务详情页应该包含：

1. 任务状态
2. 总进度
3. 实时事件日志
4. 当前处理候选人
5. QA 状态
6. 产物下载卡片
7. 候选人结果表
8. 错误信息

候选人结果表至少展示：

```text
奖项
排名
主体
推荐状态
workflow 状态
正常评审分
内部排序分
是否人工复核
排名理由
查看详情
```

候选人详情页或弹窗展示：

```text
原始行信息
评分细节
证据等级
命中规则
缺失证据
风险标记
优先级命中信息
排名理由
```

---

## 19. 期望的评优业务线迁移方式

请 Claude 特别说明如何改造现有 `review_batch.py`。

我的倾向是：

第一阶段不要大拆大改。先把它包装成可调用的 runner。

理想方式：

1. 把现有 `main()` 里的流程抽成函数，例如：

```python
def run_review_batch(config: ReviewBatchConfig, event_sink: EventSink | None = None) -> ReviewBatchResult:
    ...
```

2. CLI 的 `main()` 继续保留，只是组装 config 后调用 `run_review_batch(...)`。

3. FastAPI 后台任务也调用同一个 `run_review_batch(...)`。

4. 在关键节点调用 `event_sink.emit(...)`。

5. 保留当前 Excel 输出、JSONL 输出、QA 输出。

6. 逐步把数据写入 SQLite。

请 Claude 判断这个迁移方案是否合理，并给出具体代码改造路线。

请不要建议第一版把 `review_batch.py` 全部重写成大量类。这个脚本里有很多业务细节，盲目重构风险很高。更稳妥的方式是：

```text
先提取一个可复用函数
再加事件回调
再加结果对象
再由业务线 runner 调用
最后再逐步模块化
```

---

## 20. 期望的产物目录设计

第一版每个 run 应该有独立目录，例如：

```text
data/
├─ app.db
├─ uploads/
│  └─ run_20260618_001/
│     └─ source.xlsx
└─ runs/
   └─ run_20260618_001/
      ├─ input/
      │  └─ source.xlsx
      ├─ outputs/
      │  ├─ review_results_20260618_100000.xlsx
      │  ├─ internal_review_pack_20260618_100000.jsonl
      │  ├─ qa_report_20260618_100000.json
      │  └─ 待补充清单_20260618_100000.xlsx
      ├─ events.jsonl
      ├─ run_config.json
      └─ run_summary.json
```

请 Claude 说明：

1. 文件如何命名
2. 如何避免覆盖
3. 如何从数据库定位文件
4. 如何下载文件
5. 如何清理历史文件
6. 如何迁移到 NAS 或对象存储

---

## 21. 期望的部署说明

最终我希望部署到服务器上，让团队成员用浏览器访问。服务器来源可以是公司内网服务器，也可以是我自己购买的云服务器：

```text
http://团队服务器地址
```

如果使用云服务器，Claude 需要特别考虑：

1. 公司内部评优数据是否允许放在该云服务器上
2. 云服务器地域、网络、备案、访问速度和合规要求
3. Dify Workflow 是否能从云服务器访问
4. 云服务器是否需要公网 IP，或只通过 VPN/白名单访问
5. 安全组/防火墙只开放必要端口
6. 管理端口如 SSH/RDP 不应对全网开放
7. Web 访问应优先使用 HTTPS
8. Dify API Key、数据库密码等只能放在服务器环境变量或密钥文件中，不能进入前端代码
9. 上传文件、输出文件、internal_pack 和 QA 报告都应保存在服务器受控目录
10. 后续如果数据量变大，应支持迁移到 NAS 或对象存储

部署结构：

```text
用户浏览器
  -> 前端工作台
  -> FastAPI 后端
  -> 后台任务执行评优业务线
  -> 调用 Dify Workflow
  -> 生成 Excel / QA / 审查包
  -> 浏览器下载结果
```

请 Claude 设计第一版部署方式：

1. 本地开发怎么启动
2. 内网服务器怎么启动
3. 自购云服务器怎么启动
4. Windows 服务器是否可行
5. Linux 服务器是否可行
6. 云服务器最低推荐配置和更稳妥配置
7. 云服务器安全组应该开放哪些端口
8. 云服务器是否建议使用 Docker Compose
9. `.env` 应包含哪些配置
10. 前端如何 build
11. FastAPI 如何服务静态文件，或者是否用 Nginx
12. 文件路径如何从 `E:\...` 迁移到服务器相对路径
13. Dify API Key 如何放在服务器环境变量里
14. 如何让其他人访问
15. 如何限制只有团队成员访问
16. 如何做备份和历史产物清理

请 Claude 明确给出两套部署建议：

### A. 快速上线部署

```text
单台云服务器
FastAPI
前端静态文件
PostgreSQL
单 Worker
本地磁盘 artifacts
Nginx + HTTPS
基础账号登录
```

### B. 稍正式部署

```text
单台云服务器或内网服务器
Nginx
FastAPI API 服务
独立 Worker 服务
PostgreSQL
Redis
本地磁盘/NAS artifacts
HTTPS
基础账号登录 + 管理员/普通用户权限
定期数据库和产物备份
```

建议 `.env`：

```text
APP_HOST=0.0.0.0
APP_PORT=8000
APP_DATA_DIR=./data
DATABASE_URL=
REDIS_URL=
SECRET_KEY=
PUBLIC_BASE_URL=
DIFY_BASE_URL=
DIFY_REVIEW_WORKFLOW_API_KEY=
DIFY_RANKING_REASON_WORKFLOW_API_KEY=
DIFY_USER=review-platform
```

---

## 22. 隐私、安全与权限要求

当前材料涉及公司内部评优申报数据，不应上传到公开外部服务。

要求：

1. Dify 使用企业内部配置的 Workflow 和模型
2. Dify Key 不能暴露给前端
3. 上传文件和输出文件保存在服务器
4. 前端下载必须通过后端接口
5. 第一版至少要有简单访问控制方案
6. 后续能扩展到登录、角色和权限
7. internal_pack 含有内部评分、优先级信息，不能随意对所有人开放
8. 最终 Excel 可以面向更广范围下载，但内部审查包需要更严格权限

请 Claude 在技术路线中区分：

- 普通用户能看什么
- 评审管理员能看什么
- 系统管理员能看什么

第一版如果暂时不做完整权限，也要说明最小保护方案。

---

## 23. QA 与验收要求

第一版不是只要能跑起来。必须具备验收标准。

请 Claude 给出测试和验收标准，至少包括：

### 后端

1. 创建 run 返回 `run_id`
2. 任务状态从 `created/running` 变为 `succeeded` 或 `failed`
3. SSE 能实时收到事件
4. 产物能下载
5. 失败任务能记录错误
6. 同一时间多个 run 不互相覆盖输出
7. dry-run 能运行
8. award-filter 能运行
9. QA 报告能被解析和展示

### 评优业务线

1. 全量数据能跑完
2. 只跑全球业务突破奖能跑完
3. 只跑 AI价值领航奖能跑完
4. 固定优先级命中逻辑不丢
5. 复宏汉霖 HLX11项目组 能兼容 HLX11 产品组
6. 优先级只做槽位内重排，不做全局置顶
7. 结果 Excel 格式保持现有模板
8. internal_pack 内容完整
9. QA passed 时前端显示通过
10. QA failed 时前端显示具体失败项

### 前端

1. 可以新建评优任务
2. 可以看到实时进度
3. 可以看到事件日志
4. 可以看到候选人结果表
5. 可以查看候选人详情
6. 可以下载产物
7. 失败时能看到错误

### 部署

1. 服务器启动后，其他电脑能访问
2. 前端可以正常请求后端
3. 文件下载不依赖用户本机路径
4. Dify Key 不出现在浏览器代码中

---

## 24. 请 Claude 输出时必须回答的关键问题

请 Claude 在技术路线中明确回答：

1. 第一版到底应该建哪些目录和文件？
2. `review_batch.py` 如何最小风险改造成可复用 runner？
3. `run_id` 在哪里生成？
4. 后台任务怎么执行？
5. SSE 事件怎么推送？
6. 如果用户刷新页面，如何重新看到 run 状态和历史事件？
7. 产物如何保存和下载？
8. `internal_review_pack.jsonl` 如何解析成候选人结果表？
9. 固定优先级逻辑如何继续保持？
10. 前端如何组织页面？
11. 本地开发如何启动？
12. 服务器部署如何启动？
13. 第一版如何保护内部数据？
14. 第二条业务线未来如何接入？

---

## 25. 请 Claude 的输出格式

请 Claude 按以下结构输出：

```text
# 团队业务智能体平台第一版技术路线

## 1. 产品目标与边界
## 2. 总体架构
## 3. 第一版功能清单
## 4. 目录结构
## 5. 后端设计
## 6. 业务线抽象设计
## 7. 评优业务线迁移设计
## 8. 数据库设计
## 9. API 设计
## 10. SSE 事件设计
## 11. 前端设计
## 12. 文件与产物管理
## 13. 权限与安全
## 14. 部署方案
## 15. 测试与验收
## 16. 分阶段代码落地计划
## 17. Codex 执行清单
```

其中第 16 和第 17 部分必须非常具体。

我希望看到类似：

```text
阶段 1：改造 review_batch.py
- 修改文件：review_batch.py
- 新增 dataclass：ReviewBatchConfig, ReviewBatchResult
- 新增函数：run_review_batch(config, event_sink=None)
- main() 调整为调用 run_review_batch
- 验证命令：python -m py_compile review_batch.py
- 验收：原命令行全量运行仍可用
```

而不是泛泛地说“先封装核心逻辑”。

---

## 26. 对 Claude 的最后提醒

请不要把这个项目写成纯聊天机器人。

这个项目的本质是：

> 团队业务流程智能体平台。

聊天只是后续解释和追问能力的一部分，不是第一版唯一入口。

第一版的核心是：

```text
业务线
任务
输入材料
后台运行
实时事件
结果表
审查包
QA
人工复核
产物下载
可追溯
可部署
可扩展
```

评优业务线是第一条完整业务线。请把它做成标杆样板，让未来会议纪要、制度问答、项目复盘、培训材料生成等业务线可以沿用同一套平台外壳。
