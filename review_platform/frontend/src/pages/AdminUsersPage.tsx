import { RefreshCcw, ShieldCheck, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { ApiError, createUser, listUsers, updateUser } from "../api/client";
import type { AdminUser, Role } from "../api/types";
import { formatDateTime } from "../utils/format";

type AdminUsersPageProps = {
  currentUsername: string;
};

const roles: Role[] = ["viewer", "reviewer", "admin"];

export function AdminUsersPage({ currentUsername }: AdminUsersPageProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("reviewer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "成员加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await createUser({ username: username.trim(), password, role });
      setUsername("");
      setPassword("");
      setRole("reviewer");
      setMessage("成员已创建");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function patchUser(target: AdminUser, params: { password?: string; role?: Role; enabled?: boolean }) {
    setError("");
    setMessage("");
    try {
      await updateUser(target.username, params);
      setMessage("成员已更新");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新失败");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pb-8 pt-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold">成员管理</h1>
        <p className="mt-1 text-sm text-stone-500">管理谁可以查看、提交评优任务，以及维护管理员账号。</p>
      </div>

      {error ? <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      <section className="mb-6 rounded border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <div>
            <h2 className="text-base font-bold">新增成员</h2>
            <p className="text-sm text-stone-500">默认建议给业务同事 reviewer 权限。</p>
          </div>
          <UserPlus className="h-5 w-5 text-teal" aria-hidden="true" />
        </div>
        <form className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_180px_auto]" onSubmit={handleCreate}>
          <input
            className="h-10 rounded border border-line bg-white px-3 text-sm"
            placeholder="账号"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            className="h-10 rounded border border-line bg-white px-3 text-sm"
            placeholder="初始密码"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <select className="h-10 rounded border border-line bg-white px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {roles.map((nextRole) => (
              <option key={nextRole} value={nextRole}>
                {nextRole}
              </option>
            ))}
          </select>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded bg-ink px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving || !username.trim() || password.length < 6}
            type="submit"
          >
            {saving ? <RefreshCcw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
            创建
          </button>
        </form>
      </section>

      <section className="rounded border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <div>
            <h2 className="text-base font-bold">现有成员</h2>
            <p className="text-sm text-stone-500">{loading ? "加载中" : `${users.length} 人`}</p>
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-semibold">成员</th>
                <th className="px-4 py-3 font-semibold">角色</th>
                <th className="px-4 py-3 font-semibold">状态</th>
                <th className="px-4 py-3 font-semibold">创建时间</th>
                <th className="px-4 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((user) => (
                <tr className="hover:bg-stone-50" key={user.username}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold">
                      {user.username}
                      {user.username === currentUsername ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">当前</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="h-9 rounded border border-line bg-white px-2 text-sm"
                      value={user.role}
                      onChange={(event) => void patchUser(user, { role: event.target.value as Role })}
                    >
                      {roles.map((nextRole) => (
                        <option key={nextRole} value={nextRole}>
                          {nextRole}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.enabled ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                      {user.enabled ? "启用" : "停用"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{formatDateTime(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="inline-flex h-9 items-center gap-2 rounded border border-line bg-white px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={user.username === currentUsername && user.enabled}
                        onClick={() => void patchUser(user, { enabled: !user.enabled })}
                        type="button"
                      >
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        {user.enabled ? "停用" : "启用"}
                      </button>
                      <button
                        className="h-9 rounded border border-line bg-white px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                        onClick={() => {
                          const nextPassword = window.prompt(`输入 ${user.username} 的新密码，至少 6 位`);
                          if (nextPassword) {
                            void patchUser(user, { password: nextPassword });
                          }
                        }}
                        type="button"
                      >
                        重置密码
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
