from fastapi import APIRouter, HTTPException, Depends, Response
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from typing import List
import uuid

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
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya esta registrado")

    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_data.password)

    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "password": hashed_password,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    access_token = create_access_token(data={"sub": user_id})

    user_resp = UserResponse(id=user_id, email=user_data.email, name=user_data.name, role=user_data.role, created_at=user_doc["created_at"])
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
    return UserResponse(id=user["id"], email=user["email"], name=user["name"], role=user["role"], created_at=user["created_at"])


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
