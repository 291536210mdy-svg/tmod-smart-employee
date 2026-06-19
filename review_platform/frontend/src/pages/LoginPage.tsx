import { FormEvent, useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";

import { ApiError, login, storeSession } from "../api/client";
import type { User } from "../api/types";

type LoginPageProps = {
  onLogin: (user: User) => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const session = await login(username.trim(), password);
      storeSession(session);
      onLogin({ username: username.trim(), role: session.role, enabled: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "账号或密码不正确" : err.message);
      } else {
        setError("登录失败");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f1ea] px-4 py-10 text-ink">
      <form className="w-full max-w-sm rounded border border-line bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded bg-ink text-white">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">团队业务智能体平台</h1>
            <p className="truncate text-sm text-stone-500">评优业务线</p>
          </div>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold">账号</span>
          <input
            className="h-11 w-full rounded border border-line bg-white px-3 text-sm"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-1 block text-sm font-semibold">密码</span>
          <input
            className="h-11 w-full rounded border border-line bg-white px-3 text-sm"
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-ink px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting || !username.trim() || !password}
          type="submit"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {submitting ? "登录中" : "登录"}
        </button>
      </form>
    </div>
  );
}
