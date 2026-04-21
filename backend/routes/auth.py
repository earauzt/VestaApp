from fastapi import APIRouter, HTTPException, Depends, Response
from fastapi.responses import JSONResponse
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel, EmailStr
import uuid
import os
import secrets as secrets_mod

from database import db
from models import UserRole, UserCreate, UserLogin, UserResponse, Token
from utils import get_current_user, check_role, verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

COOKIE_MAX_AGE = ACCESS_TOKEN_EXPIRE_MINUTES * 60


def _set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


@router.post("/auth/register")
async def register(user_data: UserCreate, invite_token: Optional[str] = None):
    # If invite token provided, validate it and override email/rol from invitation
    invite = None
    if invite_token:
        invite = await db.invitations.find_one({"token": invite_token})
        if not invite or invite.get("usado"):
            raise HTTPException(status_code=400, detail="Invitacion invalida o ya utilizada")
        if datetime.now(timezone.utc) > datetime.fromisoformat(invite["expires_at"]):
            raise HTTPException(status_code=400, detail="Invitacion expirada")
        if user_data.email.lower() != invite["email"]:
            raise HTTPException(status_code=400, detail="El email no coincide con la invitacion")

    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya esta registrado")

    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_data.password)
    role = invite["rol"] if invite else user_data.role

    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": role,
        "password": hashed_password,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    if invite:
        await db.invitations.update_one({"token": invite_token}, {"$set": {"usado": True, "used_at": datetime.now(timezone.utc).isoformat()}})

    access_token = create_access_token(data={"sub": user_id})

    user_resp = UserResponse(id=user_id, email=user_data.email, name=user_data.name, role=role, created_at=user_doc["created_at"])
    body = {"access_token": access_token, "token_type": "bearer", "user": user_resp.model_dump()}

    response = JSONResponse(content=body)
    _set_auth_cookie(response, access_token)
    return response


@router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get("hashed_password", user.get("password", ""))):
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    access_token = create_access_token(data={"sub": user["id"]})

    user_resp = UserResponse(id=user["id"], email=user["email"], name=user["name"], role=user["role"], created_at=user["created_at"])
    body = {"access_token": access_token, "token_type": "bearer", "user": user_resp.model_dump()}

    response = JSONResponse(content=body)
    _set_auth_cookie(response, access_token)
    return response


@router.post("/auth/logout")
async def logout():
    response = JSONResponse(content={"message": "Sesion cerrada"})
    response.delete_cookie(key="access_token", path="/")
    return response


@router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"], email=user["email"], name=user["name"], role=user["role"],
        created_at=user["created_at"],
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
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return UserResponse(**updated)


# ================= INVITATIONS =================

class InviteCreate(BaseModel):
    email: EmailStr
    rol: str = UserRole.ACCOUNTANT


@router.post("/auth/invite")
async def create_invite(payload: InviteCreate, user: dict = Depends(check_role([UserRole.ADMIN]))):
    if payload.rol not in [UserRole.ACCOUNTANT, UserRole.SPOUSE]:
        raise HTTPException(status_code=400, detail="Rol invalido para invitacion")
    token = secrets_mod.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()
    await db.invitations.insert_one({
        "token": token, "email": payload.email.lower(), "rol": payload.rol,
        "created_by": user["id"], "expires_at": expires_at, "usado": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"token": token, "expires_at": expires_at}


@router.get("/auth/accept-invite/{token}")
async def validate_invite(token: str):
    inv = await db.invitations.find_one({"token": token}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitacion no encontrada")
    if inv.get("usado"):
        raise HTTPException(status_code=400, detail="Invitacion ya utilizada")
    if datetime.now(timezone.utc) > datetime.fromisoformat(inv["expires_at"]):
        raise HTTPException(status_code=400, detail="Invitacion expirada")
    return {"email": inv["email"], "rol": inv["rol"]}


# ================= USERS MANAGEMENT (ADMIN ONLY) =================

@router.get("/users", response_model=List[UserResponse])
async def get_users(user: dict = Depends(check_role([UserRole.ADMIN]))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return [UserResponse(**u) for u in users]


@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, role: str, user: dict = Depends(check_role([UserRole.ADMIN]))):
    if role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SPOUSE]:
        raise HTTPException(status_code=400, detail="Rol invalido")
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Rol actualizado"}
