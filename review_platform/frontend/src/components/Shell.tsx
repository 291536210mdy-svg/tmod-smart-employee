import {
  Clock3,
  FolderOpen,
  HelpCircle,
  LogOut,
  MessageSquarePlus,
  MoreHorizontal,
  Search,
  UserRound,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { ApiError, listRuns } from "../api/client";
import type { Run, User } from "../api/types";
import { PLATFORM_DISPLAY_NAME } from "../businessLineDisplay";
import { StatusBadge } from "./StatusBadge";

type ShellProps = {
  user: User;
  onLogout: () => void;
  onRefreshUser: () => void;
};

type RailPanel = "search" | "profile" | "more" | null;

const railButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-full transition-colors touch-manipulation";

export function Shell({ user, onLogout, onRefreshUser }: ShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [panel, setPanel] = useState<RailPanel>(null);
  const [query, setQuery] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [panelError, setPanelError] = useState("");

  useEffect(() => {
    if (panel !== "search") {
      return;
    }
    let cancelled = false;
    async function loadRuns() {
      setPanelError("");
      try {
        const nextRuns = await listRuns();
        if (!cancelled) {
          setRuns(nextRuns);
        }
      } catch (err) {
        if (!cancelled) {
          setPanelError(err instanceof ApiError ? err.message : "任务加载失败");
        }
      }
    }
    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [panel]);

  const filteredRuns = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return runs.slice(0, 6);
    }
    return runs
      .filter((run) => `${run.title} ${run.run_id} ${run.status}`.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [query, runs]);

  function openPanel(nextPanel: RailPanel) {
    setPanel((current) => (current === nextPanel ? null : nextPanel));
  }

  function goHome() {
    setPanel(null);
    navigate("/");
    window.dispatchEvent(new CustomEvent("review-platform:new-task"));
  }

  function goTo(path: string) {
    setPanel(null);
    navigate(path);
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-ink">
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[52px] select-none flex-col items-center border-r border-[#e5e2dc] bg-[#fbfaf7]">
        <div className="flex h-14 items-center justify-center">
          <button
            className={`${railButtonClass} bg-[#fff3d8] text-sm font-bold text-coral hover:bg-[#ffe9bd]`}
            onClick={goHome}
            title="新建评优"
            type="button"
          >
            评
          </button>
        </div>

        <nav className="mt-3 flex flex-1 flex-col items-center gap-2">
          <RailButton active={location.pathname === "/"} icon={MessageSquarePlus} label="新建评优" onClick={goHome} />
          <RailButton active={panel === "search"} icon={Search} label="搜索任务" onClick={() => openPanel("search")} />
          <RailButton active={panel === "profile"} icon={UserRound} label="账号" onClick={() => openPanel("profile")} />
          <RailButton active={location.pathname === "/lines"} icon={FolderOpen} label="业务线" onClick={() => goTo("/lines")} />
          <RailButton active={location.pathname.startsWith("/runs")} icon={Clock3} label="运行记录" onClick={() => goTo("/runs")} />
          <RailButton active={panel === "more"} icon={MoreHorizontal} label="更多" onClick={() => openPanel("more")} />
        </nav>

        <button
          className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f6a11a] text-sm font-bold text-white shadow-sm hover:bg-[#e79211]"
          onClick={() => openPanel("profile")}
          title="账号"
          type="button"
        >
          {user.username.slice(0, 1).toUpperCase()}
        </button>
      </aside>

      {panel ? (
        <aside className="fixed bottom-3 left-[64px] top-3 z-40 w-[320px] overflow-hidden rounded-2xl border border-[#e5e2dc] bg-white shadow-[0_18px_50px_rgba(29,36,51,0.12)]">
          <div className="flex h-12 items-center justify-between border-b border-line px-4">
            <div className="text-sm font-bold">{panelTitle(panel)}</div>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-ink"
              onClick={() => setPanel(null)}
              title="关闭"
              type="button"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {panel === "search" ? (
            <div className="flex h-[calc(100%-48px)] flex-col p-3">
              <input
                className="h-10 rounded-full border border-line bg-[#f7f7f5] px-4 text-sm outline-none"
                placeholder="搜索任务名称"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {panelError ? <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{panelError}</div> : null}
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto scrollbar-thin">
                {filteredRuns.map((run) => (
                  <button
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-left hover:bg-stone-50"
                    key={run.run_id}
                    onClick={() => goTo(`/runs/${run.run_id}`)}
                    type="button"
                  >
                    <div className="mb-2 truncate text-sm font-bold">{run.title || run.run_id}</div>
                    <StatusBadge status={run.status} />
                  </button>
                ))}
                {!filteredRuns.length ? <div className="px-2 py-8 text-center text-sm text-stone-500">暂无任务</div> : null}
              </div>
            </div>
          ) : null}

          {panel === "profile" ? (
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f6a11a] text-base font-bold text-white">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{user.username}</div>
                  <div className="truncate text-xs text-stone-500">{user.role}</div>
                </div>
              </div>
              <button className="h-10 w-full rounded-full border border-line bg-[#f7f7f5] text-sm font-semibold hover:bg-stone-100" onClick={onRefreshUser} type="button">
                刷新身份
              </button>
              <button className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white hover:bg-stone-800" onClick={onLogout} type="button">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                退出登录
              </button>
            </div>
          ) : null}

          {panel === "more" ? (
            <div className="space-y-2 p-3">
              <PanelAction icon={MessageSquarePlus} label="新建评优" onClick={goHome} />
              <PanelAction icon={Clock3} label="查看运行记录" onClick={() => goTo("/runs")} />
              <PanelAction icon={FolderOpen} label="查看业务线" onClick={() => goTo("/lines")} />
              <PanelAction icon={HelpCircle} label="帮助" onClick={() => setPanel(null)} />
            </div>
          ) : null}
        </aside>
      ) : null}

      <header className="pointer-events-none fixed left-[92px] right-6 top-6 z-30 flex items-start justify-between">
        <button
          className="pointer-events-auto rounded px-1 py-0.5 text-left hover:bg-stone-100"
          onClick={goHome}
          title="新建评优"
          type="button"
        >
          <div className="text-lg font-bold leading-6 text-[#2c2c2c]">{PLATFORM_DISPLAY_NAME}</div>
          <div className="text-xs text-stone-400">{user.username} · {user.role}</div>
        </button>
        <button
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-ink"
          onClick={() => openPanel("more")}
          title="更多"
          type="button"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <main className="ml-[52px] min-h-screen">
        <Outlet />
      </main>

      <button
        className="fixed bottom-5 right-5 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-stone-500 shadow-sm hover:bg-stone-50"
        title="帮助"
        type="button"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function RailButton({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`${railButtonClass} ${
        active ? "bg-stone-100 text-ink shadow-sm" : "text-stone-500 hover:bg-stone-100 hover:text-ink"
      }`}
      onClick={onClick}
      title={label}
      type="button"
      aria-label={label}
      aria-pressed={active}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  );
}

function PanelAction({
  icon: Icon,
  label,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-stone-100"
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4 text-stone-500" aria-hidden="true" />
      {label}
    </button>
  );
}

function panelTitle(panel: Exclude<RailPanel, null>): string {
  if (panel === "search") {
    return "搜索任务";
  }
  if (panel === "profile") {
    return "账号";
  }
  return "更多";
}
