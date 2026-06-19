import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { clearSession, getMe, getStoredRole, getStoredToken } from "./api/client";
import type { User } from "./api/types";
import { Shell } from "./components/Shell";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { ChatWorkspacePage } from "./pages/ChatWorkspacePage";
import { LinesPage } from "./pages/LinesPage";
import { LoginPage } from "./pages/LoginPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { RunsPage } from "./pages/RunsPage";

export default function App() {
  const navigate = useNavigate();
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState<User | null>(() => {
    const role = getStoredRole();
    return token && role ? { username: "user", role, enabled: true } : null;
  });
  const [loadingUser, setLoadingUser] = useState(Boolean(token));

  const refreshUser = useCallback(async () => {
    if (!getStoredToken()) {
      setLoadingUser(false);
      return;
    }
    setLoadingUser(true);
    try {
      setUser(await getMe());
      setToken(getStoredToken());
    } catch {
      clearSession();
      setUser(null);
      setToken("");
      navigate("/login", { replace: true });
    } finally {
      setLoadingUser(false);
    }
  }, [navigate]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  function handleLogin(nextUser: User) {
    setToken(getStoredToken());
    setUser(nextUser);
    navigate("/", { replace: true });
    void refreshUser();
  }

  function handleLogout() {
    clearSession();
    setToken("");
    setUser(null);
    navigate("/login", { replace: true });
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (loadingUser && !user) {
    return <div className="grid min-h-screen place-items-center bg-[#f4f1ea] text-sm text-stone-600">加载中</div>;
  }

  const activeUser = user ?? { username: "user", role: getStoredRole() || "viewer", enabled: true };

  return (
    <Routes>
      <Route element={<Shell user={activeUser} onLogout={handleLogout} onRefreshUser={refreshUser} />}>
        <Route index element={<ChatWorkspacePage role={activeUser.role} />} />
        <Route path="/lines" element={<LinesPage />} />
        <Route path="/runs" element={<RunsPage role={activeUser.role} />} />
        <Route path="/runs/:runId" element={<RunDetailPage role={activeUser.role} token={token} />} />
        <Route
          path="/admin/users"
          element={activeUser.role === "admin" ? <AdminUsersPage currentUsername={activeUser.username} /> : <Navigate to="/" replace />}
        />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
