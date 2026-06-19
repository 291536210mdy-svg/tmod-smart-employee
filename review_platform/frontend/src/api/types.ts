export type Role = "viewer" | "reviewer" | "admin";

export type User = {
  username: string;
  role: Role;
  enabled: boolean;
};

export type AdminUser = User & {
  created_at: string;
};

export type AuthSession = {
  access_token: string;
  token_type: string;
  role: Role;
};

export type BusinessLine = {
  line_id: string;
  name: string;
  description: string;
  input_types: string[];
  run_modes: string[];
  artifacts: string[];
  config_schema: Record<string, unknown>;
  supports_events: boolean;
  supports_result_query: boolean;
  supports_export: boolean;
};

export type RunStatus =
  | "created"
  | "queued"
  | "running"
  | "cancelling"
  | "succeeded"
  | "failed"
  | "cancelled";

export type Run = {
  run_id: string;
  line_id: string;
  status: RunStatus;
  title: string;
  config: Record<string, unknown>;
  input_files: Array<Record<string, unknown>>;
  output_dir: string;
  created_by: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string;
  summary: Record<string, unknown>;
  cancel_requested: boolean;
  archived: boolean;
  archived_at: string | null;
  deleted_at: string | null;
};

export type RunEvent = {
  id: number;
  run_id: string;
  type: string;
  level: string;
  message: string;
  progress: {
    current: number | null;
    total: number | null;
  };
  payload: Record<string, unknown>;
  created_at: string;
};

export type Artifact = {
  artifact_id: string;
  run_id: string;
  artifact_type: string;
  name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type Candidate = {
  candidate_id: string;
  excel_row: number | null;
  award_name: string;
  subject: string;
  rank: number | null;
  recommendation_status: string;
  workflow_status: string;
  normal_review_score: number | null;
  internal_score: number | null;
  manual_review_required: boolean;
  ranking_reason: string;
};

export type CandidateDetail = Candidate & {
  raw: Record<string, unknown>;
};

export type AwardReviewConfig = {
  dry_run: boolean;
  award_filters: string[];
  limit: number;
  timeout: number;
  sleep: number;
  enable_leadership_priority: boolean;
};

export type QaReport = Record<string, unknown>;
