import shutil
from pathlib import Path

from app.core.config import Settings
from app.core.paths import assert_within_data_dir, run_dir, run_input_dir, run_output_dir


class LocalStorage:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def prepare_run_dirs(self, run_id: str) -> tuple[Path, Path, Path]:
        base = run_dir(self.settings, run_id)
        input_dir = run_input_dir(self.settings, run_id)
        output_dir = run_output_dir(self.settings, run_id)
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)
        return base, input_dir, output_dir

    def assert_safe_path(self, path: Path) -> Path:
        return assert_within_data_dir(self.settings, path)

    def copy_input_file(self, source: Path, run_id: str, target_name: str = "source.xlsx") -> Path:
        _, input_dir, _ = self.prepare_run_dirs(run_id)
        target = input_dir / target_name
        self.assert_safe_path(target)
        shutil.copy2(source, target)
        return target

    def open_path(self, path: Path) -> Path:
        safe_path = self.assert_safe_path(path)
        if not safe_path.exists():
            raise FileNotFoundError(str(safe_path))
        return safe_path

