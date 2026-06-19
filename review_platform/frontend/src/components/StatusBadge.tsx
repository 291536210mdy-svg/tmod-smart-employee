import type { RunStatus } from "../api/types";

const statusStyles: Record<RunStatus, string> = {
  created: "border-slate-300 bg-slate-50 text-slate-700",
  queued: "border-amber-300 bg-amber-50 text-amber-800",
  running: "border-teal-300 bg-teal-50 text-teal-800",
  cancelling: "border-orange-300 bg-orange-50 text-orange-800",
  succeeded: "border-emerald-300 bg-emerald-50 text-emerald-800",
  failed: "border-red-300 bg-red-50 text-red-800",
  cancelled: "border-zinc-300 bg-zinc-50 text-zinc-700"
};

const statusLabels: Record<RunStatus, string> = {
  created: "已创建",
  queued: "排队中",
  running: "运行中",
  cancelling: "取消中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消"
};

export function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function isTerminalStatus(status: RunStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}
