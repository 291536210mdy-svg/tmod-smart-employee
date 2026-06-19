import json
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.paths import assert_within_data_dir
from app.db.models import Artifact
from app.platform.business_line import ArtifactRef


class ArtifactStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def add(self, db: Session, run_id: str, artifact: ArtifactRef) -> Artifact:
        safe_path = assert_within_data_dir(self.settings, artifact.path)
        row = Artifact(
            artifact_id=f"artifact_{uuid.uuid4().hex[:12]}",
            run_id=run_id,
            artifact_type=artifact.artifact_type,
            name=artifact.name,
            file_path=str(safe_path),
            content_type=artifact.content_type,
            size_bytes=safe_path.stat().st_size if safe_path.exists() else 0,
            metadata_json=json.dumps(artifact.metadata, ensure_ascii=False),
        )
        db.add(row)
        db.flush()
        return row

    def list_for_run(self, db: Session, run_id: str) -> list[Artifact]:
        return list(db.scalars(select(Artifact).where(Artifact.run_id == run_id).order_by(Artifact.id)))

    def get(self, db: Session, artifact_id: str) -> Artifact | None:
        return db.scalar(select(Artifact).where(Artifact.artifact_id == artifact_id))

    def resolve_path(self, artifact: Artifact) -> Path:
        return assert_within_data_dir(self.settings, Path(artifact.file_path))

