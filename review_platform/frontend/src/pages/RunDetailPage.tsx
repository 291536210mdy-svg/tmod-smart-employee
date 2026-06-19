import {
  Ban,
  ChevronLeft,
  Download,
  FileJson,
  FileText,
  RefreshCcw,
  ShieldCheck,
  Table2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  ApiError,
  cancelRun,
  downloadArtifact,
  getArtifacts,
  getCandidate,
  getCandidates,
  getQaReport,
  getRun
} from "../api/client";
import type { Artifact, Candidate, CandidateDetail, QaReport, Role, Run, RunEvent } from "../api/types";
import { EmptyState } from "../components/EmptyState";
import { ProgressBar } from "../components/ProgressBar";
import { isTerminalStatus, StatusBadge } from "../components/StatusBadge";
import { useRunEvents } from "../hooks/useRunEvents";
import { asBoolean, asNumber, formatBytes, formatDateTime, toArrayText } from "../utils/format";

type RunDetailPageProps = {
  role: Role;
  token: string;
};

export function RunDetailPage({ role, token }: RunDetailPageProps) {
  const { runId } = useParams();
  const [run, setRun] = useState<Run | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [qaReport, setQaReport] = useState<QaReport | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const canInspect = role === "reviewer" || role === "admin";

  const refresh = useCallback(async () => {
    if (!runId) {
      return;
    }
    setError("");
    try {
      const nextRun = await getRun(runId);
      setRun(nextRun);
      if (canInspect) {
        const [nextArtifacts, nextCandidates, nextQa] = await Promise.all([
          getArtifacts(runId).catch(() => []),
          getCandidates(runId).catch(() => []),
          getQaReport(runId).catch(() => null)
        ]);
        setArtifacts(nextArtifacts);
        setCandidates(nextCandidates);
        setQaReport(nextQa);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "运行详情加载失败");
    } finally {
      setLoading(false);
    }
  }, [canInspect, runId]);

  const handleTerminal = useCallback(() => {
    void refresh();
  }, [refresh]);

  const { events, error: eventError } = useRunEvents({
    runId,
    token,
    enabled: Boolean(runId),
    onTerminal: handleTerminal
  });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!run || isTerminalStatus(run.status)) {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refresh, run]);

  const latestProgress = useMemo(() => {
    return [...events].reverse().find((event) => event.progress.current !== null || event.progress.total !== null);
  }, [events]);

  async function handleCancel() {
    if (!runId || !run || isTerminalStatus(run.status)) {
      return;
    }
    setActionError("");
    try {
      setRun(await cancelRun(runId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "取消失败");
    }
  }

  async function handleDownload(artifact: Artifact) {
    if (!runId) {
      return;
    }
    setActionError("");
    try {
      await downloadArtifact(runId, artifact);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "下载失败");
    }
  }

  async function openCandidate(candidate: Candidate) {
    if (!runId) {
      return;
    }
    setLoadingDetail(true);
    setActionError("");
    try {
      setSelectedCandidate(await getCandidate(runId, candidate.candidate_id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "候选明细加载失败");
    } finally {
      setLoadingDetail(false);
    }
  }

  if (loading && !run) {
    return <div className="rounded border border-line bg-white p-4 text-sm text-stone-600 shadow-soft">加载中</div>;
  }

  if (!run) {
    return (
      <div className="space-y-4">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-teal hover:underline" to="/runs">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          返回运行记录
        </Link>
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || "运行不存在"}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pb-8 pt-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-teal hover:underline" to="/runs">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          返回运行记录
        </Link>
        <div className="flex gap-2">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-stone-700 hover:bg-stone-50"
            onClick={() => void refresh()}
            title="刷新"
            type="button"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          {canInspect && !isTerminalStatus(run.status) ? (
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              onClick={() => void handleCancel()}
              title="取消运行"
              type="button"
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded border border-line bg-white shadow-soft">
        <div className="flex flex-col gap-4 border-b border-line px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={run.status} />
              {run.cancel_requested ? <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">已请求取消</span> : null}
            </div>
            <h1 className="break-words text-xl font-bold">{run.title || run.run_id}</h1>
            <p className="mt-1 break-all text-xs text-stone-500">{run.run_id}</p>
          </div>
          <div className="min-w-60">
            <ProgressBar current={latestProgress?.progress.current} total={latestProgress?.progress.total} />
            <div className="mt-2 flex justify-between text-xs text-stone-500">
              <span>{latestProgress?.type ?? "progress"}</span>
              <span>
                {latestProgress?.progress.current ?? 0}/{latestProgress?.progress.total ?? "-"}
              </span>
            </div>
          </div>
        </div>

        {error || actionError || eventError ? (
          <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || actionError || eventError}</div>
        ) : null}

        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="奖项" value={toArrayText(run.config.award_filters)} />
          <SummaryMetric label="处理候选" value={String(run.summary.processed_rows ?? run.summary.candidate_results ?? "-")} />
          <SummaryMetric label="QA" value={qaLabel(run.summary.qa_passed, qaReport)} />
          <SummaryMetric label="创建时间" value={formatDateTime(run.created_at)} />
        </div>

        <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="dry-run" value={String(run.config.dry_run ?? "-")} />
          <SummaryMetric label="优先级" value={String(run.config.enable_leadership_priority ?? "-")} />
          <SummaryMetric label="limit" value={String(run.config.limit ?? "-")} />
          <SummaryMetric label="完成时间" value={formatDateTime(run.finished_at)} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <QaPanel qaReport={qaReport} canInspect={canInspect} />
          <CandidatesPanel canInspect={canInspect} candidates={candidates} loadingDetail={loadingDetail} onOpen={openCandidate} />
        </div>
        <div className="space-y-6">
          <ArtifactsPanel artifacts={artifacts} canInspect={canInspect} onDownload={handleDownload} />
          <EventsPanel events={events} />
        </div>
      </div>

      {selectedCandidate ? <CandidateDrawer candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} /> : null}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-panel px-3 py-3">
      <div className="text-xs font-semibold text-stone-500">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-ink">{value}</div>
    </div>
  );
}

function QaPanel({ qaReport, canInspect }: { qaReport: QaReport | null; canInspect: boolean }) {
  if (!canInspect) {
    return (
      <section className="rounded border border-line bg-white p-4 shadow-soft">
        <EmptyState icon={ShieldCheck} title="QA 结果不可见" body="viewer 可查看运行状态，reviewer 和 admin 可查看 QA 与结果明细。" />
      </section>
    );
  }

  const passed = asBoolean(qaReport?.passed);
  const errors = Array.isArray(qaReport?.errors) ? qaReport.errors : [];
  const warnings = Array.isArray(qaReport?.warnings) ? qaReport.warnings : [];

  return (
    <section className="rounded border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line px-4 py-4">
        <div>
          <h2 className="text-base font-bold">QA</h2>
          <p className="text-sm text-stone-500">{qaReport ? (passed ? "通过" : "需复核") : "等待产物"}</p>
        </div>
        <ShieldCheck className={passed ? "h-5 w-5 text-emerald-600" : "h-5 w-5 text-stone-400"} aria-hidden="true" />
      </div>
      {qaReport ? (
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <SummaryMetric label="passed" value={String(passed ?? "-")} />
          <SummaryMetric label="errors" value={String(errors.length)} />
          <SummaryMetric label="warnings" value={String(warnings.length)} />
        </div>
      ) : (
        <div className="p-4">
          <EmptyState icon={ShieldCheck} title="暂无 QA 报告" body="任务完成后会展示 QA 汇总。" />
        </div>
      )}
      {errors.length || warnings.length ? (
        <div className="border-t border-line p-4">
          <pre className="max-h-56 overflow-auto rounded bg-ink p-3 text-xs text-white scrollbar-thin">
            {JSON.stringify({ errors, warnings }, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}

function ArtifactsPanel({
  artifacts,
  canInspect,
  onDownload
}: {
  artifacts: Artifact[];
  canInspect: boolean;
  onDownload: (artifact: Artifact) => void;
}) {
  return (
    <section className="rounded border border-line bg-white shadow-soft">
      <div className="border-b border-line px-4 py-4">
        <h2 className="text-base font-bold">产物</h2>
        <p className="text-sm text-stone-500">{canInspect ? `${artifacts.length} 个文件` : "无权限"}</p>
      </div>
      {!canInspect ? (
        <div className="p-4">
          <EmptyState icon={FileText} title="产物不可见" body="reviewer 和 admin 可以下载评优结果。" />
        </div>
      ) : artifacts.length ? (
        <div className="divide-y divide-line">
          {artifacts.map((artifact) => (
            <div className="flex items-center justify-between gap-3 px-4 py-3" key={artifact.artifact_id}>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{artifact.name}</div>
                <div className="mt-1 truncate text-xs text-stone-500">
                  {artifact.artifact_type} · {formatBytes(artifact.size_bytes)}
                </div>
              </div>
              <button
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line bg-white text-stone-700 hover:bg-stone-50"
                onClick={() => onDownload(artifact)}
                title="下载"
                type="button"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4">
          <EmptyState icon={FileText} title="暂无产物" body="任务完成后会生成下载文件。" />
        </div>
      )}
    </section>
  );
}

function CandidatesPanel({
  candidates,
  canInspect,
  loadingDetail,
  onOpen
}: {
  candidates: Candidate[];
  canInspect: boolean;
  loadingDetail: boolean;
  onOpen: (candidate: Candidate) => void;
}) {
  return (
    <section className="rounded border border-line bg-white shadow-soft">
      <div className="border-b border-line px-4 py-4">
        <h2 className="text-base font-bold">候选结果</h2>
        <p className="text-sm text-stone-500">{canInspect ? `${candidates.length} 条` : "无权限"}</p>
      </div>
      {!canInspect ? (
        <div className="p-4">
          <EmptyState icon={Table2} title="候选结果不可见" body="reviewer 和 admin 可以查看候选明细。" />
        </div>
      ) : candidates.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-semibold">排序</th>
                <th className="px-4 py-3 font-semibold">获奖主体</th>
                <th className="px-4 py-3 font-semibold">奖项</th>
                <th className="px-4 py-3 font-semibold">状态</th>
                <th className="px-4 py-3 font-semibold">分数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {candidates.map((candidate) => (
                <tr className="cursor-pointer hover:bg-stone-50" key={candidate.candidate_id} onClick={() => onOpen(candidate)}>
                  <td className="px-4 py-3 font-semibold">{candidate.rank ?? "-"}</td>
                  <td className="max-w-sm px-4 py-3">
                    <div className="truncate font-semibold text-teal">{candidate.subject || "-"}</div>
                    <div className="mt-1 truncate text-xs text-stone-500">row {candidate.excel_row ?? "-"}</div>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-stone-600">{candidate.award_name || "-"}</td>
                  <td className="px-4 py-3 text-stone-600">{candidate.workflow_status || candidate.recommendation_status || "-"}</td>
                  <td className="px-4 py-3 text-stone-600">{candidate.internal_score ?? candidate.normal_review_score ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loadingDetail ? <div className="border-t border-line px-4 py-3 text-sm text-stone-500">加载明细</div> : null}
        </div>
      ) : (
        <div className="p-4">
          <EmptyState icon={Table2} title="暂无候选结果" body="任务完成后会写入候选结果。" />
        </div>
      )}
    </section>
  );
}

function EventsPanel({ events }: { events: RunEvent[] }) {
  return (
    <section className="rounded border border-line bg-white shadow-soft">
      <div className="border-b border-line px-4 py-4">
        <h2 className="text-base font-bold">运行日志</h2>
        <p className="text-sm text-stone-500">{events.length} 条事件</p>
      </div>
      {events.length ? (
        <div className="max-h-[620px] divide-y divide-line overflow-auto scrollbar-thin">
          {events.map((event) => (
            <div className="px-4 py-3" key={event.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{event.type}</div>
                  <div className="mt-1 break-words text-sm text-stone-600">{event.message || "-"}</div>
                </div>
                <span className="shrink-0 rounded border border-line bg-panel px-2 py-1 text-xs font-semibold text-stone-600">{event.level}</span>
              </div>
              <div className="mt-2 text-xs text-stone-500">{formatDateTime(event.created_at)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4">
          <EmptyState icon={FileJson} title="暂无事件" body="运行开始后会持续写入事件。" />
        </div>
      )}
    </section>
  );
}

function CandidateDrawer({ candidate, onClose }: { candidate: CandidateDetail; onClose: () => void }) {
  const normalScore = asNumber(candidate.normal_review_score);
  const internalScore = asNumber(candidate.internal_score);

  return (
    <div className="fixed inset-0 z-40 bg-black/30" role="dialog" aria-modal="true">
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-4">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-bold">{candidate.subject || "候选明细"}</h2>
            <p className="mt-1 break-all text-xs text-stone-500">{candidate.candidate_id}</p>
          </div>
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-line bg-white text-stone-700 hover:bg-stone-50"
            onClick={onClose}
            title="关闭"
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3">
          <SummaryMetric label="排序" value={String(candidate.rank ?? "-")} />
          <SummaryMetric label="普通分" value={String(normalScore ?? "-")} />
          <SummaryMetric label="内部分" value={String(internalScore ?? "-")} />
        </div>
        <div className="border-b border-line p-4">
          <div className="mb-2 text-sm font-semibold">排序理由</div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">{candidate.ranking_reason || "-"}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 scrollbar-thin">
          <pre className="rounded bg-ink p-3 text-xs leading-5 text-white">{JSON.stringify(candidate.raw, null, 2)}</pre>
        </div>
      </aside>
    </div>
  );
}

function qaLabel(summaryQa: unknown, qaReport: QaReport | null): string {
  const reportPassed = asBoolean(qaReport?.passed);
  if (reportPassed !== null) {
    return reportPassed ? "通过" : "需复核";
  }
  const summaryPassed = asBoolean(summaryQa);
  if (summaryPassed !== null) {
    return summaryPassed ? "通过" : "需复核";
  }
  return "-";
}
