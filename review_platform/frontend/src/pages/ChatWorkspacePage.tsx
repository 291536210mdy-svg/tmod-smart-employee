import {
  ArrowUp,
  Bot,
  FileSpreadsheet,
  Paperclip,
  RefreshCcw,
  X
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, createAwardReviewRun, listRuns } from "../api/client";
import type { AwardReviewConfig, Role, Run } from "../api/types";
import { CURRENT_BUSINESS_LINE_ID, getBusinessLineAgentName } from "../businessLineDisplay";
import { StatusBadge, isTerminalStatus } from "../components/StatusBadge";

const LAST_CREATED_RUN_ID_KEY = "review_platform_last_created_run_id";

type ChatWorkspacePageProps = {
  role: Role;
};

export function ChatWorkspacePage({ role }: ChatWorkspacePageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [enableLeadershipPriority, setEnableLeadershipPriority] = useState(true);
  const [runs, setRuns] = useState<Run[]>([]);
  const [createdRunId, setCreatedRunId] = useState(() => sessionStorage.getItem(LAST_CREATED_RUN_ID_KEY) ?? "");
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
      dry_run: false,
      award_filters: [],
      limit: 0,
      timeout: 120,
      sleep: 0.2,
      enable_leadership_priority: enableLeadershipPriority
    };

    setSubmitting(true);
    setError("");
    try {
      const response = await createAwardReviewRun({
        title: message.trim() || `全奖项评优 - ${file.name}`,
        file,
        config
      });
      setCreatedRunId(response.run_id);
      sessionStorage.setItem(LAST_CREATED_RUN_ID_KEY, response.run_id);
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
              <p className="max-w-[620px] text-[15px] font-semibold leading-7 text-[#2c2c2c]">
                你好，我可以开始评优。源数据准备好后，交给下方输入框即可。
              </p>
            </div>
          </div>

          {createdRun ? (
            <div className="mt-10 flex justify-end">
              <div className="max-w-[480px] rounded-[20px] border border-line bg-white px-4 py-3 shadow-sm">
                <div className="mb-2 flex justify-start">
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

          {error ? <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              accept=".xlsx"
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
