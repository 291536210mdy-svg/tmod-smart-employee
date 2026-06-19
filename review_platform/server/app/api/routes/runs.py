import asyncio
import json
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_run_manager, require_role
from app.api.schemas import RunCreateResponse, RunEventResponse, RunResponse
from app.api.serializers import event_to_response, run_to_response
from app.db.base import SessionLocal, get_db
from app.db.models import Run, User
from app.platform.run_manager import RunManager


router = APIRouter(prefix="/runs", tags=["runs"])
TERMINAL_STATUSES = {"succeeded", "failed", "cancelled"}


@router.post("", response_model=RunCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_run(
    line_id: str = Form(...),
    title: str = Form(""),
    config: str = Form("{}"),
    file: UploadFile = File(...),
    user: User = Depends(require_role("reviewer")),
    manager: RunManager = Depends(get_run_manager),
) -> RunCreateResponse:
    try:
        config_data = json.loads(config or "{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid config JSON")
    run_id = manager.create_run(
        line_id=line_id,
        title=title or file.filename or "未命名任务",
        config=config_data,
        created_by=user.username,
    )
    _, input_dir, _ = manager.storage.prepare_run_dirs(run_id)
    input_path = input_dir / "source.xlsx"
    with input_path.open("wb") as target:
        shutil.copyfileobj(file.file, target)
    _update_run_input_file(run_id, input_path, db=None)
    manager.submit(run_id)
    return RunCreateResponse(run_id=run_id, status="queued")


@router.get("", response_model=list[RunResponse])
def list_runs(
    line_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RunResponse]:
    stmt = select(Run).order_by(Run.created_at.desc())
    if line_id:
        stmt = stmt.where(Run.line_id == line_id)
    if status_filter:
        stmt = stmt.where(Run.status == status_filter)
    return [run_to_response(run) for run in db.scalars(stmt).all()]


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RunResponse:
    run = db.scalar(select(Run).where(Run.run_id == run_id))
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run_to_response(run)


@router.post("/{run_id}/cancel", response_model=RunResponse)
def cancel_run(
    run_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("reviewer")),
    manager: RunManager = Depends(get_run_manager),
) -> RunResponse:
    manager.cancel(run_id)
    run = db.scalar(select(Run).where(Run.run_id == run_id))
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    db.refresh(run)
    return run_to_response(run)


@router.get("/{run_id}/events", response_model=list[RunEventResponse])
def get_events(
    run_id: str,
    after_id: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    manager: RunManager = Depends(get_run_manager),
) -> list[RunEventResponse]:
    _ensure_run_exists(db, run_id)
    return [event_to_response(event) for event in manager.event_bus.get_events(db, run_id, after_id=after_id)]


@router.get("/{run_id}/events/stream")
async def stream_events(
    run_id: str,
    after_id: int = 0,
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    manager: RunManager = Depends(get_run_manager),
) -> StreamingResponse:
    _ensure_run_exists(db, run_id)
    if last_event_id and not after_id:
        try:
            after_id = int(last_event_id)
        except ValueError:
            after_id = 0

    async def event_generator():
        last_id = after_id
        while True:
            with SessionLocal() as event_db:
                events = manager.event_bus.get_events(event_db, run_id, after_id=last_id, limit=100)
                current_run = event_db.scalar(select(Run).where(Run.run_id == run_id))
                terminal = bool(current_run and current_run.status in TERMINAL_STATUSES)
            for event in events:
                last_id = event.id
                data = event_to_response(event).model_dump_json()
                yield f"id: {event.id}\nevent: {event.event_type}\ndata: {data}\n\n"
            if terminal and not events:
                break
            await asyncio.sleep(0.75)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def _ensure_run_exists(db: Session, run_id: str) -> None:
    if not db.scalar(select(Run.id).where(Run.run_id == run_id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")


def _update_run_input_file(run_id: str, input_path: Path, db: Session | None = None) -> None:
    payload = [{"name": input_path.name, "path": str(input_path), "size_bytes": input_path.stat().st_size}]
    if db is not None:
        run = db.scalar(select(Run).where(Run.run_id == run_id))
        if run:
            run.input_files_json = json.dumps(payload, ensure_ascii=False)
        return
    from app.db.base import SessionLocal

    with SessionLocal() as session:
        run = session.scalar(select(Run).where(Run.run_id == run_id))
        if run:
            run.input_files_json = json.dumps(payload, ensure_ascii=False)
            session.commit()
