import {
  ArrowUp,
  Bot,
  CheckCircle2,
  FileSpreadsheet,
  Paperclip,
  RefreshCcw,
  Settings2,
  X
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, createAwardReviewRun, listRuns } from "../api/client";
import type { AwardReviewConfig, Role, Run } from "../api/types";
import { CURRENT_BUSINESS_LINE_ID, getBusinessLineAgentName } from "../businessLineDisplay";
import { StatusBadge, isTerminalStatus } from "../components/StatusBadge";

const awardOptions = [
  "全球业务突破奖 Global Business Breakthrough Award",
  "AI价值领航奖 AI Value Navigator Award",
  "企业经营乘长奖 Corporate Transformational Growth Award"
];

type ChatWorkspacePageProps = {
  role: Role;
};

export function ChatWorkspacePage({ role }: ChatWorkspacePageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [message, setMessage] = useState("");
  const [selectedAward, setSelectedAward] = useState(awardOptions[0]);
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [enableLeadershipPriority, setEnableLeadershipPriority] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [limit, setLimit] = useState(0);
  const [timeout, setTimeoutValue] = useState(120);
  const [sleep, setSleep] = useState(0.2);
  const [runs, setRuns] = useState<Run[]>([]);
  const [createdRunId, setCreatedRunId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const canCreate = role === "reviewer" || role === "admin";

  async function refreshRuns() {
    try {
      setRuns(await listRuns());
    } catch {
      // The chat shell can still be used even if the recent list is temporarily unavailable.
    }
  }

  useEffect(() => {
    void refreshRuns();
  }, []);

  useEffect(() => {
    function handleNewTask() {
      setCreatedRunId("");
      setError("");
      window.setTimeout(() => messageInputRef.current?.focus(), 0);
    }
    window.addEventListener("review-platform:new-task", handleNewTask);
    return () => window.removeEventListener("review-platform:new-task", handleNewTask);
  }, []);

  useEffect(() => {
    const hasActiveRun = runs.some((run) => !isTerminalStatus(run.status));
    if (!hasActiveRun && !createdRunId) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshRuns();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [createdRunId, runs]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) {
      setError("当前账号不可提交任务");
      return;
    }
    if (!file) {
      setError("请先选择源数据 Excel");
      return;
    }

    const config: AwardReviewConfig = {
      dry_run: dryRun,
      award_filters: selectedAward ? [selectedAward] : [],
      limit: Number(limit) || 0,
      timeout: Number(timeout) || 120,
      sleep: Number(sleep) || 0,
      enable_leadership_priority: enableLeadershipPriority
    };

    setSubmitting(true);
    setError("");
    try {
      const response = await createAwardReviewRun({
        title: message.trim() || `${shortAwardName(selectedAward)} - ${file.name}`,
        file,
        config
      });
      setCreatedRunId(response.run_id);
      setMessage("");
      await refreshRuns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "任务提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  const createdRun = runs.find((run) => run.run_id === createdRunId);
  const agentName = getBusinessLineAgentName(CURRENT_BUSINESS_LINE_ID);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f7f5]">
      <div className="mx-auto flex min-h-screen max-w-[980px] flex-col px-6 pb-[180px] pt-[210px]">
        <div className="max-w-[720px]">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff3d8] text-coral">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="mb-3 text-lg font-bold">{agentName}</div>
              <div className="mb-3 flex flex-wrap gap-2">
                <StatusPill active label="评优就绪" />
                <StatusPill active={dryRun} label={dryRun ? "dry-run 已开启" : "正式运行"} />
              </div>
              <p className="max-w-[620px] text-[15px] font-semibold leading-7 text-[#2c2c2c]">
                你好，我可以开始评优。源数据准备好后，交给下方输入框即可。
              </p>
            </div>
          </div>

          {createdRun ? (
            <div className="mt-10 flex justify-end">
              <div className="max-w-[480px] rounded-[20px] border border-line bg-white px-4 py-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-bold">{createdRun.title}</span>
                  <StatusBadge status={createdRun.status} />
                </div>
                <div className="text-sm leading-6 text-stone-600">
                  已提交。处理量 {String(createdRun.summary.processed_rows ?? createdRun.summary.candidate_results ?? "-")}。
                </div>
                <Link className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal hover:underline" to={`/runs/${createdRun.run_id}`}>
                  打开运行详情
                  <ArrowUp className="h-4 w-4 rotate-45" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="fixed bottom-3 left-[52px] right-0 z-30 mx-auto max-w-[1050px] px-6"
        onSubmit={handleSubmit}
      >
        <div className="rounded-[24px] border border-[#e5e2dc] bg-white px-4 py-4 shadow-[0_12px_36px_rgba(29,36,51,0.10)]">
          <textarea
            ref={messageInputRef}
            className="min-h-[48px] w-full resize-none border-0 bg-transparent text-sm leading-6 outline-none placeholder:text-stone-400"
            disabled={!canCreate}
            placeholder={canCreate ? "输入评优需求..." : "当前角色只能查看运行结果..."}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />

          {showSettings ? (
            <div className="mb-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
              <CompactNumber label="limit" min={0} step={1} value={limit} onChange={setLimit} />
              <CompactNumber label="timeout" min={1} step={1} value={timeout} onChange={setTimeoutValue} />
              <CompactNumber label="sleep" min={0} step={0.1} value={sleep} onChange={setSleep} />
            </div>
          ) : null}

          {error ? <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              accept=".xlsx,.xls"
              className="sr-only"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-ink"
              disabled={!canCreate}
              onClick={() => fileInputRef.current?.click()}
              title="上传 Excel"
              type="button"
            >
              <Paperclip className="h-5 w-5" aria-hidden="true" />
            </button>
            <FileChip file={file} onClear={() => setFile(null)} />

            <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-line bg-[#f7f7f5] px-3 py-2 text-sm font-semibold text-stone-700">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
              <select
                className="min-w-0 flex-1 bg-transparent outline-none"
                disabled={!canCreate}
                value={selectedAward}
                onChange={(event) => setSelectedAward(event.target.value)}
              >
                {awardOptions.map((award) => (
                  <option key={award} value={award}>
                    {shortAwardName(award)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-[#f7f7f5] px-3 text-sm font-semibold text-stone-700">
              <input className="h-4 w-4 accent-teal" checked={dryRun} disabled={!canCreate} onChange={(event) => setDryRun(event.target.checked)} type="checkbox" />
              dry-run
            </label>
            <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-[#f7f7f5] px-3 text-sm font-semibold text-stone-700">
              <input
                className="h-4 w-4 accent-teal"
                checked={enableLeadershipPriority}
                disabled={!canCreate}
                onChange={(event) => setEnableLeadershipPriority(event.target.checked)}
                type="checkbox"
              />
              优先级
            </label>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-ink"
              disabled={!canCreate}
              onClick={() => setShowSettings((value) => !value)}
              title="参数"
              type="button"
            >
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-stone-500 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canCreate || submitting || !file}
              title="发送"
              type="submit"
            >
              {submitting ? <RefreshCcw className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
        active ? "bg-[#dff8ed] text-teal" : "bg-stone-100 text-stone-500"
      }`}
    >
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function FileChip({ file, onClear }: { file: File | null; onClear: () => void }) {
  if (!file) {
    return null;
  }
  return (
    <span className="flex h-10 max-w-[220px] items-center gap-2 rounded-full border border-line bg-[#f7f7f5] px-3 text-sm font-semibold text-stone-700">
      <FileSpreadsheet className="h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
      <span className="truncate">{file.name}</span>
      <button className="shrink-0 text-stone-400 hover:text-ink" onClick={onClear} title="移除文件" type="button">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  );
}

function CompactNumber({
  label,
  value,
  min,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-stone-500">{label}</span>
      <input
        className="h-9 w-full rounded border border-line bg-white px-3 text-sm"
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function shortAwardName(award: string): string {
  return award.split(" Award")[0].replace(/\s+[A-Z].*$/, "").trim() || award;
}
