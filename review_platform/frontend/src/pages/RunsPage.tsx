import { RefreshCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, listRuns } from "../api/client";
import type { Run } from "../api/types";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime, toArrayText } from "../utils/format";

type RunsPageProps = {
  compact?: boolean;
};

export function RunsPage({ compact = false }: RunsPageProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setRuns(await listRuns());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "运行记录加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

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
        <div>
          <h2 className="text-base font-bold">运行记录</h2>
          <p className="text-sm text-stone-500">{loading ? "加载中" : `${runs.length} 条`}</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {error ? <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

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
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRuns.map((run) => (
                <tr className="hover:bg-stone-50" key={run.run_id}>
                  <td className="max-w-sm px-4 py-3">
                    <Link className="font-semibold text-teal hover:underline" to={`/runs/${run.run_id}`}>
                      {run.title || run.run_id}
                    </Link>
                    <div className="mt-1 truncate text-xs text-stone-500">{run.run_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="max-w-xs px-4 py-3 text-stone-600">{toArrayText(run.config.award_filters)}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {String(run.summary.processed_rows ?? run.summary.candidate_results ?? "-")}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{formatDateTime(run.created_at)}</td>
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
