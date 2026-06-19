import type {
  Artifact,
  AuthSession,
  AwardReviewConfig,
  BusinessLine,
  Candidate,
  CandidateDetail,
  QaReport,
  Run,
  RunEvent,
  AdminUser,
  Role,
  User
} from "./types";

const TOKEN_KEY = "review_platform_token";
const ROLE_KEY = "review_platform_role";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function getStoredRole(): AuthSession["role"] | "" {
  return (localStorage.getItem(ROLE_KEY) as AuthSession["role"] | null) ?? "";
}

export function storeSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, session.access_token);
  localStorage.setItem(ROLE_KEY, session.role);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const payload = await response.json();
      message = String(payload.detail ?? message);
    } catch {
      // keep the HTTP status text
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<AuthSession> {
  return apiFetch<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export async function getMe(): Promise<User> {
  return apiFetch<User>("/api/auth/me");
}

export async function listUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>("/api/auth/users");
}

export async function createUser(params: { username: string; password: string; role: Role }): Promise<User> {
  return apiFetch<User>("/api/auth/users", {
    method: "POST",
    body: JSON.stringify(params)
  });
}

export async function updateUser(
  username: string,
  params: { password?: string; role?: Role; enabled?: boolean }
): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/api/auth/users/${encodeURIComponent(username)}`, {
    method: "PATCH",
    body: JSON.stringify(params)
  });
}

export async function getBusinessLines(): Promise<BusinessLine[]> {
  return apiFetch<BusinessLine[]>("/api/business-lines");
}

export async function listRuns(params: { includeArchived?: boolean } = {}): Promise<Run[]> {
  const search = new URLSearchParams();
  if (params.includeArchived) {
    search.set("include_archived", "true");
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<Run[]>(`/api/runs${suffix}`);
}

export async function getRun(runId: string): Promise<Run> {
  return apiFetch<Run>(`/api/runs/${runId}`);
}

export async function cancelRun(runId: string): Promise<Run> {
  return apiFetch<Run>(`/api/runs/${runId}/cancel`, { method: "POST" });
}

export async function archiveRun(runId: string): Promise<Run> {
  return apiFetch<Run>(`/api/runs/${runId}/archive`, { method: "POST" });
}

export async function unarchiveRun(runId: string): Promise<Run> {
  return apiFetch<Run>(`/api/runs/${runId}/unarchive`, { method: "POST" });
}

export async function deleteRun(runId: string): Promise<{ run_id: string; deleted: boolean; files_deleted: boolean }> {
  return apiFetch<{ run_id: string; deleted: boolean; files_deleted: boolean }>(`/api/runs/${runId}`, { method: "DELETE" });
}

export async function cleanupRetention(dryRun = true): Promise<{
  dry_run: boolean;
  archived_count: number;
  candidate_run_ids: string[];
}> {
  return apiFetch(`/api/runs/retention/cleanup?dry_run=${dryRun ? "true" : "false"}`, { method: "POST" });
}

export async function createAwardReviewRun(params: {
  title: string;
  file: File;
  config: AwardReviewConfig;
}): Promise<{ run_id: string; status: string }> {
  const body = new FormData();
  body.set("line_id", "award_review");
  body.set("title", params.title);
  body.set("config", JSON.stringify(params.config));
  body.set("file", params.file);

  return apiFetch<{ run_id: string; status: string }>("/api/runs", {
    method: "POST",
    body
  });
}

export async function getEvents(runId: string, afterId = 0): Promise<RunEvent[]> {
  return apiFetch<RunEvent[]>(`/api/runs/${runId}/events?after_id=${afterId}`);
}

export async function getArtifacts(runId: string): Promise<Artifact[]> {
  return apiFetch<Artifact[]>(`/api/runs/${runId}/artifacts`);
}

export async function downloadArtifact(runId: string, artifact: Artifact): Promise<void> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE}/api/runs/${runId}/artifacts/${artifact.artifact_id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function getCandidates(runId: string): Promise<Candidate[]> {
  return apiFetch<Candidate[]>(`/api/runs/${runId}/candidates`);
}

export async function getCandidate(runId: string, candidateId: string): Promise<CandidateDetail> {
  return apiFetch<CandidateDetail>(`/api/runs/${runId}/candidates/${candidateId}`);
}

export async function getQaReport(runId: string): Promise<QaReport> {
  return apiFetch<QaReport>(`/api/runs/${runId}/qa-report`);
}
