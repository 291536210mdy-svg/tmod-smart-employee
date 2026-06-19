"""Initial platform schema.

Revision ID: 20260619_0001
Revises:
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa


revision = "20260619_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "business_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("line_id", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_business_lines_line_id", "business_lines", ["line_id"], unique=True)

    op.create_table(
        "runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.String(length=120), nullable=False),
        sa.Column("line_id", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("config_json", sa.Text(), nullable=False),
        sa.Column("input_files_json", sa.Text(), nullable=False),
        sa.Column("output_dir", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.Column("summary_json", sa.Text(), nullable=False),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_runs_archived", "runs", ["archived"])
    op.create_index("ix_runs_deleted_at", "runs", ["deleted_at"])
    op.create_index("ix_runs_line_id", "runs", ["line_id"])
    op.create_index("ix_runs_run_id", "runs", ["run_id"], unique=True)
    op.create_index("ix_runs_status", "runs", ["status"])

    op.create_table(
        "run_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.String(length=120), nullable=False),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("level", sa.String(length=30), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("progress_current", sa.Integer(), nullable=True),
        sa.Column("progress_total", sa.Integer(), nullable=True),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_run_events_event_type", "run_events", ["event_type"])
    op.create_index("ix_run_events_run_id", "run_events", ["run_id"])

    op.create_table(
        "artifacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("artifact_id", sa.String(length=120), nullable=False),
        sa.Column("run_id", sa.String(length=120), nullable=False),
        sa.Column("artifact_type", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False),
    )
    op.create_index("ix_artifacts_artifact_id", "artifacts", ["artifact_id"], unique=True)
    op.create_index("ix_artifacts_artifact_type", "artifacts", ["artifact_type"])
    op.create_index("ix_artifacts_run_id", "artifacts", ["run_id"])

    op.create_table(
        "candidate_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.String(length=120), nullable=False),
        sa.Column("candidate_id", sa.String(length=120), nullable=False),
        sa.Column("excel_row", sa.Integer(), nullable=True),
        sa.Column("award_name", sa.String(length=255), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("recommendation_status", sa.String(length=80), nullable=False),
        sa.Column("workflow_status", sa.String(length=80), nullable=False),
        sa.Column("normal_review_score", sa.Float(), nullable=True),
        sa.Column("internal_score", sa.Float(), nullable=True),
        sa.Column("manual_review_required", sa.Boolean(), nullable=False),
        sa.Column("ranking_reason", sa.Text(), nullable=False),
        sa.Column("raw_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_candidate_results_award_name", "candidate_results", ["award_name"])
    op.create_index("ix_candidate_results_candidate_id", "candidate_results", ["candidate_id"])
    op.create_index("ix_candidate_results_run_id", "candidate_results", ["run_id"])

    op.create_table(
        "manual_actions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.String(length=120), nullable=False),
        sa.Column("candidate_id", sa.String(length=120), nullable=False),
        sa.Column("action_type", sa.String(length=120), nullable=False),
        sa.Column("before_json", sa.Text(), nullable=False),
        sa.Column("after_json", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("operator", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_manual_actions_candidate_id", "manual_actions", ["candidate_id"])
    op.create_index("ix_manual_actions_run_id", "manual_actions", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_manual_actions_run_id", table_name="manual_actions")
    op.drop_index("ix_manual_actions_candidate_id", table_name="manual_actions")
    op.drop_table("manual_actions")
    op.drop_index("ix_candidate_results_run_id", table_name="candidate_results")
    op.drop_index("ix_candidate_results_candidate_id", table_name="candidate_results")
    op.drop_index("ix_candidate_results_award_name", table_name="candidate_results")
    op.drop_table("candidate_results")
    op.drop_index("ix_artifacts_run_id", table_name="artifacts")
    op.drop_index("ix_artifacts_artifact_type", table_name="artifacts")
    op.drop_index("ix_artifacts_artifact_id", table_name="artifacts")
    op.drop_table("artifacts")
    op.drop_index("ix_run_events_run_id", table_name="run_events")
    op.drop_index("ix_run_events_event_type", table_name="run_events")
    op.drop_table("run_events")
    op.drop_index("ix_runs_status", table_name="runs")
    op.drop_index("ix_runs_run_id", table_name="runs")
    op.drop_index("ix_runs_line_id", table_name="runs")
    op.drop_index("ix_runs_deleted_at", table_name="runs")
    op.drop_index("ix_runs_archived", table_name="runs")
    op.drop_table("runs")
    op.drop_index("ix_business_lines_line_id", table_name="business_lines")
    op.drop_table("business_lines")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
