import { Bot, CheckCircle2, Layers3, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, getBusinessLines } from "../api/client";
import type { BusinessLine } from "../api/types";
import { EmptyState } from "../components/EmptyState";

export function LinesPage() {
  const [lines, setLines] = useState<BusinessLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setLines(await getBusinessLines());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "业务线加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 pb-8 pt-24">
    <section className="rounded border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line px-4 py-4">
        <div>
          <h1 className="text-lg font-bold">业务线</h1>
          <p className="text-sm text-stone-500">{loading ? "加载中" : `${lines.length} 条`}</p>
        </div>
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-stone-700 hover:bg-stone-50"
          onClick={() => void refresh()}
          title="刷新"
          type="button"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {error ? <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {!loading && lines.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={Layers3} title="暂无业务线" body="后端注册业务线后会显示在这里。" />
        </div>
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {lines.map((line) => (
            <div className="rounded border border-line bg-panel p-4" key={line.line_id}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white text-teal">
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold">{line.name}</h2>
                  <p className="mt-1 break-words text-sm text-stone-600">{line.description}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                <LineFlag label="事件" enabled={line.supports_events} />
                <LineFlag label="查询" enabled={line.supports_result_query} />
                <LineFlag label="导出" enabled={line.supports_export} />
              </div>
              <Link className="mt-4 inline-flex h-10 items-center rounded bg-ink px-4 text-sm font-semibold text-white hover:bg-stone-800" to="/">
                进入工作台
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
    </div>
  );
}

function LineFlag({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded border border-line bg-white px-3 py-2">
      <CheckCircle2 className={enabled ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-stone-300"} aria-hidden="true" />
      <span className="font-semibold text-stone-700">{label}</span>
    </div>
  );
}
