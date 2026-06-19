import { Archive, ArchiveRestore, ChevronLeft, RefreshCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, archiveRun, cleanupRetention, deleteRun, listRuns, unarchiveRun } from "../api/client";
import type { Role, Run } from "../api/types";
import { EmptyState } from "../components/EmptyState";
import { isTerminalStatus, StatusBadge } from "../components/StatusBadge";
import { formatDateTime, toArrayText } from "../utils/format";

type RunsPageProps = {
  compact?: boolean;
  role?: Role;
};

export function RunsPage({ compact = false, role = "viewer" }: RunsPageProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setRuns(await listRuns({ includeArchived }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "运行记录加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [includeArchived]);

  async function handleArchive(run: Run) {
    setActionError("");
    setActionMessage("");
    try {
      if (run.archived) {
        await unarchiveRun(run.run_id);
        setActionMessage("已取消归档");
      } else {
        await archiveRun(run.run_id);
        setActionMessage("已归档");
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "操作失败");
    }
  }

  async function handleDelete(run: Run) {
    if (!window.confirm(`删除任务 ${run.title || run.run_id}？本地运行文件也会被清理。`)) {
      return;
    }
    setActionError("");
    setActionMessage("");
    try {
      const result = await deleteRun(run.run_id);
      setActionMessage(result.files_deleted ? "任务已删除，文件已清理" : "任务已删除，但文件清理失败，请检查服务器目录权限");
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "删除失败");
    }
  }

  async function handleCleanup() {
    setActionError("");
    setActionMessage("");
    try {
      const preview = await cleanupRetention(true);
      if (!preview.archived_count) {
        setActionMessage("没有需要归档的旧任务");
        return;
      }
      if (!window.confirm(`将归档 ${preview.archived_count} 条旧任务，继续？`)) {
        return;
      }
      const result = await cleanupRetention(false);
      setActionMessage(`已归档 ${result.archived_count} 条旧任务`);
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "清理失败");
    }
  }

  const filteredRuns = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return compact ? runs.slice(0, 6) : runs;
    }
    return runs.filter((run) => {
      return `${run.title} ${run.run_id} ${run.status}`.toLowerCase().includes(keyword);
    });
  }, [compact, query, runs]);

  return (
    <div className={compact ? "" : "mx-auto max-w-6xl px-6 pb-8 pt-24"}>
    <section className="rounded border border-line bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {!compact ? (
            <Link
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-stone-700 hover:bg-stone-50"
              title="返回"
              to="/"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
          <div>
            <h2 className="text-base font-bold">运行记录</h2>
            <p className="text-sm text-stone-500">{loading ? "加载中" : `${runs.length} 条`}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!compact ? (
            <label className="flex h-10 items-center gap-2 rounded border border-line bg-white px-3 text-sm font-semibold text-stone-700">
              <input className="h-4 w-4 accent-teal" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} type="checkbox" />
              含归档
            </label>
          ) : null}
          {!compact ? (
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
              <input
                className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-sm sm:w-64"
                placeholder="搜索标题或 ID"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          ) : null}
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-stone-700 hover:bg-stone-50"
            onClick={() => void refresh()}
            title="刷新"
            type="button"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          {!compact && role === "admin" ? (
            <button
              className="inline-flex h-10 items-center gap-2 rounded border border-line bg-white px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              onClick={() => void handleCleanup()}
              type="button"
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              清理旧任务
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {actionError ? <div className="mx-4 mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div> : null}
      {actionMessage ? <div className="mx-4 mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{actionMessage}</div> : null}

      {!loading && filteredRuns.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={Search} title="暂无运行记录" body="提交评优任务后会出现在这里。" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-semibold">任务</th>
                <th className="px-4 py-3 font-semibold">状态</th>
                <th className="px-4 py-3 font-semibold">奖项</th>
                <th className="px-4 py-3 font-semibold">处理量</th>
                <th className="px-4 py-3 font-semibold">创建时间</th>
                {!compact ? <th className="px-4 py-3 font-semibold">操作</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRuns.map((run) => (
                <tr className="hover:bg-stone-50" key={run.run_id}>
                  <td className="max-w-sm px-4 py-3">
                    <Link className="font-semibold text-teal hover:underline" to={`/runs/${run.run_id}`}>
                      {run.title || run.run_id}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <span className="truncate">{run.run_id}</span>
                      {run.archived ? <span className="rounded-full bg-stone-100 px-2 py-0.5">已归档</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="max-w-xs px-4 py-3 text-stone-600">{awardFilterText(run.config.award_filters)}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {String(run.summary.processed_rows ?? run.summary.candidate_results ?? "-")}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{formatDateTime(run.created_at)}</td>
                  {!compact ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {isTerminalStatus(run.status) ? (
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded border border-line bg-white text-stone-700 hover:bg-stone-50"
                            onClick={() => void handleArchive(run)}
                            title={run.archived ? "取消归档" : "归档"}
                            type="button"
                          >
                            {run.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        ) : null}
                        {role === "admin" && isTerminalStatus(run.status) ? (
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            onClick={() => void handleDelete(run)}
                            title="删除"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </div>
  );
}

function awardFilterText(value: unknown): string {
  const text = toArrayText(value);
  return text === "-" ? "全部奖项" : text;
}
