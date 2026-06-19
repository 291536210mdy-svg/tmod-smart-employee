from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from app.core.config import Settings


@dataclass
class BusinessLineManifest:
    line_id: str
    name: str
    description: str
    input_types: list[str] = field(default_factory=list)
    run_modes: list[str] = field(default_factory=list)
    artifacts: list[str] = field(default_factory=list)
    config_schema: dict[str, Any] = field(default_factory=dict)
    supports_events: bool = True
    supports_result_query: bool = True
    supports_export: bool = True


@dataclass
class ArtifactRef:
    artifact_type: str
    name: str
    path: Path
    content_type: str = "application/octet-stream"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RunContext:
    run_id: str
    line_id: str
    config: dict[str, Any]
    input_dir: Path
    output_dir: Path
    settings: Settings
    emit: Any
    add_artifact: Any
    should_cancel: Any
    summary: dict[str, Any] = field(default_factory=dict)


class BusinessLineRunner(Protocol):
    def run(self, context: RunContext) -> None:
        ...


class BusinessLine(Protocol):
    manifest: BusinessLineManifest

    def get_manifest(self) -> BusinessLineManifest:
        ...

    def validate_config(self, config: dict[str, Any]) -> None:
        ...

    def create_runner(self) -> BusinessLineRunner:
        ...
