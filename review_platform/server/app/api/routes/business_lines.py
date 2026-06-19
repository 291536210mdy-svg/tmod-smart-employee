from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.api.schemas import BusinessLineResponse
from app.api.serializers import business_line_to_response
from app.db.models import User
from app.platform.registry import registry


router = APIRouter(prefix="/business-lines", tags=["business-lines"])


@router.get("", response_model=list[BusinessLineResponse])
def list_business_lines(user: User = Depends(get_current_user)) -> list[BusinessLineResponse]:
    return [business_line_to_response(manifest) for manifest in registry.list_manifests()]


@router.get("/{line_id}", response_model=BusinessLineResponse)
def get_business_line(line_id: str, user: User = Depends(get_current_user)) -> BusinessLineResponse:
    try:
        return business_line_to_response(registry.get(line_id).get_manifest())
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business line not found")

