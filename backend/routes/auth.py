from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

from database import db
from models import UserResponse
from utils import get_current_user

router = APIRouter()


@router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"], email=user["email"], name=user["name"], role=user.get("role", "admin"),
        created_at=user.get("created_at", ""),
        ruc=user.get("ruc"), nombre_legal=user.get("nombre_legal"),
        tipo_contribuyente=user.get("tipo_contribuyente"), zona_sri=user.get("zona_sri"),
    )


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    ruc: Optional[str] = None
    nombre_legal: Optional[str] = None
    tipo_contribuyente: Optional[str] = None
    zona_sri: Optional[str] = None


@router.put("/auth/profile", response_model=UserResponse)
async def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.profile.update_one({"id": "emilio"}, {"$set": update}, upsert=True)
    updated = await get_current_user()
    return UserResponse(
        id=updated["id"], email=updated["email"], name=updated["name"], role=updated.get("role", "admin"),
        created_at=updated.get("created_at", ""),
        ruc=updated.get("ruc"), nombre_legal=updated.get("nombre_legal"),
        tipo_contribuyente=updated.get("tipo_contribuyente"), zona_sri=updated.get("zona_sri"),
    )
