from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import artifacts, auth, business_lines, candidates, health, runs
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.paths import ensure_data_dirs
from app.db.init_db import init_db
from app.lines.award_review.line import AwardReviewLine
from app.platform.registry import registry
from app.platform.run_manager import RunManager


def ensure_business_lines_registered() -> None:
    try:
        registry.get("award_review")
    except KeyError:
        registry.register(AwardReviewLine())


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    ensure_data_dirs(settings)
    app = FastAPI(title="团队业务智能体平台", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def on_startup() -> None:
        init_db()
        ensure_business_lines_registered()
        app.state.run_manager = RunManager(settings=settings, registry=registry)

    app.include_router(business_lines.router, prefix="/api")
    app.include_router(health.router, prefix="/api")
    app.include_router(auth.router, prefix="/api")
    app.include_router(runs.router, prefix="/api")
    app.include_router(artifacts.router, prefix="/api")
    app.include_router(candidates.router, prefix="/api")
    return app


app = create_app()
