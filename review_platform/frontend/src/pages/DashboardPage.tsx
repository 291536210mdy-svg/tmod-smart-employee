import { FileSpreadsheet, Play, UploadCloud } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, createAwardReviewRun, getBusinessLines } from "../api/client";
import type { AwardReviewConfig, BusinessLine, Role } from "../api/types";
import { EmptyState } from "../components/EmptyState";
import { RunsPage } from "./RunsPage";

const awardOptions = [
  "全球业务突破奖 Global Business Breakthrough Award",
  "AI价值领航奖 AI Value Navigator Award",
  "企业经营乘长奖 Corporate Transformational Growth Award"
];

type DashboardPageProps = {
  role: Role;
};

export function DashboardPage({ role }: DashboardPageProps) {
  const navigate = useNavigate();
  const [lines, setLines] = useState<BusinessLine[]>([]);
  const [lineError, setLineError] = useState("");
  const [title, setTitle] = useState("");
  const [awardText, setAwardText] = useState(awardOptions[0]);
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [enableLeadershipPriority, setEnableLeadershipPriority] = useState(true);
  const [limit, setLimit] = useState(0);
  const [timeout, setTimeoutValue] = useState(120);
  const [sleep, setSleep] = useState(0.2);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    async function loadLines() {
      try {
        setLines(await getBusinessLines());
      } catch (err) {
        setLineError(err instanceof ApiError ? err.message : "业务线加载失败");
      }
    }
    void loadLines();
  }, []);

  const awardReviewLine = lines.find((line) => line.line_id === "award_review");
  const awardFilters = useMemo(() => parseAwardFilters(awardText), [awardText]);
  const canCreate = role === "reviewer" || role === "admin";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setSubmitError("请选择 Excel 文件");
      return;
    }

    const config: AwardReviewConfig = {
      dry_run: dryRun,
      award_filters: awardFilters,
      limit: Number(limit) || 0,
      timeout: Number(timeout) || 120,
      sleep: Number(sleep) || 0,
      enable_leadership_priority: enableLeadershipPriority
    };

    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await createAwardReviewRun({
        title: title.trim() || makeDefaultTitle(file.name, awardFilters),
        file,
        config
      });
      navigate(`/runs/${response.run_id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "任务提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
      <div className="space-y-6">
        <section className="rounded border border-line bg-white shadow-soft">
          <div className="border-b border-line px-4 py-4">
            <h1 className="text-lg font-bold">评优工作台</h1>
            <p className="text-sm text-stone-500">{awardReviewLine ? awardReviewLine.name : "award_review"}</p>
          </div>
          {lineError ? <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{lineError}</div> : null}
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Metric label="运行模式" value={awardReviewLine?.run_modes.join(" / ") ?? "-"} />
            <Metric label="产物类型" value={String(awardReviewLine?.artifacts.length ?? 0)} />
            <Metric label="结果查询" value={awardReviewLine?.supports_result_query ? "已接入" : "-"} />
          </div>
        </section>

        <RunsPage compact />
      </div>

      <section className="rounded border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-4">
          <h2 className="text-base font-bold">新建评优任务</h2>
          <p className="text-sm text-stone-500">源数据 Excel</p>
        </div>

        {!canCreate ? (
          <div className="p-4">
            <EmptyState icon={FileSpreadsheet} title="当前角色不可提交任务" body="viewer 可以查看运行记录，reviewer 和 admin 可以提交评优任务。" />
          </div>
        ) : (
          <form className="space-y-4 p-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">任务标题</span>
              <input
                className="h-10 w-full rounded border border-line bg-white px-3 text-sm"
                placeholder="例如：2026 六月评优 dry-run"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold">奖项筛选</span>
              <textarea
                className="min-h-24 w-full resize-y rounded border border-line bg-white px-3 py-2 text-sm"
                value={awardText}
                onChange={(event) => setAwardText(event.target.value)}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {awardOptions.map((award) => (
                <button
                  className="rounded border border-line bg-panel px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                  key={award}
                  onClick={() => setAwardText(award)}
                  type="button"
                >
                  {shortAwardName(award)}
                </button>
              ))}
              <button
                className="rounded border border-line bg-panel px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                onClick={() => setAwardText("")}
                type="button"
              >
                全部
              </button>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Excel 文件</span>
              <span className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-line bg-panel px-4 py-5 text-center hover:bg-stone-100">
                <UploadCloud className="mb-2 h-7 w-7 text-stone-500" aria-hidden="true" />
                <span className="max-w-full truncate text-sm font-semibold">{file ? file.name : "选择 .xlsx 文件"}</span>
                <input
                  accept=".xlsx,.xls"
                  className="sr-only"
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField label="limit" min={0} step={1} value={limit} onChange={setLimit} />
              <NumberField label="timeout" min={1} step={1} value={timeout} onChange={setTimeoutValue} />
              <NumberField label="sleep" min={0} step={0.1} value={sleep} onChange={setSleep} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle label="dry-run" checked={dryRun} onChange={setDryRun} />
              <Toggle label="领导优先级" checked={enableLeadershipPriority} onChange={setEnableLeadershipPriority} />
            </div>

            {submitError ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div> : null}

            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || !file}
              type="submit"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {submitting ? "提交中" : "提交任务"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-panel px-3 py-3">
      <div className="text-xs font-semibold text-stone-500">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-ink">{value}</div>
    </div>
  );
}

function NumberField({
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
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        className="h-10 w-full rounded border border-line bg-white px-3 text-sm"
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-11 cursor-pointer items-center justify-between gap-3 rounded border border-line bg-panel px-3">
      <span className="text-sm font-semibold">{label}</span>
      <input className="h-5 w-5 accent-teal" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function parseAwardFilters(text: string): string[] {
  return text
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeDefaultTitle(fileName: string, filters: string[]): string {
  const award = filters.length === 1 ? shortAwardName(filters[0]) : "全部奖项";
  return `${award} - ${fileName}`;
}

function shortAwardName(award: string): string {
  return award.split(" Award")[0].replace(/\s+[A-Z].*$/, "").trim() || award;
}
