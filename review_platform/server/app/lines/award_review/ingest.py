import json
from pathlib import Path

from sqlalchemy import delete

from app.db.base import SessionLocal
from app.db.models import CandidateResult


def ingest_internal_pack(run_id: str, internal_pack_path: Path) -> int:
    items = _read_jsonl(internal_pack_path)
    with SessionLocal() as db:
        db.execute(delete(CandidateResult).where(CandidateResult.run_id == run_id))
        for item in items:
            recommendation = item.get("recommendation", {})
            scoring = item.get("scoring", {})
            final_fields = item.get("final_result_fields", {})
            raw_row = item.get("raw_row", {})
            db.add(
                CandidateResult(
                    run_id=run_id,
                    candidate_id=item.get("candidate_id", ""),
                    excel_row=_to_int(item.get("excel_row")),
                    award_name=item.get("award_name", ""),
                    subject=final_fields.get("主体") or raw_row.get("申报主体", ""),
                    rank=_to_int(recommendation.get("rank")),
                    recommendation_status=recommendation.get("status", ""),
                    workflow_status=item.get("workflow_status", ""),
                    normal_review_score=_to_float(scoring.get("normal_review_score")),
                    internal_score=_to_float(scoring.get("internal_score")),
                    manual_review_required=bool(recommendation.get("manual_review_required", False)),
                    ranking_reason=recommendation.get("ranking_reason", ""),
                    raw_json=json.dumps(item, ensure_ascii=False),
                )
            )
        db.commit()
    return len(items)


def _read_jsonl(path: Path) -> list[dict]:
    items: list[dict] = []
    with Path(path).open(encoding="utf-8") as file:
        for line in file:
            text = line.strip()
            if text:
                items.append(json.loads(text))
    return items


def _to_int(value):
    try:
        if value in ("", None):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_float(value):
    try:
        if value in ("", None):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None

