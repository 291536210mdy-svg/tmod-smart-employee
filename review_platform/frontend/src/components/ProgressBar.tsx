export function ProgressBar({
  current,
  total
}: {
  current: number | null | undefined;
  total: number | null | undefined;
}) {
  const percent = total && total > 0 && current !== null && current !== undefined ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
      <div className="h-full rounded-full bg-teal transition-all duration-300" style={{ width: `${percent}%` }} />
    </div>
  );
}
