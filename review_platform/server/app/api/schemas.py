import datetime as dt
from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    time: dt.datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class UserResponse(BaseModel):
    username: str
    role: str
    enabled: bool


class UserAdminResponse(UserResponse):
    created_at: dt.datetime


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=6)
    role: str = Field(pattern="^(viewer|reviewer|admin)$")


class CreateUserResponse(BaseModel):
    username: str
    role: str
    enabled: bool


class UpdateUserRequest(BaseModel):
    password: str | None = Field(default=None, min_length=6)
    role: str | None = Field(default=None, pattern="^(viewer|reviewer|admin)$")
    enabled: bool | None = None


class BusinessLineResponse(BaseModel):
    line_id: str
    name: str
    description: str
    input_types: list[str]
    run_modes: list[str]
    artifacts: list[str]
    config_schema: dict[str, Any]
    supports_events: bool
    supports_result_query: bool
    supports_export: bool


class RunCreateResponse(BaseModel):
    run_id: str
    status: str


class RunResponse(BaseModel):
    run_id: str
    line_id: str
    status: str
    title: str
    config: dict[str, Any]
    input_files: list[dict[str, Any]]
    output_dir: str
    created_by: str
    created_at: dt.datetime
    started_at: dt.datetime | None = None
    finished_at: dt.datetime | None = None
    error_message: str
    summary: dict[str, Any]
    cancel_requested: bool
    archived: bool
    archived_at: dt.datetime | None = None
    deleted_at: dt.datetime | None = None


class RunDeleteResponse(BaseModel):
    run_id: str
    deleted: bool
    files_deleted: bool


class RetentionCleanupResponse(BaseModel):
    dry_run: bool
    archived_count: int
    candidate_run_ids: list[str]


class RunEventResponse(BaseModel):
    id: int
    run_id: str
    type: str
    level: str
    message: str
    progress: dict[str, int | None]
    payload: dict[str, Any]
    created_at: dt.datetime


class ArtifactResponse(BaseModel):
    artifact_id: str
    run_id: str
    artifact_type: str
    name: str
    content_type: str
    size_bytes: int
    created_at: dt.datetime
    metadata: dict[str, Any]


class CandidateResponse(BaseModel):
    candidate_id: str
    excel_row: int | None
    award_name: str
    subject: str
    rank: int | None
    recommendation_status: str
    workflow_status: str
    normal_review_score: float | None
    internal_score: float | None
    manual_review_required: bool
    ranking_reason: str


class CandidateDetailResponse(CandidateResponse):
    raw: dict[str, Any]
