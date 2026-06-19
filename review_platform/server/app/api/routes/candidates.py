import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_run_manager, require_role
from app.api.schemas import CandidateDetailResponse, CandidateResponse
from app.api.serializers import candidate_to_detail_response, candidate_to_response
from app.db.base import get_db
from app.db.models import Artifact, CandidateResult, Run, User
from app.platform.run_manager import RunManager


router = APIRouter(prefix="/runs/{run_id}", tags=["candidates"])


@router.get("/candidates", response_model=list[CandidateResponse])
def list_candidates(
    run_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("reviewer")),
) -> list[CandidateResponse]:
    _ensure_run_exists(db, run_id)
    stmt = select(CandidateResult).where(CandidateResult.run_id == run_id).order_by(
        CandidateResult.award_name,
        CandidateResult.rank,
        CandidateResult.id,
    )
    return [candidate_to_response(candidate) for candidate in db.scalars(stmt).all()]


@router.get("/candidates/{candidate_id}", response_model=CandidateDetailResponse)
def get_candidate(
    run_id: str,
    candidate_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("reviewer")),
) -> CandidateDetailResponse:
    _ensure_run_exists(db, run_id)
    candidate = db.scalar(
        select(CandidateResult).where(
            CandidateResult.run_id == run_id,
            CandidateResult.candidate_id == candidate_id,
        )
    )
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate_to_detail_response(candidate)


@router.get("/qa-report")
def get_qa_report(
    run_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("reviewer")),
    manager: RunManager = Depends(get_run_manager),
):
    _ensure_run_exists(db, run_id)
    artifact = db.scalar(
        select(Artifact).where(Artifact.run_id == run_id, Artifact.artifact_type == "qa_report").order_by(Artifact.id.desc())
    )
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QA report not found")
    try:
        return json.loads(manager.artifact_store.read_text(artifact))
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QA report file missing")


def _ensure_run_exists(db: Session, run_id: str) -> None:
    if not db.scalar(select(Run.id).where(Run.run_id == run_id, Run.deleted_at.is_(None))):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
