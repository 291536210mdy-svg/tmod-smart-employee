from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base, SessionLocal, engine
from app.db.models import BusinessLine, User


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    apply_lightweight_schema_updates()
    with SessionLocal() as db:
        seed_business_lines(db)
        seed_admin_user(db)
        db.commit()


def apply_lightweight_schema_updates() -> None:
    if not get_settings().resolved_database_url.startswith("sqlite"):
        return
    inspector = inspect(engine)
    if "runs" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("runs")}
    statements = []
    if "archived" not in existing_columns:
        statements.append("ALTER TABLE runs ADD COLUMN archived BOOLEAN NOT NULL DEFAULT 0")
    if "archived_at" not in existing_columns:
        statements.append("ALTER TABLE runs ADD COLUMN archived_at DATETIME")
    if "deleted_at" not in existing_columns:
        statements.append("ALTER TABLE runs ADD COLUMN deleted_at DATETIME")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def seed_business_lines(db: Session) -> None:
    existing = db.scalar(select(BusinessLine).where(BusinessLine.line_id == "award_review"))
    if existing:
        return
    db.add(
        BusinessLine(
            line_id="award_review",
            name="评优业务线",
            description="基于申报 Excel、Dify Workflow、本地评分排序和 QA 检查生成评优结果。",
            enabled=True,
        )
    )


def seed_admin_user(db: Session) -> None:
    settings = get_settings()
    existing = db.scalar(select(User).where(User.username == settings.seed_admin_username))
    if existing:
        return
    db.add(
        User(
            username=settings.seed_admin_username,
            password_hash=hash_password(settings.seed_admin_password),
            role="admin",
            enabled=True,
        )
    )
