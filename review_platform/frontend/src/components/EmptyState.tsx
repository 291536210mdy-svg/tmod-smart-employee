import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded border border-dashed border-line bg-white px-4 py-8 text-center">
      <Icon className="mb-3 h-8 w-8 text-stone-400" aria-hidden="true" />
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-1 max-w-md text-sm text-stone-500">{body}</div>
    </div>
  );
}
