import json
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote

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
        artifact_id = f"artifact_{uuid.uuid4().hex[:12]}"
        file_path = str(safe_path)
        metadata = dict(artifact.metadata)
        if self._uses_s3:
            key = self._s3_key(run_id, artifact_id, safe_path)
            self._s3_client.upload_file(
                str(safe_path),
                self.settings.s3_bucket_name,
                key,
                ExtraArgs={"ContentType": artifact.content_type},
            )
            file_path = f"s3://{self.settings.s3_bucket_name}/{key}"
            metadata.update({"storage_backend": "s3", "s3_key": key})
        row = Artifact(
            artifact_id=artifact_id,
            run_id=run_id,
            artifact_type=artifact.artifact_type,
            name=artifact.name,
            file_path=file_path,
            content_type=artifact.content_type,
            size_bytes=safe_path.stat().st_size if safe_path.exists() else 0,
            metadata_json=json.dumps(metadata, ensure_ascii=False),
        )
        db.add(row)
        db.flush()
        return row

    def list_for_run(self, db: Session, run_id: str) -> list[Artifact]:
        return list(db.scalars(select(Artifact).where(Artifact.run_id == run_id).order_by(Artifact.id)))

    def get(self, db: Session, artifact_id: str) -> Artifact | None:
        return db.scalar(select(Artifact).where(Artifact.artifact_id == artifact_id))

    def resolve_path(self, artifact: Artifact) -> Path:
        if self.is_remote(artifact):
            raise ValueError("remote artifacts do not have a local path")
        return assert_within_data_dir(self.settings, Path(artifact.file_path))

    def is_remote(self, artifact: Artifact) -> bool:
        return artifact.file_path.startswith("s3://")

    def open_remote_object(self, artifact: Artifact) -> Any:
        bucket, key = self._parse_s3_uri(artifact.file_path)
        return self._s3_client.get_object(Bucket=bucket, Key=key)

    def read_text(self, artifact: Artifact, encoding: str = "utf-8") -> str:
        if self.is_remote(artifact):
            response = self.open_remote_object(artifact)
            return response["Body"].read().decode(encoding)
        path = self.resolve_path(artifact)
        return path.read_text(encoding=encoding)

    def delete_for_run(self, db: Session, run_id: str) -> bool:
        if not self._uses_s3:
            return True
        artifacts = self.list_for_run(db, run_id)
        objects = []
        for artifact in artifacts:
            if self.is_remote(artifact):
                bucket, key = self._parse_s3_uri(artifact.file_path)
                if bucket == self.settings.s3_bucket_name:
                    objects.append({"Key": key})
        if not objects:
            return True
        self._s3_client.delete_objects(Bucket=self.settings.s3_bucket_name, Delete={"Objects": objects})
        return True

    @property
    def _uses_s3(self) -> bool:
        return self.settings.artifact_storage_backend.lower() == "s3"

    @property
    def _s3_client(self):
        if not self.settings.s3_bucket_name:
            raise ValueError("S3_BUCKET_NAME is required when ARTIFACT_STORAGE_BACKEND=s3")
        import boto3

        kwargs: dict[str, str] = {"region_name": self.settings.s3_region_name}
        if self.settings.s3_endpoint_url:
            kwargs["endpoint_url"] = self.settings.s3_endpoint_url
        if self.settings.s3_access_key_id and self.settings.s3_secret_access_key:
            kwargs["aws_access_key_id"] = self.settings.s3_access_key_id
            kwargs["aws_secret_access_key"] = self.settings.s3_secret_access_key
        return boto3.client("s3", **kwargs)

    def _s3_key(self, run_id: str, artifact_id: str, path: Path) -> str:
        prefix = self.settings.s3_prefix.strip("/")
        parts = [part for part in [prefix, run_id, artifact_id, path.name] if part]
        return "/".join(quote(part, safe="._-") for part in parts)

    @staticmethod
    def _parse_s3_uri(uri: str) -> tuple[str, str]:
        without_scheme = uri.removeprefix("s3://")
        bucket, _, key = without_scheme.partition("/")
        if not bucket or not key:
            raise ValueError(f"invalid S3 artifact URI: {uri}")
        return bucket, key
