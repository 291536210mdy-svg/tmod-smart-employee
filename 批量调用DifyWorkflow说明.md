# 批量调用 Dify Workflow 第一版运行说明

## 当前已完成

本目录已完成第一版本地批处理骨架，核心文件：

- `review_batch.py`：读取 Excel，逐行调用 Dify Workflow，生成全量候选排名表和内部评审包。
- `award_config.json`：控制每个奖项默认推荐名额、评分权重、一线/海外同分排序倾向。最终结果表会展示所有申报候选，名额配置只影响内部 `recommended / not_selected / needs_review` 状态。
- `requirements.txt`：当前依赖为 `openpyxl` 和 `requests`。

第一版已经不是一次性脚本，而是后续可接 FastAPI 的可复用后端骨架。当前仍保留 CLI 入口，方便先实战跑通。

## 环境变量

脚本默认读取两个位置的环境变量：

1. 当前目录 `.env`
2. `E:\Agent学习\my_project\.env`

必须包含：

```text
DIFY_BASE_URL=...
DIFY_REVIEW_WORKFLOW_API_KEY=...
```

可选：

```text
DIFY_USER=review-batch
```

如果已经创建“评优排名理由生成工作流”，再补充：

```text
DIFY_RANKING_REASON_WORKFLOW_API_KEY=...
```

说明：

- `DIFY_REVIEW_WORKFLOW_API_KEY` 是“评优候选人评审 Workflow App”的 API Key。
- `DIFY_RANKING_REASON_WORKFLOW_API_KEY` 是“评优排名理由生成 Workflow App”的 API Key。没有配置时，脚本会继续使用本地规则生成排名理由，不会中断导出。
- `DIFY_BASE_URL` 可以带 `/v1`，也可以不带 `/v1`，脚本会自动兼容。

## 安装依赖

如果 PowerShell 里有 `python`：

```powershell
python -m pip install -r requirements.txt
```

如果本机 PATH 没有 `python`，可以使用当前已验证过的解释器：

```powershell
& 'C:\Users\miaodeyu\AppData\Local\Programs\Python\Python311\python.exe' -m pip install -r requirements.txt
```

## 运行命令

先做不调用 Dify 的干跑：

```powershell
& 'C:\Users\miaodeyu\AppData\Local\Programs\Python\Python311\python.exe' review_batch.py --dry-run --limit 1
```

调用 Dify 处理前 1 行：

```powershell
& 'C:\Users\miaodeyu\AppData\Local\Programs\Python\Python311\python.exe' review_batch.py --limit 1
```

确认没问题后处理全部：

```powershell
& 'C:\Users\miaodeyu\AppData\Local\Programs\Python\Python311\python.exe' review_batch.py
```

常用参数：

```powershell
--input        输入 Excel 路径，默认 sample_input.xlsx
--template     最终名单模板，默认 评选结果输出格式.xlsx
--output-dir   输出目录，默认 outputs
--award-config 奖项名额和权重配置，默认 award_config.json
--top-n        每个奖项默认拟推荐人数，默认 2
--limit        只处理前 N 行，0 表示全部
--dry-run      只生成 Workflow 输入，不调用 Dify
```

## Dify Start 变量

| Dify 变量 | 来源 |
|---|---|
| `candidate_id` | Excel 行号生成，如 `row_00002` |
| `batch_id` | `申报批次` |
| `award_name` | `申报项目` |
| `award_type` | 根据奖项名称、申报主体、姓名推断为团队奖/个人奖/未知 |
| `submission_reason_masked` | 脱敏后的 `申报理由`，用于证据评审 |
| `submission_reason_full` | 原始 `申报理由`，用于最终名单字段抽取 |
| `raw_row_json` | 整行 Excel 原始字段 JSON |

## Dify Output 变量

| Dify 输出 | 用途 |
|---|---|
| `review_result_json` | 证据等级、规则命中、缺失证据、风险提示、解释文本 |
| `final_fields_json` | 主体、提报人、团队负责人、团队成员、事迹等最终名单字段 |

注意：

- LLM 不直接决定谁获奖。
- Dify 只负责理解材料、抽取字段、判断证据强弱。
- Python 本地根据 `award_config.json` 计算内部分数和排序。

## 输出文件

每次运行会在 `outputs` 下生成 4 类文件：

| 文件 | 用途 |
|---|---|
| `review_results_时间戳.xlsx` | 全量候选排名 Excel。第一个 Sheet 是按奖项分组后的候选排名表，第二个 Sheet 是评审明细 |
| `review_results_时间戳.jsonl` | 原始 Workflow 输入、输出、响应，便于排查 API 调用 |
| `internal_review_pack_时间戳.jsonl` | 内部评审包，包含推荐状态、内部分数、证据、风险、字段来源 |
| `待补充清单_时间戳.xlsx` | 需要人工补充或复核的字段清单 |

结果 Sheet 使用这 9 列，A 列同一奖项会合并单元格：

| 奖项名称 | 序号 | 主体 | 所属BU | 提报人 | 团队负责人 | 团队成员 | 事迹 | 排名理由 |
|---|---|---|---|---|---|---|---|---|

其中 `序号` 是同一奖项内部的匹配度排名，会从 1 开始重新编号。

## 排序和推荐逻辑

当前结果表会展示每个奖项下所有申报过的团队/个人，并按匹配度从高到低排列。

`--top-n` 或 `award_config.json` 仍保留，用于内部标记 `recommended / not_selected / needs_review`，但不再决定第一个 Sheet 是否展示某个候选。

评分维度来自 Dify 的 `evidence_grades`：

| 维度 | 默认权重 |
|---|---:|
| `rule_match` | 0.25 |
| `quantitative` | 0.20 |
| `value_impact` | 0.25 |
| `innovation` | 0.15 |
| `strategy_align` | 0.15 |

等级换算：

| Dify grade | 分值 |
|---|---:|
| `strong` | 100 |
| `medium` | 70 |
| `weak` | 35 |
| `missing` | 0 |

排序规则：

1. 同一奖项下，所有候选都会进入结果 Sheet。
2. 候选人按内部分数从高到低排序。
3. 同分时，一线/海外关键词作为排序倾向，不直接加分到最终分数里。
4. 若仍同分，则按 Excel 原始行顺序排序。
5. 有重大风险或证据完全缺失的候选人仍会被标记为 `needs_review`，但也会出现在结果 Sheet 中，并在 `排名理由` 里提示人工复核。
6. 超出配置名额的候选人标记为 `not_selected`，但也会出现在结果 Sheet 中。

## I 列“排名理由”生成规则

当前版本支持两种 `排名理由` 生成方式：

1. 如果 `.env` 里配置了 `DIFY_RANKING_REASON_WORKFLOW_API_KEY`，Python 会在同奖项排序完成后逐个调用 Dify 排名理由 Workflow。
2. 如果没有配置该 Key，或单条调用失败，则自动使用 Python 本地规则生成排名理由作为兜底。

如果改为让 Dify LLM 生成，建议不要放在现有逐行评审 Workflow 里，而是在 Python 完成同奖项排序之后，再调用一个单独的“排名理由生成 Workflow”。原因是排名理由必须知道同奖项内其他候选人的相对情况，逐行评审节点只知道当前候选人，无法解释“为什么排第 1/3 或第 2/3”。

主要包含：

1. 该候选人在当前奖项中的排名，例如 `本奖项第1/3名`。
2. 综合匹配度等级，例如 `高`、`较高`、`中等`、`偏低`、`缺失`。
3. 主要支撑维度，例如规则匹配、量化结果、价值影响、创新性、战略契合。
4. 主要缺失证据。
5. 主要风险提示。
6. 如果需要人工复核，会明确写入理由。

建议传给 Dify 排名理由 Workflow 的输入：

| 输入变量 | 内容 |
|---|---|
| `award_name` | 当前奖项名称 |
| `candidate_id` | 当前候选 ID |
| `rank` | 当前奖项内排名 |
| `total_count` | 当前奖项候选总数 |
| `candidate_summary_json` | 当前候选主体、提报人、事迹摘要、证据等级、缺失证据、风险提示、内部分数 |
| `award_ranking_summary_json` | 同奖项所有候选的简表：排名、主体、关键证据、主要不足 |
| `review_rule_summary` | 当前奖项的核心规则摘要 |

建议 Dify 输出严格 JSON：

```json
{
  "ranking_reason": "不超过120字，解释该候选为什么排在当前名次，必须基于同奖项候选对比、证据强弱、缺失证据和风险提示，不输出内部分数。",
  "key_support": ["最多3条主要支撑"],
  "key_gap": ["最多2条主要不足"],
  "manual_review_note": "如需人工复核则写原因，否则为空字符串"
}
```

## H 列“事迹”生成规则

最终名单 H 列 `事迹` 的优先级：

1. 优先使用 Dify `final_fields_json.achievement`，由 LLM 基于 Excel 的 `申报理由` 总结。
2. 如果 Dify 未返回有效事迹，则回退使用 Excel 原始 `申报理由`。
3. 如果 `申报理由` 是占位文本，例如 `此处有一段话`、`待补充`、`暂无`，则不写入最终名单，字段填 `待补充`，并进入 `待补充清单.xlsx`。

## 已验证结果

已用当前 `sample_input.xlsx` 真实调用 Dify 单行验证：

- 输出时间戳：`20260608_175010`
- Workflow 状态：`succeeded`
- 候选人状态：`needs_review`
- 内部分数：`0`
- 结果 Sheet：样例候选会出现，但排名理由会提示证据缺失和需人工复核
- 评审明细 Sheet：保留 Dify 缺失证据、风险提示、解释、字段来源、评分细节
- 待补充清单：包含 `团队成员` 和 `事迹`

这个结果符合预期，因为样例中的 `申报理由` 是占位文本 `此处有一段话`，不能作为真实评优证据。

## 当前还没做

- 还没有接 FastAPI。
- 还没有做前端 UI。
- 还没有做评优结果自然语言问答框。
- 还没有把工程拆成 `parser / dify_client / scoring / ranking / export / audit` 多文件模块。
- 已用真实完整申报 Excel 做过全量排序验收；后续还需要业务方复核排序口径。

下一步建议让业务方先看全量候选排名表，确认排序和排名理由是否符合评审口径，再决定是否拆模块和接 FastAPI。
