from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.paths import ensure_data_dirs
from app.db.init_db import init_db
from app.lines.award_review.line import AwardReviewLine
from app.platform.registry import registry
from app.platform.run_manager import RunManager
from app.worker.celery_app import celery_app


@celery_app.task(name="app.worker.tasks.execute_run")
def execute_run(run_id: str) -> None:
    configure_logging()
    settings = get_settings()
    ensure_data_dirs(settings)
    init_db()
    ensure_business_lines_registered()
    manager = RunManager(settings=settings, registry=registry, max_workers=1)
    manager.execute(run_id)


def ensure_business_lines_registered() -> None:
    try:
        registry.get("award_review")
    except KeyError:
        registry.register(AwardReviewLine())
