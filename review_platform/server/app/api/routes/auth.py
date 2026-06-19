from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.api.schemas import (
    CreateUserRequest,
    CreateUserResponse,
    LoginRequest,
    TokenResponse,
    UpdateUserRequest,
    UserAdminResponse,
    UserResponse,
)
from app.core.security import create_access_token, hash_password, verify_password
from app.db.base import get_db
from app.db.models import User


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not user.enabled or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_access_token(subject=user.username, role=user.role)
    return TokenResponse(access_token=token, role=user.role)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(username=user.username, role=user.role, enabled=user.enabled)


@router.post("/users", response_model=CreateUserResponse)
def create_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
) -> CreateUserResponse:
    existing = db.scalar(select(User).where(User.username == payload.username))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        enabled=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return CreateUserResponse(username=user.username, role=user.role, enabled=user.enabled)


@router.get("/users", response_model=list[UserAdminResponse])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
) -> list[UserAdminResponse]:
    users = db.scalars(select(User).order_by(User.created_at.desc(), User.username)).all()
    return [
        UserAdminResponse(
            username=user.username,
            role=user.role,
            enabled=user.enabled,
            created_at=user.created_at,
        )
        for user in users
    ]


@router.patch("/users/{username}", response_model=UserAdminResponse)
def update_user(
    username: str,
    payload: UpdateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
) -> UserAdminResponse:
    user = db.scalar(select(User).where(User.username == username))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if user.username == admin.username and payload.enabled is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能停用当前登录账号")
    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.role is not None:
        user.role = payload.role
    if payload.enabled is not None:
        user.enabled = payload.enabled
    db.commit()
    db.refresh(user)
    return UserAdminResponse(
        username=user.username,
        role=user.role,
        enabled=user.enabled,
        created_at=user.created_at,
    )
