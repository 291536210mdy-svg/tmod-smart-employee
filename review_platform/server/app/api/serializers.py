import json

from app.api.schemas import (
    ArtifactResponse,
    BusinessLineResponse,
    CandidateDetailResponse,
    CandidateResponse,
    RunEventResponse,
    RunResponse,
)
from app.db.models import Artifact, CandidateResult, Run, RunEvent
from app.platform.business_line import BusinessLineManifest


def _loads(text: str, default):
    try:
        return json.loads(text or "")
    except json.JSONDecodeError:
        return default


def business_line_to_response(manifest: BusinessLineManifest) -> BusinessLineResponse:
    return BusinessLineResponse(
        line_id=manifest.line_id,
        name=manifest.name,
        description=manifest.description,
        input_types=manifest.input_types,
        run_modes=manifest.run_modes,
        artifacts=manifest.artifacts,
        config_schema=manifest.config_schema,
        supports_events=manifest.supports_events,
        supports_result_query=manifest.supports_result_query,
        supports_export=manifest.supports_export,
    )


def run_to_response(run: Run) -> RunResponse:
    return RunResponse(
        run_id=run.run_id,
        line_id=run.line_id,
        status=run.status,
        title=run.title,
        config=_loads(run.config_json, {}),
        input_files=_loads(run.input_files_json, []),
        output_dir=run.output_dir,
        created_by=run.created_by,
        created_at=run.created_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
        error_message=run.error_message,
        summary=_loads(run.summary_json, {}),
        cancel_requested=run.cancel_requested,
    )


def event_to_response(event: RunEvent) -> RunEventResponse:
    return RunEventResponse(
        id=event.id,
        run_id=event.run_id,
        type=event.event_type,
        level=event.level,
        message=event.message,
        progress={"current": event.progress_current, "total": event.progress_total},
        payload=_loads(event.payload_json, {}),
        created_at=event.created_at,
    )


def artifact_to_response(artifact: Artifact) -> ArtifactResponse:
    return ArtifactResponse(
        artifact_id=artifact.artifact_id,
        run_id=artifact.run_id,
        artifact_type=artifact.artifact_type,
        name=artifact.name,
        content_type=artifact.content_type,
        size_bytes=artifact.size_bytes,
        created_at=artifact.created_at,
        metadata=_loads(artifact.metadata_json, {}),
    )


def candidate_to_response(candidate: CandidateResult) -> CandidateResponse:
    return CandidateResponse(
        candidate_id=candidate.candidate_id,
        excel_row=candidate.excel_row,
        award_name=candidate.award_name,
        subject=candidate.subject,
        rank=candidate.rank,
        recommendation_status=candidate.recommendation_status,
        workflow_status=candidate.workflow_status,
        normal_review_score=candidate.normal_review_score,
        internal_score=candidate.internal_score,
        manual_review_required=candidate.manual_review_required,
        ranking_reason=candidate.ranking_reason,
    )


def candidate_to_detail_response(candidate: CandidateResult) -> CandidateDetailResponse:
    base = candidate_to_response(candidate).model_dump()
    return CandidateDetailResponse(**base, raw=_loads(candidate.raw_json, {}))

