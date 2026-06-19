import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.paths import run_events_path
from app.db.base import SessionLocal
from app.db.models import RunEvent


def _progress_values(progress: tuple[int, int] | None) -> tuple[int | None, int | None]:
    if progress is None:
        return None, None
    return progress


class EventBus:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def publish(
        self,
        run_id: str,
        event_type: str,
        *,
        line_id: str = "",
        level: str = "info",
        message: str = "",
        progress: tuple[int, int] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> RunEvent:
        current, total = _progress_values(progress)
        payload_data = dict(payload or {})
        if line_id:
            payload_data.setdefault("line_id", line_id)
        with SessionLocal() as db:
            event = RunEvent(
                run_id=run_id,
                event_type=event_type,
                level=level,
                message=message,
                progress_current=current,
                progress_total=total,
                payload_json=json.dumps(payload_data, ensure_ascii=False),
            )
            db.add(event)
            db.commit()
            db.refresh(event)
            self._append_jsonl(event)
            return event

    def get_events(self, db: Session, run_id: str, after_id: int = 0, limit: int = 500) -> list[RunEvent]:
        stmt = (
            select(RunEvent)
            .where(RunEvent.run_id == run_id, RunEvent.id > after_id)
            .order_by(RunEvent.id)
            .limit(limit)
        )
        return list(db.scalars(stmt))

    def _append_jsonl(self, event: RunEvent) -> None:
        path = run_events_path(self.settings, event.run_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "id": event.id,
            "run_id": event.run_id,
            "type": event.event_type,
            "level": event.level,
            "message": event.message,
            "progress": {
                "current": event.progress_current,
                "total": event.progress_total,
            },
            "payload": json.loads(event.payload_json or "{}"),
            "created_at": event.created_at.isoformat() if event.created_at else None,
        }
        with Path(path).open("a", encoding="utf-8") as file:
            file.write(json.dumps(payload, ensure_ascii=False) + "\n")


class BusEventSink:
    def __init__(self, bus: EventBus, run_id: str, line_id: str) -> None:
        self.bus = bus
        self.run_id = run_id
        self.line_id = line_id

    def emit(
        self,
        event_type: str,
        *,
        message: str = "",
        level: str = "info",
        progress: tuple[int, int] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        self.bus.publish(
            self.run_id,
            event_type,
            line_id=self.line_id,
            level=level,
            message=message,
            progress=progress,
            payload=payload,
        )

