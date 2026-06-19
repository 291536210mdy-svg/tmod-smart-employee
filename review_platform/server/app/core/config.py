from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug_reload: bool = False
    app_data_dir: Path = Path("./data")
    database_url: str = ""
    secret_key: str = "change-me"
    public_base_url: str = ""
    cors_allow_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    upload_max_bytes: int = 50 * 1024 * 1024
    upload_allowed_extensions: list[str] = [".xlsx"]

    project_root: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[4])
    review_batch_dir: Path | None = None

    dify_base_url: str = ""
    dify_review_workflow_api_key: str = ""
    dify_ranking_reason_workflow_api_key: str = ""
    dify_user: str = "review-platform"

    run_max_workers: int = 2
    run_execution_backend: str = "thread"
    run_retention_days: int = 180
    run_retention_keep_last: int = 200
    access_token_expire_minutes: int = 60 * 12

    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    artifact_storage_backend: str = "local"
    s3_endpoint_url: str = ""
    s3_region_name: str = "us-east-1"
    s3_bucket_name: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_prefix: str = "review-platform"

    seed_admin_username: str = "admin"
    seed_admin_password: str = "admin123"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def data_dir(self) -> Path:
        return self.app_data_dir

    @property
    def resolved_review_batch_dir(self) -> Path:
        return self.review_batch_dir or self.project_root

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        db_path = self.data_dir / "app.db"
        return f"sqlite:///{db_path.as_posix()}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
