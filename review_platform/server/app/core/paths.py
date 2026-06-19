from pathlib import Path

from app.core.config import Settings


def ensure_data_dirs(settings: Settings) -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    uploads_dir(settings).mkdir(parents=True, exist_ok=True)
    runs_dir(settings).mkdir(parents=True, exist_ok=True)


def uploads_dir(settings: Settings) -> Path:
    return settings.data_dir / "uploads"


def runs_dir(settings: Settings) -> Path:
    return settings.data_dir / "runs"


def run_dir(settings: Settings, run_id: str) -> Path:
    return runs_dir(settings) / run_id


def run_input_dir(settings: Settings, run_id: str) -> Path:
    return run_dir(settings, run_id) / "input"


def run_output_dir(settings: Settings, run_id: str) -> Path:
    return run_dir(settings, run_id) / "outputs"


def run_events_path(settings: Settings, run_id: str) -> Path:
    return run_dir(settings, run_id) / "events.jsonl"


def assert_within_data_dir(settings: Settings, path: Path) -> Path:
    resolved = path.resolve()
    data_root = settings.data_dir.resolve()
    if resolved != data_root and data_root not in resolved.parents:
        raise ValueError(f"path is outside APP_DATA_DIR: {resolved}")
    return resolved

