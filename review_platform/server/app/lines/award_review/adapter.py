import sys
from pathlib import Path

from app.lines.award_review.ingest import ingest_internal_pack
from app.lines.award_review.schemas import AwardReviewRunConfig
from app.platform.business_line import ArtifactRef, RunContext


def run_award_review(context: RunContext) -> None:
    config = AwardReviewRunConfig(**context.config)
    review_batch_dir = context.settings.resolved_review_batch_dir
    if str(review_batch_dir) not in sys.path:
        sys.path.insert(0, str(review_batch_dir))
    import review_batch as rb

    input_path = context.input_dir / config.input_filename
    if not input_path.exists():
        raise FileNotFoundError(f"award review input file not found: {input_path}")

    dify_base_url = context.settings.dify_base_url or ("http://dry-run.local" if config.dry_run else "")
    batch_config = rb.ReviewBatchConfig(
        input_path=input_path,
        output_dir=context.output_dir,
        template_path=context.settings.project_root / "评选结果输出格式.xlsx",
        award_config_path=context.settings.project_root / "award_config.json",
        enable_leadership_priority=config.enable_leadership_priority,
        award_filters=config.award_filters,
        limit=config.limit,
        sleep=config.sleep,
        timeout=config.timeout,
        dry_run=config.dry_run,
        dify_base_url=dify_base_url,
        dify_review_api_key=context.settings.dify_review_workflow_api_key,
        dify_ranking_reason_api_key=context.settings.dify_ranking_reason_workflow_api_key,
        dify_user=context.settings.dify_user,
    )
    result = rb.run_review_batch(
        batch_config,
        event_sink=_ContextEventSink(context),
        should_cancel=context.should_cancel,
    )

    _add_result_artifacts(context, result)
    ingest_count = ingest_internal_pack(context.run_id, result.internal_pack_path)
    failed_checks = [check["id"] for check in result.qa_report.get("checks", []) if not check.get("passed")]
    context.summary.update(
        {
            "execution_completed": True,
            "qa_passed": result.qa_passed,
            "failed_checks": failed_checks,
            "expected_rows": result.expected_rows,
            "processed_rows": result.processed_rows,
            "award_counts": result.award_counts,
            "candidate_results": ingest_count,
        }
    )


class _ContextEventSink:
    def __init__(self, context: RunContext) -> None:
        self.context = context

    def emit(self, event_type: str, **kwargs) -> None:
        self.context.emit(event_type, **kwargs)


def _add_result_artifacts(context: RunContext, result) -> None:
    artifacts = [
        ArtifactRef(
            artifact_type="review_results_xlsx",
            name=Path(result.xlsx_path).name,
            path=Path(result.xlsx_path),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        ArtifactRef(
            artifact_type="raw_review_jsonl",
            name=Path(result.raw_jsonl_path).name,
            path=Path(result.raw_jsonl_path),
            content_type="application/x-jsonlines",
        ),
        ArtifactRef(
            artifact_type="internal_review_pack",
            name=Path(result.internal_pack_path).name,
            path=Path(result.internal_pack_path),
            content_type="application/x-jsonlines",
        ),
        ArtifactRef(
            artifact_type="completion_xlsx",
            name=Path(result.completion_path).name,
            path=Path(result.completion_path),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        ArtifactRef(
            artifact_type="qa_report",
            name=Path(result.qa_report_path).name,
            path=Path(result.qa_report_path),
            content_type="application/json",
        ),
    ]
    for artifact in artifacts:
        context.add_artifact(artifact)
