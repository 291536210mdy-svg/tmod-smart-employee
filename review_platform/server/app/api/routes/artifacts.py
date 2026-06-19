from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from urllib.parse import quote

from app.api.deps import get_run_manager, require_role
from app.api.schemas import ArtifactResponse
from app.api.serializers import artifact_to_response
from app.db.base import get_db
from app.db.models import Artifact, Run, User
from app.platform.run_manager import RunManager


router = APIRouter(prefix="/runs/{run_id}/artifacts", tags=["artifacts"])


@router.get("", response_model=list[ArtifactResponse])
def list_artifacts(
    run_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("reviewer")),
) -> list[ArtifactResponse]:
    _ensure_run_exists(db, run_id)
    artifacts = db.scalars(select(Artifact).where(Artifact.run_id == run_id).order_by(Artifact.id)).all()
    return [artifact_to_response(artifact) for artifact in artifacts]


@router.get("/{artifact_id}/download")
def download_artifact(
    run_id: str,
    artifact_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("reviewer")),
    manager: RunManager = Depends(get_run_manager),
) -> Response:
    _ensure_run_exists(db, run_id)
    artifact = db.scalar(select(Artifact).where(Artifact.run_id == run_id, Artifact.artifact_id == artifact_id))
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    if manager.artifact_store.is_remote(artifact):
        response = manager.artifact_store.open_remote_object(artifact)
        headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(artifact.name)}"}
        return StreamingResponse(response["Body"].iter_chunks(), media_type=artifact.content_type, headers=headers)
    path = manager.artifact_store.resolve_path(artifact)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact file missing")
    return FileResponse(path, media_type=artifact.content_type, filename=artifact.name)


def _ensure_run_exists(db: Session, run_id: str) -> None:
    if not db.scalar(select(Run.id).where(Run.run_id == run_id, Run.deleted_at.is_(None))):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
