from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import json
import base64
import aiofiles
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
import tempfile
import openpyxl
from io import BytesIO
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME')]

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'default_secret_key')
ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 1440))
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI(title="FamilyFinance Ecuador API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ================= MODELS =================

# User roles
class UserRole:
    ADMIN = "admin"
    ACCOUNTANT = "accountant"
    SPOUSE = "spouse"

# SRI Ecuador Categories - Límites de deducción 2024
# Según Ley de Régimen Tributario Interno
SRI_CATEGORIES = {
    "alimentacion": {"name": "Alimentación", "subcategories": ["Comida", "Restaurantes", "Supermercado"], "deductible": True, "limit_percentage": 0.325},
    "salud": {"name": "Salud", "subcategories": ["Seguros", "Medicina", "Consultas"], "deductible": True, "limit_percentage": 1.3},
    "educacion": {"name": "Educación", "subcategories": ["Colegio y actividades", "Cursos", "Materiales"], "deductible": True, "limit_percentage": 0.325},
    "vivienda": {"name": "Vivienda", "subcategories": ["Servicios básicos", "Arriendo", "Mantenimiento"], "deductible": True, "limit_percentage": 0.325},
    "vestimenta": {"name": "Vestimenta", "subcategories": ["Ropa", "Calzado", "Accesorios"], "deductible": True, "limit_percentage": 0.325},
    "transporte": {"name": "Transporte", "subcategories": ["Carros", "Combustible", "Mantenimiento vehicular"], "deductible": False, "limit_percentage": 0},
    "viajes_internacionales": {"name": "Viajes Internacionales", "subcategories": ["USA", "Europa", "Otros países"], "deductible": False, "limit_percentage": 0},
    "otros": {"name": "Otros", "subcategories": ["Empleados", "Entretenimiento", "Varios"], "deductible": False, "limit_percentage": 0}
}

# Canasta Básica Familiar (referencia para límites SRI)
CANASTA_BASICA = 798.89  # USD 2024

# Payment sources
PAYMENT_SOURCES = ["local", "internacional"]  # tarjeta local vs tarjeta extranjera

# Income Sources
INCOME_SOURCES = ["Personal", "APX", "USA"]

# Countries considered international
INTERNATIONAL_COUNTRIES = ["USA", "United States", "Estados Unidos", "US", "EU", "Europa", "Spain", "España", "Colombia", "Peru", "Perú", "México", "Mexico"]

# Pydantic Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = UserRole.SPOUSE

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    created_at: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TransactionBase(BaseModel):
    amount: float
    description: str
    category: str
    subcategory: str
    date: str
    transaction_type: str = "expense"  # expense or income
    source: Optional[str] = None  # For income: Personal, APX, USA
    establishment: Optional[str] = None
    card_last_digits: Optional[str] = None
    country: Optional[str] = None  # País del gasto
    is_international: bool = False  # Si es gasto internacional
    payment_source: str = "local"  # local o internacional (tarjeta extranjera)
    is_deductible: bool = True  # Si es deducible para SRI

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    created_at: str
    ai_classified: bool = False

class BudgetItem(BaseModel):
    category: str
    subcategory: str
    planned_amount: float
    month: str  # Format: YYYY-MM

class BudgetResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    items: List[BudgetItem]
    total_income: float
    total_expenses: float
    created_at: str

class DocumentUpload(BaseModel):
    document_type: str  # email, receipt, statement, excel
    content: Optional[str] = None

class PredictionResponse(BaseModel):
    category: str
    current_spending: float
    predicted_spending: float
    trend: str
    advice: str

class DashboardStats(BaseModel):
    total_income: float
    total_expenses: float
    balance: float
    daily_average: float
    weekly_total: float
    monthly_total: float
    by_category: Dict[str, float]
    sri_deductible: float

# ================= AUTH HELPERS =================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user

def check_role(allowed_roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Acceso denegado")
        return user
    return role_checker

# ================= AUTH ENDPOINTS =================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # Create user
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
    
    # Create token
    access_token = create_access_token(data={"sub": user_id})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role,
            created_at=user_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        created_at=user["created_at"]
    )

# ================= CATEGORIES ENDPOINTS =================

@api_router.get("/categories")
async def get_categories():
    return {"categories": SRI_CATEGORIES, "income_sources": INCOME_SOURCES}

# ================= TRANSACTIONS ENDPOINTS =================

@api_router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(
    transaction: TransactionCreate,
    user: dict = Depends(get_current_user)
):
    transaction_id = str(uuid.uuid4())
    
    doc = {
        "id": transaction_id,
        "user_id": user["id"],
        **transaction.model_dump(),
        "ai_classified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(doc)
    
    return TransactionResponse(**{k: v for k, v in doc.items() if k != "_id"})

@api_router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    transaction_type: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {"user_id": user["id"]}
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if category:
        query["category"] = category
    if transaction_type:
        query["transaction_type"] = transaction_type
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [TransactionResponse(**t) for t in transactions]

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(
    transaction_id: str,
    user: dict = Depends(get_current_user)
):
    result = await db.transactions.delete_one({"id": transaction_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    return {"message": "Transacción eliminada"}

@api_router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    transaction: TransactionCreate,
    user: dict = Depends(get_current_user)
):
    existing = await db.transactions.find_one({"id": transaction_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    
    update_data = transaction.model_dump()
    await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": update_data}
    )
    
    updated = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    return TransactionResponse(**updated)

# ================= DASHBOARD ENDPOINTS =================

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_of_week = now - timedelta(days=now.weekday())
    
    # Get all transactions for current month
    transactions = await db.transactions.find(
        {"user_id": user["id"], "date": {"$gte": start_of_month.strftime("%Y-%m-%d")}},
        {"_id": 0}
    ).to_list(1000)
    
    total_income = sum(t["amount"] for t in transactions if t["transaction_type"] == "income")
    total_expenses = sum(t["amount"] for t in transactions if t["transaction_type"] == "expense")
    
    # Weekly total
    weekly_transactions = [t for t in transactions if t["date"] >= start_of_week.strftime("%Y-%m-%d")]
    weekly_total = sum(t["amount"] for t in weekly_transactions if t["transaction_type"] == "expense")
    
    # Daily average
    days_in_month = now.day
    daily_average = total_expenses / days_in_month if days_in_month > 0 else 0
    
    # By category
    by_category = {}
    for t in transactions:
        if t["transaction_type"] == "expense":
            cat = t["category"]
            by_category[cat] = by_category.get(cat, 0) + t["amount"]
    
    # SRI deductible (alimentación, salud, educación, vivienda, vestimenta)
    sri_deductible_cats = ["alimentacion", "salud", "educacion", "vivienda", "vestimenta"]
    sri_deductible = sum(by_category.get(cat, 0) for cat in sri_deductible_cats)
    
    return DashboardStats(
        total_income=total_income,
        total_expenses=total_expenses,
        balance=total_income - total_expenses,
        daily_average=round(daily_average, 2),
        weekly_total=weekly_total,
        monthly_total=total_expenses,
        by_category=by_category,
        sri_deductible=sri_deductible
    )

@api_router.get("/dashboard/chart-data")
async def get_chart_data(
    period: str = "month",  # week, month, year
    user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    
    if period == "week":
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    elif period == "month":
        start_date = now.replace(day=1).strftime("%Y-%m-%d")
    else:  # year
        start_date = now.replace(month=1, day=1).strftime("%Y-%m-%d")
    
    transactions = await db.transactions.find(
        {"user_id": user["id"], "date": {"$gte": start_date}},
        {"_id": 0}
    ).sort("date", 1).to_list(1000)
    
    # Group by date
    daily_data = {}
    for t in transactions:
        date = t["date"]
        if date not in daily_data:
            daily_data[date] = {"date": date, "income": 0, "expenses": 0}
        
        if t["transaction_type"] == "income":
            daily_data[date]["income"] += t["amount"]
        else:
            daily_data[date]["expenses"] += t["amount"]
    
    return {"data": list(daily_data.values())}

# ================= AI PROCESSING ENDPOINTS =================

async def classify_with_ai(text: str, context: str = "expense") -> dict:
    """Use OpenAI to classify transaction"""
    if not EMERGENT_LLM_KEY:
        return {"category": "otros", "subcategory": "Varios", "amount": 0, "description": text}
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"classify_{uuid.uuid4()}",
            system_message="""Eres un asistente financiero experto en leyes tributarias de Ecuador.
            Clasifica las transacciones en las siguientes categorías del SRI:
            - alimentacion: Comida, Restaurantes, Supermercado
            - salud: Seguros, Medicina, Consultas
            - educacion: Colegio y actividades, Cursos, Materiales
            - vivienda: Servicios básicos, Arriendo, Mantenimiento
            - vestimenta: Ropa, Calzado, Accesorios
            - transporte: Carros, Combustible, Mantenimiento vehicular
            - otros: Empleados, Viajes y Entretenimiento, Varios
            
            Responde SOLO en formato JSON: {"category": "...", "subcategory": "...", "amount": numero, "description": "...", "establishment": "..."}"""
        ).with_model("openai", "gpt-5.2")
        
        response = await chat.send_message(UserMessage(text=f"Clasifica esta transacción: {text}"))
        
        # Parse JSON from response
        json_match = re.search(r'\{[^}]+\}', response)
        if json_match:
            return json.loads(json_match.group())
        return {"category": "otros", "subcategory": "Varios", "amount": 0, "description": text}
    except Exception as e:
        logger.error(f"AI classification error: {e}")
        return {"category": "otros", "subcategory": "Varios", "amount": 0, "description": text}

async def process_image_with_ai(file_path: str) -> dict:
    """Use Gemini to extract data from receipt image"""
    if not EMERGENT_LLM_KEY:
        return {"error": "API key not configured"}
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ocr_{uuid.uuid4()}",
            system_message="""Eres un experto en OCR y análisis de recibos/facturas ecuatorianas.
            Extrae la información del recibo y clasifícala según categorías SRI Ecuador.
            Responde SOLO en formato JSON: 
            {"transactions": [{"amount": numero, "description": "...", "category": "...", "subcategory": "...", "establishment": "...", "date": "YYYY-MM-DD"}]}"""
        ).with_model("gemini", "gemini-2.5-flash")
        
        file_content = FileContentWithMimeType(
            file_path=file_path,
            mime_type="image/jpeg"
        )
        
        response = await chat.send_message(UserMessage(
            text="Extrae toda la información de este recibo/factura ecuatoriana",
            file_contents=[file_content]
        ))
        
        json_match = re.search(r'\{[^}]*"transactions"[^}]*\[.*?\]\s*\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return {"transactions": []}
    except Exception as e:
        logger.error(f"Image processing error: {e}")
        return {"transactions": [], "error": str(e)}

@api_router.post("/process/email")
async def process_email(
    email_content: str = Form(...),
    user: dict = Depends(get_current_user)
):
    """Process credit card email notification"""
    # Parse PacifiCard format
    result = await classify_with_ai(email_content, "email")
    
    # Create transaction
    transaction_id = str(uuid.uuid4())
    doc = {
        "id": transaction_id,
        "user_id": user["id"],
        "amount": result.get("amount", 0),
        "description": result.get("description", ""),
        "category": result.get("category", "otros"),
        "subcategory": result.get("subcategory", "Varios"),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "transaction_type": "expense",
        "establishment": result.get("establishment", ""),
        "ai_classified": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(doc)
    
    return {"message": "Email procesado", "transaction": {k: v for k, v in doc.items() if k != "_id"}}

@api_router.post("/process/receipt")
async def process_receipt(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Process receipt image with OCR"""
    # Save file temporarily
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, file.filename)
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    try:
        result = await process_image_with_ai(file_path)
        
        created_transactions = []
        for t in result.get("transactions", []):
            transaction_id = str(uuid.uuid4())
            doc = {
                "id": transaction_id,
                "user_id": user["id"],
                "amount": t.get("amount", 0),
                "description": t.get("description", ""),
                "category": t.get("category", "otros"),
                "subcategory": t.get("subcategory", "Varios"),
                "date": t.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
                "transaction_type": "expense",
                "establishment": t.get("establishment", ""),
                "ai_classified": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.transactions.insert_one(doc)
            created_transactions.append({k: v for k, v in doc.items() if k != "_id"})
        
        return {"message": f"Procesadas {len(created_transactions)} transacciones", "transactions": created_transactions}
    finally:
        # Cleanup
        if os.path.exists(file_path):
            os.remove(file_path)
        os.rmdir(temp_dir)

@api_router.post("/process/excel")
async def process_excel(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Process Excel budget file"""
    content = await file.read()
    
    try:
        wb = openpyxl.load_workbook(BytesIO(content))
        
        budget_items = []
        total_income = 0
        total_expenses = 0
        
        for sheet in wb.worksheets:
            for row in sheet.iter_rows(min_row=2, values_only=True):
                if row[0] and isinstance(row[0], str):
                    # Try to parse as budget item
                    category_name = str(row[0]).lower()
                    
                    # Map to SRI categories
                    category_map = {
                        "servicios basicos": ("vivienda", "Servicios básicos"),
                        "empleados": ("otros", "Empleados"),
                        "colegio": ("educacion", "Colegio y actividades"),
                        "seguros": ("salud", "Seguros"),
                        "comida": ("alimentacion", "Comida"),
                        "restaurantes": ("alimentacion", "Restaurantes"),
                        "carros": ("transporte", "Carros"),
                        "viajes": ("otros", "Viajes y Entretenimiento"),
                    }
                    
                    for key, (cat, subcat) in category_map.items():
                        if key in category_name:
                            amounts = [v for v in row[1:] if isinstance(v, (int, float))]
                            if amounts:
                                avg_amount = sum(amounts) / len(amounts)
                                budget_items.append({
                                    "category": cat,
                                    "subcategory": subcat,
                                    "planned_amount": avg_amount,
                                    "month": datetime.now(timezone.utc).strftime("%Y-%m")
                                })
                                total_expenses += avg_amount
                            break
                    
                    # Check for income
                    if "ingreso" in category_name or "personal" in category_name or "apx" in category_name:
                        amounts = [v for v in row[1:] if isinstance(v, (int, float))]
                        if amounts:
                            total_income += sum(amounts) / len(amounts)
        
        # Save budget
        budget_id = str(uuid.uuid4())
        budget_doc = {
            "id": budget_id,
            "user_id": user["id"],
            "items": budget_items,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.budgets.insert_one(budget_doc)
        
        return {"message": "Excel procesado", "budget": {k: v for k, v in budget_doc.items() if k != "_id"}}
    except Exception as e:
        logger.error(f"Excel processing error: {e}")
        raise HTTPException(status_code=400, detail=f"Error procesando Excel: {str(e)}")

# ================= BUDGET ENDPOINTS =================

@api_router.get("/budget", response_model=BudgetResponse)
async def get_budget(
    month: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {"user_id": user["id"]}
    budget = await db.budgets.find_one(query, {"_id": 0}, sort=[("created_at", -1)])
    
    if not budget:
        # Return empty budget
        return BudgetResponse(
            id="",
            user_id=user["id"],
            items=[],
            total_income=0,
            total_expenses=0,
            created_at=datetime.now(timezone.utc).isoformat()
        )
    
    return BudgetResponse(**budget)

@api_router.get("/budget/vs-actual")
async def get_budget_vs_actual(user: dict = Depends(get_current_user)):
    """Compare budget vs actual spending"""
    # Get latest budget
    budget = await db.budgets.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)])
    
    # Get current month transactions
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1).strftime("%Y-%m-%d")
    
    transactions = await db.transactions.find(
        {"user_id": user["id"], "date": {"$gte": start_of_month}, "transaction_type": "expense"},
        {"_id": 0}
    ).to_list(1000)
    
    # Group actual by category
    actual_by_category = {}
    for t in transactions:
        cat = t["category"]
        actual_by_category[cat] = actual_by_category.get(cat, 0) + t["amount"]
    
    # Compare
    comparison = []
    if budget:
        budget_by_category = {}
        for item in budget.get("items", []):
            cat = item["category"]
            budget_by_category[cat] = budget_by_category.get(cat, 0) + item["planned_amount"]
        
        for cat in set(list(budget_by_category.keys()) + list(actual_by_category.keys())):
            planned = budget_by_category.get(cat, 0)
            actual = actual_by_category.get(cat, 0)
            comparison.append({
                "category": cat,
                "category_name": SRI_CATEGORIES.get(cat, {}).get("name", cat),
                "planned": planned,
                "actual": actual,
                "difference": planned - actual,
                "percentage": (actual / planned * 100) if planned > 0 else 0
            })
    
    return {"comparison": comparison}

# ================= AI PREDICTIONS ENDPOINTS =================

@api_router.get("/predictions")
async def get_predictions(user: dict = Depends(get_current_user)):
    """Get AI-powered spending predictions and advice"""
    if not EMERGENT_LLM_KEY:
        return {"predictions": [], "advice": ["Configure API key para predicciones AI"], "sri_tips": []}
    
    # Get last 3 months of transactions
    now = datetime.now(timezone.utc)
    three_months_ago = (now - timedelta(days=90)).strftime("%Y-%m-%d")
    
    transactions = await db.transactions.find(
        {"user_id": user["id"], "date": {"$gte": three_months_ago}},
        {"_id": 0}
    ).to_list(1000)
    
    if not transactions:
        return {"predictions": [], "advice": ["Agrega transacciones para obtener predicciones"], "sri_tips": []}
    
    # Prepare data for AI
    summary = {}
    for t in transactions:
        cat = t["category"]
        if cat not in summary:
            summary[cat] = {"total": 0, "count": 0, "transactions": []}
        summary[cat]["total"] += t["amount"]
        summary[cat]["count"] += 1
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"predict_{uuid.uuid4()}",
            system_message="""Eres un asesor financiero experto en finanzas personales y leyes tributarias de Ecuador.
            Analiza los gastos y proporciona:
            1. Predicciones de gastos para el próximo mes por categoría
            2. Consejos específicos para optimizar recursos
            3. Recomendaciones para maximizar deducciones SRI
            
            Responde en formato JSON:
            {
                "predictions": [{"category": "...", "predicted_amount": numero, "trend": "up/down/stable"}],
                "advice": ["consejo1", "consejo2", ...],
                "sri_tips": ["tip1", "tip2", ...]
            }"""
        ).with_model("openai", "gpt-5.2")
        
        response = await chat.send_message(UserMessage(
            text=f"Analiza estos gastos de los últimos 3 meses y proporciona predicciones: {json.dumps(summary)}"
        ))
        
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return result
        
        return {"predictions": [], "advice": ["No se pudo generar predicciones"], "sri_tips": []}
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return {"predictions": [], "advice": [f"Error: {str(e)}"], "sri_tips": []}

# ================= ACCOUNTANT VIEW ENDPOINTS =================

@api_router.get("/accountant/tax-summary")
async def get_tax_summary(
    year: Optional[int] = None,
    user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))
):
    """Get tax deductible summary for accountant"""
    if not year:
        year = datetime.now(timezone.utc).year
    
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    # Get all users' transactions (for accountant view)
    transactions = await db.transactions.find(
        {"date": {"$gte": start_date, "$lte": end_date}, "transaction_type": "expense"},
        {"_id": 0}
    ).to_list(10000)
    
    # SRI deductible categories
    sri_deductible_cats = ["alimentacion", "salud", "educacion", "vivienda", "vestimenta"]
    
    summary = {
        "year": year,
        "total_expenses": 0,
        "deductible_expenses": 0,
        "by_category": {},
        "monthly_breakdown": {}
    }
    
    for t in transactions:
        cat = t["category"]
        month = t["date"][:7]
        amount = t["amount"]
        
        summary["total_expenses"] += amount
        
        if cat in sri_deductible_cats:
            summary["deductible_expenses"] += amount
        
        if cat not in summary["by_category"]:
            summary["by_category"][cat] = {
                "name": SRI_CATEGORIES.get(cat, {}).get("name", cat),
                "total": 0,
                "deductible": cat in sri_deductible_cats
            }
        summary["by_category"][cat]["total"] += amount
        
        if month not in summary["monthly_breakdown"]:
            summary["monthly_breakdown"][month] = {"total": 0, "deductible": 0}
        summary["monthly_breakdown"][month]["total"] += amount
        if cat in sri_deductible_cats:
            summary["monthly_breakdown"][month]["deductible"] += amount
    
    return summary

# ================= USERS MANAGEMENT (ADMIN ONLY) =================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(user: dict = Depends(check_role([UserRole.ADMIN]))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return [UserResponse(**u) for u in users]

@api_router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str,
    user: dict = Depends(check_role([UserRole.ADMIN]))
):
    if role not in [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SPOUSE]:
        raise HTTPException(status_code=400, detail="Rol inválido")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Rol actualizado"}

# ================= HEALTH CHECK =================

@api_router.get("/")
async def root():
    return {"message": "FamilyFinance Ecuador API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
