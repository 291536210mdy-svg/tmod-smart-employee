import datetime as dt
import json
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.db.base import SessionLocal
from app.db.models import Run
from app.platform.artifacts import ArtifactStore
from app.platform.business_line import ArtifactRef, RunContext
from app.platform.events import BusEventSink, EventBus
from app.platform.registry import BusinessLineRegistry, registry as default_registry
from app.platform.storage import LocalStorage


class RunCancelled(Exception):
    pass


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def generate_run_id() -> str:
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"run_{stamp}_{uuid.uuid4().hex[:6]}"


class RunManager:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        registry: BusinessLineRegistry | None = None,
        event_bus: EventBus | None = None,
        storage: LocalStorage | None = None,
        artifact_store: ArtifactStore | None = None,
        max_workers: int | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.registry = registry or default_registry
        self.event_bus = event_bus or EventBus(self.settings)
        self.storage = storage or LocalStorage(self.settings)
        self.artifact_store = artifact_store or ArtifactStore(self.settings)
        self.executor = ThreadPoolExecutor(max_workers=max_workers or self.settings.run_max_workers)
        self._futures: dict[str, Future] = {}

    def create_run(
        self,
        *,
        line_id: str,
        title: str,
        config: dict[str, Any] | None = None,
        created_by: str = "",
        input_files: list[dict[str, Any]] | None = None,
    ) -> str:
        line = self.registry.get(line_id)
        line.validate_config(config or {})
        run_id = generate_run_id()
        run_base, _, output_dir = self.storage.prepare_run_dirs(run_id)
        with SessionLocal() as db:
            row = Run(
                run_id=run_id,
                line_id=line_id,
                status="created",
                title=title,
                config_json=json.dumps(config or {}, ensure_ascii=False),
                input_files_json=json.dumps(input_files or [], ensure_ascii=False),
                output_dir=str(output_dir),
                created_by=created_by,
                summary_json=json.dumps({"execution_completed": False, "qa_passed": None}, ensure_ascii=False),
            )
            db.add(row)
            db.commit()
        self.event_bus.publish(run_id, "run:created", line_id=line_id, payload={"title": title, "run_dir": str(run_base)})
        return run_id

    def submit(self, run_id: str) -> None:
        with SessionLocal() as db:
            run = self._get_run_or_raise(db, run_id)
            if run.status not in {"created", "queued"}:
                raise ValueError(f"run cannot be submitted from status {run.status}")
            run.status = "queued"
            db.commit()
        self.event_bus.publish(run_id, "run:queued", line_id=self.get_run(run_id).line_id)
        backend = self.settings.run_execution_backend.lower()
        if backend == "thread":
            self._futures[run_id] = self.executor.submit(self.execute, run_id)
            return
        if backend == "celery":
            from app.worker.tasks import execute_run

            execute_run.delay(run_id)
            return
        raise ValueError(f"unsupported run execution backend: {self.settings.run_execution_backend}")

    def cancel(self, run_id: str) -> None:
        with SessionLocal() as db:
            run = self._get_run_or_raise(db, run_id)
            run.cancel_requested = True
            if run.status in {"created", "queued", "running"}:
                run.status = "cancelling"
            db.commit()
            line_id = run.line_id
        self.event_bus.publish(run_id, "run:cancelling", line_id=line_id, level="warn")

    def get_run(self, run_id: str) -> Run:
        with SessionLocal() as db:
            run = self._get_run_or_raise(db, run_id)
            db.expunge(run)
            return run

    def list_runs(self, limit: int = 100) -> list[Run]:
        with SessionLocal() as db:
            stmt = select(Run).where(Run.deleted_at.is_(None)).order_by(Run.created_at.desc()).limit(limit)
            rows = list(db.scalars(stmt))
            for row in rows:
                db.expunge(row)
            return rows

    def should_cancel(self, run_id: str) -> bool:
        with SessionLocal() as db:
            run = db.scalar(select(Run).where(Run.run_id == run_id))
            return bool(run and run.cancel_requested)

    def add_artifact(self, run_id: str, artifact: ArtifactRef) -> None:
        with SessionLocal() as db:
            self.artifact_store.add(db, run_id, artifact)
            db.commit()
        self.event_bus.publish(
            run_id,
            "artifact:created",
            line_id=self.get_run(run_id).line_id,
            payload={"artifact_type": artifact.artifact_type, "name": artifact.name},
        )

    def execute(self, run_id: str) -> None:
        self._execute(run_id)

    def _execute(self, run_id: str) -> None:
        with SessionLocal() as db:
            run = self._get_run_or_raise(db, run_id)
            if run.cancel_requested:
                self._mark_cancelled(db, run)
                return
            run.status = "running"
            run.started_at = now_utc()
            db.commit()
            line_id = run.line_id
            config = json.loads(run.config_json or "{}")
        self.event_bus.publish(run_id, "run:started", line_id=line_id)

        try:
            line = self.registry.get(line_id)
            runner = line.create_runner()
            _, input_dir, output_dir = self.storage.prepare_run_dirs(run_id)
            sink = BusEventSink(self.event_bus, run_id, line_id)
            context = RunContext(
                run_id=run_id,
                line_id=line_id,
                config=config,
                input_dir=input_dir,
                output_dir=output_dir,
                settings=self.settings,
                emit=sink.emit,
                add_artifact=lambda artifact: self.add_artifact(run_id, artifact),
                should_cancel=lambda: self.should_cancel(run_id),
            )
            if context.should_cancel():
                raise RunCancelled()
            runner.run(context)
            if context.should_cancel():
                raise RunCancelled()
            self._mark_succeeded(run_id, context.summary)
        except RunCancelled:
            with SessionLocal() as db:
                run = self._get_run_or_raise(db, run_id)
                self._mark_cancelled(db, run)
        except Exception as exc:
            self._mark_failed(run_id, str(exc))

    def _mark_succeeded(self, run_id: str, summary: dict[str, Any] | None = None) -> None:
        with SessionLocal() as db:
            run = self._get_run_or_raise(db, run_id)
            run.status = "succeeded"
            run.finished_at = now_utc()
            payload = {"execution_completed": True, "qa_passed": None}
            if summary:
                payload.update(summary)
            run.summary_json = json.dumps(payload, ensure_ascii=False)
            db.commit()
            line_id = run.line_id
        self.event_bus.publish(run_id, "run:succeeded", line_id=line_id, payload=payload)

    def _mark_failed(self, run_id: str, error_message: str) -> None:
        with SessionLocal() as db:
            run = self._get_run_or_raise(db, run_id)
            run.status = "failed"
            run.finished_at = now_utc()
            run.error_message = error_message
            run.summary_json = json.dumps({"execution_completed": False, "qa_passed": None}, ensure_ascii=False)
            db.commit()
            line_id = run.line_id
        self.event_bus.publish(run_id, "run:failed", line_id=line_id, level="error", payload={"error": error_message})

    def _mark_cancelled(self, db, run: Run) -> None:
        run.status = "cancelled"
        run.finished_at = now_utc()
        run.summary_json = json.dumps({"execution_completed": False, "qa_passed": None}, ensure_ascii=False)
        line_id = run.line_id
        run_id = run.run_id
        db.commit()
        self.event_bus.publish(run_id, "run:cancelled", line_id=line_id, level="warn")

    @staticmethod
    def _get_run_or_raise(db, run_id: str) -> Run:
        run = db.scalar(select(Run).where(Run.run_id == run_id))
        if not run:
            raise KeyError(f"run not found: {run_id}")
        return run
