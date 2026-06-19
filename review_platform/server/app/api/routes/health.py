import datetime as dt

from fastapi import APIRouter

from app.api.schemas import HealthResponse


router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", time=dt.datetime.now(dt.timezone.utc))

