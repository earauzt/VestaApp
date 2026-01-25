from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
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
import xlsxwriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

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

# SRI Ecuador 2025 - Límites de deducción de Gastos Personales
# Según Ley de Régimen Tributario Interno Art. 10 numeral 16
# Resolución NAC-DGERCGC23-00000024

# Canasta Básica Familiar 2025 (referencia para límites SRI)
CANASTA_BASICA = 798.31  # USD Enero 2025

# Fracción Básica Exenta 2025
FRACCION_BASICA_EXENTA = 11902.00  # USD anual

# Tabla de límites por cargas familiares (número de CBF)
CARGAS_FAMILIARES_CBF = {
    0: 7,    # 0 cargas = 7 CBF = $5,588.17
    1: 9,    # 1 carga = 9 CBF = $7,184.79
    2: 11,   # 2 cargas = 11 CBF = $8,781.41
    3: 13,   # 3 cargas = 13 CBF = $10,378.03
    4: 15,   # 4 cargas = 15 CBF = $11,974.65
    5: 17,   # 5+ cargas = 17 CBF = $13,571.27
}

# Rebaja de Impuesto a la Renta: 18% de gastos deducibles
PORCENTAJE_REBAJA_IR = 0.18

# SRI Ecuador Categories - Límites de deducción 2025
# limit_percentage: Fracción de la Fracción Básica Exenta
SRI_CATEGORIES = {
    "alimentacion": {
        "name": "Alimentación", 
        "subcategories": ["Comida", "Restaurantes", "Supermercado", "Mercado"],
        "deductible": True, 
        "limit_percentage": 0.325,  # 0.325 * $11,902 = $3,868.15 máximo
        "limit_usd": 3868.15,
        "description": "Compras de alimentos, restaurantes, supermercados"
    },
    "salud": {
        "name": "Salud", 
        "subcategories": ["Seguros", "Medicina", "Consultas", "Hospitalización", "Laboratorio"],
        "deductible": True, 
        "limit_percentage": 1.3,  # 1.3 * $11,902 = $15,472.60 máximo (enfermedades catastróficas)
        "limit_usd": 15472.60,
        "description": "Consultas médicas, medicinas, seguros de salud, hospitalización"
    },
    "educacion": {
        "name": "Educación", 
        "subcategories": ["Colegio y actividades", "Cursos", "Materiales", "Universidad", "Maestría"],
        "deductible": True, 
        "limit_percentage": 0.325,
        "limit_usd": 3868.15,
        "description": "Matrículas, pensiones, útiles escolares, cursos, seminarios"
    },
    "vivienda": {
        "name": "Vivienda", 
        "subcategories": ["Servicios básicos", "Arriendo", "Intereses hipoteca", "Mantenimiento"],
        "deductible": True, 
        "limit_percentage": 0.325,
        "limit_usd": 3868.15,
        "description": "Arriendo, servicios básicos (agua, luz, teléfono), intereses hipotecarios"
    },
    "vestimenta": {
        "name": "Vestimenta", 
        "subcategories": ["Ropa", "Calzado", "Accesorios"],
        "deductible": True, 
        "limit_percentage": 0.325,
        "limit_usd": 3868.15,
        "description": "Ropa y calzado adquiridos en Ecuador"
    },
    "turismo": {
        "name": "Turismo Nacional",
        "subcategories": ["Hoteles Ecuador", "Tours locales", "Transporte turístico"],
        "deductible": True,
        "limit_percentage": 0.325,
        "limit_usd": 3868.15,
        "description": "Turismo dentro de Ecuador (hoteles, tours)"
    },
    "transporte": {
        "name": "Transporte", 
        "subcategories": ["Carros", "Combustible", "Mantenimiento vehicular", "Taxi", "Bus"],
        "deductible": False, 
        "limit_percentage": 0,
        "limit_usd": 0,
        "description": "NO DEDUCIBLE - Transporte personal"
    },
    "viajes_internacionales": {
        "name": "Viajes Internacionales", 
        "subcategories": ["USA", "Europa", "Otros países"],
        "deductible": False, 
        "limit_percentage": 0,
        "limit_usd": 0,
        "description": "NO DEDUCIBLE - Gastos en el exterior"
    },
    "otros": {
        "name": "Otros", 
        "subcategories": ["Empleados", "Entretenimiento", "Varios"],
        "deductible": False, 
        "limit_percentage": 0,
        "limit_usd": 0,
        "description": "NO DEDUCIBLE - Gastos varios"
    }
}

# Payment sources
PAYMENT_SOURCES = ["local", "internacional"]  # tarjeta local vs tarjeta extranjera

# Income Sources
INCOME_SOURCES = ["Personal", "APX", "USA"]

# Countries considered international
INTERNATIONAL_COUNTRIES = ["USA", "United States", "Estados Unidos", "US", "EU", "Europa", "Spain", "España", "Colombia", "Peru", "Perú", "México", "Mexico", "Miami", "New York", "Los Angeles", "Houston", "Texas", "California", "Florida"]

# Datos del contribuyente (extraídos del RUC)
CONTRIBUYENTE_INFO = {
    "ruc": "0912514890001",
    "nombre": "ARAUZ TRIVIÑO EMILIO JOSE",
    "tipo": "PERSONA NATURAL",
    "regimen": "GENERAL",
    "obligado_contabilidad": False,
    "actividad_principal": "SERVICIOS DE MARKETING Y PUBLICIDAD",
    "jurisdiccion": "ZONA 8 / GUAYAS / SAMBORONDON",
    "cargas_familiares": 3,  # 2 hijos menores + esposa
    "cargas_detalle": [
        {"tipo": "conyuge", "nombre": "Esposa"},
        {"tipo": "hijo", "nombre": "Hijo 1"},
        {"tipo": "hijo", "nombre": "Hijo 2"}
    ]
}

# ================= AUTO-CATEGORIZATION RULES =================
# Reglas automáticas de categorización (estilo QuickBooks)
DEFAULT_CATEGORIZATION_RULES = [
    # Alimentación - Supermercados y restaurantes Ecuador
    {"keywords": ["supermaxi", "mi comisariato", "megamaxi", "tia", "aki", "gran aki", "coral"], "category": "alimentacion", "subcategory": "Supermercado"},
    {"keywords": ["mcdonalds", "mcdonald's", "burger king", "kfc", "pollo", "pizza hut", "dominos", "subway", "juan valdez", "sweet & coffee"], "category": "alimentacion", "subcategory": "Restaurantes"},
    {"keywords": ["mercado", "feria", "verduras", "frutas", "carniceria", "panaderia"], "category": "alimentacion", "subcategory": "Comida"},
    
    # Salud
    {"keywords": ["farmacia", "fybeca", "pharmacy", "medicity", "cruz azul", "sana sana", "economicas"], "category": "salud", "subcategory": "Medicina"},
    {"keywords": ["hospital", "clinica", "consultorio", "medico", "doctor", "laboratorio", "examen"], "category": "salud", "subcategory": "Consultas"},
    {"keywords": ["seguro medico", "seguros", "salud sa", "bmi", "humana", "saludsa", "ecuasanitas"], "category": "salud", "subcategory": "Seguros"},
    
    # Educación
    {"keywords": ["colegio", "escuela", "liceo", "unidad educativa", "academia"], "category": "educacion", "subcategory": "Colegio y actividades"},
    {"keywords": ["universidad", "uees", "espol", "ucsg", "usfq", "udla", "maestria", "postgrado"], "category": "educacion", "subcategory": "Universidad"},
    {"keywords": ["curso", "capacitacion", "udemy", "coursera", "platzi", "taller"], "category": "educacion", "subcategory": "Cursos"},
    {"keywords": ["libreria", "libro", "papeleria", "utiles"], "category": "educacion", "subcategory": "Materiales"},
    
    # Vivienda
    {"keywords": ["luz", "electrica", "cnel", "energia"], "category": "vivienda", "subcategory": "Servicios básicos"},
    {"keywords": ["agua potable", "interagua", "emapag"], "category": "vivienda", "subcategory": "Servicios básicos"},
    {"keywords": ["telefono", "cnt", "claro", "movistar", "internet", "netlife", "tv cable"], "category": "vivienda", "subcategory": "Servicios básicos"},
    {"keywords": ["arriendo", "alquiler", "renta mensual"], "category": "vivienda", "subcategory": "Arriendo"},
    {"keywords": ["hipoteca", "credito hipotecario", "banco vivienda"], "category": "vivienda", "subcategory": "Intereses hipoteca"},
    
    # Vestimenta
    {"keywords": ["zara", "h&m", "forever 21", "mango", "tennis", "etafashion", "de prati", "ri", "payless"], "category": "vestimenta", "subcategory": "Ropa"},
    {"keywords": ["marathon", "nike", "adidas", "puma", "calzado", "zapatos"], "category": "vestimenta", "subcategory": "Calzado"},
    
    # Transporte (NO deducible)
    {"keywords": ["gasolina", "diesel", "primax", "mobil", "petroecuador", "terpel", "combustible"], "category": "transporte", "subcategory": "Combustible"},
    {"keywords": ["mecanica", "taller", "llantas", "aceite motor", "repuestos"], "category": "transporte", "subcategory": "Mantenimiento vehicular"},
    {"keywords": ["uber", "cabify", "taxi", "indriver"], "category": "transporte", "subcategory": "Taxi"},
    
    # Turismo Nacional
    {"keywords": ["hotel ecuador", "hostal", "airbnb ecuador", "decameron", "hilton colon"], "category": "turismo", "subcategory": "Hoteles Ecuador"},
    
    # Viajes Internacionales (NO deducible)
    {"keywords": ["amazon.com", "ebay", "aliexpress", "wish", "shein"], "category": "viajes_internacionales", "subcategory": "USA"},
    {"keywords": ["booking.com internacional", "expedia", "hotel usa", "hotel miami"], "category": "viajes_internacionales", "subcategory": "USA"},
    
    # Otros (NO deducible)
    {"keywords": ["netflix", "spotify", "disney", "hbo", "prime video", "youtube premium"], "category": "otros", "subcategory": "Entretenimiento"},
    {"keywords": ["empleada", "domestico", "jardinero", "limpieza casa"], "category": "otros", "subcategory": "Empleados"},
]

def apply_categorization_rules(description: str, establishment: str = "") -> dict:
    """Apply automatic categorization rules based on keywords"""
    text = f"{description} {establishment}".lower()
    
    for rule in DEFAULT_CATEGORIZATION_RULES:
        for keyword in rule["keywords"]:
            if keyword.lower() in text:
                return {
                    "category": rule["category"],
                    "subcategory": rule["subcategory"],
                    "auto_categorized": True,
                    "matched_keyword": keyword
                }
    
    return {"category": None, "subcategory": None, "auto_categorized": False, "matched_keyword": None}

# Transaction Status (inspirado en QuickBooks)
class TransactionStatus:
class TransactionStatus:
    PENDING_REVIEW = "pending_review"  # Pendiente de revisión por contadora
    APPROVED = "approved"  # Aprobado/conciliado
    REJECTED = "rejected"  # Rechazado (error o inválido)
    DUPLICATE_SUSPECT = "duplicate_suspect"  # Sospecha de duplicado
    DUPLICATE_CONFIRMED = "duplicate_confirmed"  # Confirmado como duplicado (no contar)

# Source Type (de dónde viene la transacción)
class SourceType:
    MANUAL = "manual"  # Ingresado manualmente
    EMAIL = "email"  # Desde email de tarjeta
    RECEIPT = "receipt"  # Desde foto de recibo
    INVOICE = "invoice"  # Desde factura
    EXCEL = "excel"  # Desde Excel
    BANK_STATEMENT = "bank_statement"  # Desde estado de cuenta

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
    # Nuevos campos para conciliación (estilo QuickBooks)
    status: str = TransactionStatus.PENDING_REVIEW  # Estado de revisión
    source_type: str = SourceType.MANUAL  # De dónde viene la transacción
    has_receipt: bool = False  # Tiene recibo/foto
    has_invoice: bool = False  # Tiene factura electrónica
    invoice_number: Optional[str] = None  # Número de factura
    notes: Optional[str] = None  # Notas adicionales
    reviewed_by: Optional[str] = None  # ID del usuario que revisó
    reviewed_at: Optional[str] = None  # Fecha de revisión
    duplicate_of: Optional[str] = None  # ID de la transacción original si es duplicado
    match_confidence: Optional[float] = None  # Confianza de match (0-100)

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
    return {
        "categories": SRI_CATEGORIES, 
        "income_sources": INCOME_SOURCES,
        "payment_sources": PAYMENT_SOURCES,
        "international_countries": INTERNATIONAL_COUNTRIES,
        "canasta_basica": CANASTA_BASICA,
        "fraccion_basica_exenta": FRACCION_BASICA_EXENTA,
        "contribuyente": CONTRIBUYENTE_INFO
    }

@api_router.get("/sri/deduction-limits")
async def get_sri_deduction_limits(
    cargas_familiares: int = 0,
    user: dict = Depends(get_current_user)
):
    """Get SRI deduction limits based on family dependents"""
    # Get current year transactions
    now = datetime.now(timezone.utc)
    start_of_year = f"{now.year}-01-01"
    
    transactions = await db.transactions.find(
        {"user_id": user["id"], "date": {"$gte": start_of_year}, "transaction_type": "expense"},
        {"_id": 0}
    ).to_list(10000)
    
    # Calculate spent by category
    spent_by_category = {}
    total_deductible = 0
    total_non_deductible = 0
    
    for t in transactions:
        cat = t.get("category", "otros")
        amount = t.get("amount", 0)
        
        if cat not in spent_by_category:
            spent_by_category[cat] = 0
        spent_by_category[cat] += amount
        
        if SRI_CATEGORIES.get(cat, {}).get("deductible", False):
            total_deductible += amount
        else:
            total_non_deductible += amount
    
    # Calculate limits
    cargas = min(cargas_familiares, 5)
    num_cbf = CARGAS_FAMILIARES_CBF.get(cargas, 7)
    limite_global = num_cbf * CANASTA_BASICA
    
    # Calculate progress for each category
    category_progress = []
    for cat_key, cat_info in SRI_CATEGORIES.items():
        if cat_info.get("deductible", False):
            spent = spent_by_category.get(cat_key, 0)
            limit = cat_info.get("limit_usd", 0)
            percentage = (spent / limit * 100) if limit > 0 else 0
            
            category_progress.append({
                "category": cat_key,
                "name": cat_info["name"],
                "spent": round(spent, 2),
                "limit": limit,
                "percentage": round(min(percentage, 100), 1),
                "remaining": round(max(0, limit - spent), 2),
                "over_limit": spent > limit,
                "description": cat_info.get("description", "")
            })
    
    # Sort by percentage (highest first)
    category_progress.sort(key=lambda x: x["percentage"], reverse=True)
    
    # Calculate potential tax rebate
    gastos_aplicables = min(total_deductible, limite_global)
    rebaja_ir = gastos_aplicables * PORCENTAJE_REBAJA_IR
    
    return {
        "year": now.year,
        "contribuyente": CONTRIBUYENTE_INFO,
        "cargas_familiares": cargas_familiares,
        "canasta_basica": CANASTA_BASICA,
        "fraccion_basica_exenta": FRACCION_BASICA_EXENTA,
        "limite_global": round(limite_global, 2),
        "total_deductible_spent": round(total_deductible, 2),
        "total_non_deductible_spent": round(total_non_deductible, 2),
        "gastos_aplicables": round(gastos_aplicables, 2),
        "rebaja_ir_estimada": round(rebaja_ir, 2),
        "porcentaje_rebaja": PORCENTAJE_REBAJA_IR * 100,
        "percentage_used": round((total_deductible / limite_global * 100) if limite_global > 0 else 0, 1),
        "remaining_global": round(max(0, limite_global - total_deductible), 2),
        "category_progress": category_progress,
        "alerts": _generate_sri_alerts(category_progress, total_deductible, limite_global)
    }

def _generate_sri_alerts(category_progress, total_deductible, limite_global):
    """Generate alerts for SRI deductions"""
    alerts = []
    
    # Check global limit
    if total_deductible >= limite_global * 0.9:
        alerts.append({
            "type": "warning",
            "message": f"Has usado el 90% de tu límite global de deducciones (${limite_global:,.2f})"
        })
    
    # Check individual categories
    for cat in category_progress:
        if cat["percentage"] >= 100:
            alerts.append({
                "type": "error",
                "message": f"LÍMITE EXCEDIDO en {cat['name']}: ${cat['spent']:,.2f} de ${cat['limit']:,.2f}"
            })
        elif cat["percentage"] >= 80:
            alerts.append({
                "type": "warning", 
                "message": f"{cat['name']}: {cat['percentage']}% del límite usado. Quedan ${cat['remaining']:,.2f}"
            })
    
    return alerts

# ================= DUPLICATE DETECTION =================

async def find_potential_duplicates(user_id: str, amount: float, date: str, establishment: str = None, description: str = None):
    """Find potential duplicate transactions (estilo QuickBooks)"""
    # Search for transactions with same amount within 7 days
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    date_start = (date_obj - timedelta(days=7)).strftime("%Y-%m-%d")
    date_end = (date_obj + timedelta(days=7)).strftime("%Y-%m-%d")
    
    query = {
        "user_id": user_id,
        "amount": {"$gte": amount * 0.95, "$lte": amount * 1.05},  # 5% tolerance
        "date": {"$gte": date_start, "$lte": date_end},
        "status": {"$nin": [TransactionStatus.DUPLICATE_CONFIRMED, TransactionStatus.REJECTED]}
    }
    
    potential_duplicates = await db.transactions.find(query, {"_id": 0}).to_list(10)
    
    duplicates = []
    for t in potential_duplicates:
        confidence = 50  # Base confidence for same amount + date range
        
        # Increase confidence based on matching fields
        if establishment and t.get("establishment"):
            if establishment.lower() in t["establishment"].lower() or t["establishment"].lower() in establishment.lower():
                confidence += 30
        
        if description and t.get("description"):
            # Simple word matching
            words1 = set(description.lower().split())
            words2 = set(t["description"].lower().split())
            common_words = words1.intersection(words2)
            if len(common_words) >= 2:
                confidence += 20
        
        # Exact amount match
        if t.get("amount") == amount:
            confidence += 10
        
        if confidence >= 60:  # Threshold for flagging
            duplicates.append({
                "transaction": t,
                "confidence": min(confidence, 100)
            })
    
    return duplicates

# ================= TRANSACTIONS ENDPOINTS =================

@api_router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(
    transaction: TransactionCreate,
    user: dict = Depends(get_current_user)
):
    transaction_id = str(uuid.uuid4())
    
    # Check for potential duplicates
    duplicates = await find_potential_duplicates(
        user["id"], 
        transaction.amount, 
        transaction.date,
        transaction.establishment,
        transaction.description
    )
    
    # Determine initial status
    initial_status = transaction.status
    duplicate_of = None
    match_confidence = None
    
    if duplicates:
        # Mark as duplicate suspect
        initial_status = TransactionStatus.DUPLICATE_SUSPECT
        duplicate_of = duplicates[0]["transaction"]["id"]
        match_confidence = duplicates[0]["confidence"]
    
    # Check if international based on country
    is_international = transaction.is_international
    if transaction.country:
        is_international = any(c.lower() in transaction.country.lower() for c in INTERNATIONAL_COUNTRIES)
    
    # Determine deductibility
    category = transaction.category
    if is_international and transaction.transaction_type == "expense":
        category = "viajes_internacionales"
    
    is_deductible = SRI_CATEGORIES.get(category, {}).get("deductible", False) and not is_international
    
    doc = {
        "id": transaction_id,
        "user_id": user["id"],
        **transaction.model_dump(),
        "category": category,
        "is_international": is_international,
        "is_deductible": is_deductible,
        "status": initial_status,
        "duplicate_of": duplicate_of,
        "match_confidence": match_confidence,
        "ai_classified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(doc)
    
    response_doc = {k: v for k, v in doc.items() if k != "_id"}
    
    # Add duplicate warning to response
    if duplicates:
        response_doc["_duplicate_warning"] = {
            "message": "Posible duplicado detectado",
            "potential_match": duplicates[0]["transaction"]["id"],
            "confidence": match_confidence
        }
    
    return TransactionResponse(**response_doc)

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

@api_router.post("/process/receipts-multiple")
async def process_multiple_receipts(
    files: List[UploadFile] = File(...),
    user: dict = Depends(get_current_user)
):
    """Process multiple receipt images with OCR"""
    all_transactions = []
    errors = []
    
    for file in files:
        temp_dir = tempfile.mkdtemp()
        file_path = os.path.join(temp_dir, file.filename)
        
        try:
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            result = await process_image_with_ai(file_path)
            
            for t in result.get("transactions", []):
                # Check if international
                country = t.get("country", "Ecuador")
                is_international = any(c.lower() in country.lower() for c in INTERNATIONAL_COUNTRIES) if country else False
                category = "viajes_internacionales" if is_international else t.get("category", "otros")
                is_deductible = SRI_CATEGORIES.get(category, {}).get("deductible", False)
                
                amount = t.get("amount", 0)
                date = t.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
                establishment = t.get("establishment", "")
                description = t.get("description", "")
                
                # Check for duplicates
                duplicates = await find_potential_duplicates(user["id"], amount, date, establishment, description)
                
                transaction_id = str(uuid.uuid4())
                doc = {
                    "id": transaction_id,
                    "user_id": user["id"],
                    "amount": amount,
                    "description": description,
                    "category": category,
                    "subcategory": t.get("subcategory", "Varios"),
                    "date": date,
                    "transaction_type": "expense",
                    "establishment": establishment,
                    "country": country,
                    "is_international": is_international,
                    "payment_source": "internacional" if is_international else "local",
                    "is_deductible": is_deductible,
                    "ai_classified": True,
                    "status": TransactionStatus.DUPLICATE_SUSPECT if duplicates else TransactionStatus.PENDING_REVIEW,
                    "source_type": SourceType.RECEIPT,
                    "has_receipt": True,
                    "duplicate_of": duplicates[0]["transaction"]["id"] if duplicates else None,
                    "match_confidence": duplicates[0]["confidence"] if duplicates else None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "source_file": file.filename
                }
                await db.transactions.insert_one(doc)
                all_transactions.append({k: v for k, v in doc.items() if k != "_id"})
        except Exception as e:
            errors.append({"file": file.filename, "error": str(e)})
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)
            if os.path.exists(temp_dir):
                os.rmdir(temp_dir)
    
    return {
        "message": f"Procesados {len(files)} archivos, {len(all_transactions)} transacciones creadas",
        "transactions": all_transactions,
        "errors": errors
    }

@api_router.get("/transactions/international")
async def get_international_transactions(
    user: dict = Depends(get_current_user)
):
    """Get all international transactions"""
    transactions = await db.transactions.find(
        {"user_id": user["id"], "is_international": True},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    return {"transactions": transactions}

@api_router.get("/transactions/by-payment-source")
async def get_transactions_by_payment_source(
    payment_source: str = "internacional",
    user: dict = Depends(get_current_user)
):
    """Get transactions by payment source (local or internacional)"""
    transactions = await db.transactions.find(
        {"user_id": user["id"], "payment_source": payment_source},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    return {"transactions": transactions, "payment_source": payment_source}

@api_router.get("/budget/suggestions")
async def get_budget_suggestions(user: dict = Depends(get_current_user)):
    """Get AI-powered budget adjustment suggestions based on historical data"""
    # Get last 6 months of transactions
    now = datetime.now(timezone.utc)
    six_months_ago = (now - timedelta(days=180)).strftime("%Y-%m-%d")
    
    transactions = await db.transactions.find(
        {"user_id": user["id"], "date": {"$gte": six_months_ago}, "transaction_type": "expense"},
        {"_id": 0}
    ).to_list(5000)
    
    if len(transactions) < 10:
        return {"suggestions": [], "message": "Necesitas más transacciones para obtener sugerencias (mínimo 10)"}
    
    # Calculate monthly averages by category
    monthly_data = {}
    for t in transactions:
        month = t["date"][:7]
        cat = t["category"]
        if month not in monthly_data:
            monthly_data[month] = {}
        if cat not in monthly_data[month]:
            monthly_data[month][cat] = 0
        monthly_data[month][cat] += t["amount"]
    
    # Calculate averages and trends
    category_stats = {}
    for month, cats in monthly_data.items():
        for cat, amount in cats.items():
            if cat not in category_stats:
                category_stats[cat] = {"amounts": [], "total": 0}
            category_stats[cat]["amounts"].append(amount)
            category_stats[cat]["total"] += amount
    
    # Get current budget
    budget = await db.budgets.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)])
    budget_by_cat = {}
    if budget:
        for item in budget.get("items", []):
            cat = item["category"]
            budget_by_cat[cat] = budget_by_cat.get(cat, 0) + item["planned_amount"]
    
    suggestions = []
    for cat, stats in category_stats.items():
        avg = sum(stats["amounts"]) / len(stats["amounts"])
        current_budget = budget_by_cat.get(cat, 0)
        cat_info = SRI_CATEGORIES.get(cat, {"name": cat, "deductible": False})
        
        # Check if consistently over or under budget
        if current_budget > 0:
            ratio = avg / current_budget
            if ratio > 1.2:  # 20% over budget consistently
                suggestions.append({
                    "category": cat,
                    "category_name": cat_info["name"],
                    "type": "increase",
                    "current_budget": current_budget,
                    "suggested_budget": round(avg * 1.1, 2),
                    "average_spending": round(avg, 2),
                    "reason": f"Gastas en promedio ${avg:.2f}/mes, 20% más que tu presupuesto de ${current_budget:.2f}",
                    "is_deductible": cat_info.get("deductible", False)
                })
            elif ratio < 0.6:  # 40% under budget consistently
                suggestions.append({
                    "category": cat,
                    "category_name": cat_info["name"],
                    "type": "decrease",
                    "current_budget": current_budget,
                    "suggested_budget": round(avg * 1.2, 2),
                    "average_spending": round(avg, 2),
                    "reason": f"Gastas en promedio ${avg:.2f}/mes, mucho menos que tu presupuesto de ${current_budget:.2f}",
                    "is_deductible": cat_info.get("deductible", False)
                })
        elif avg > 50:  # No budget set but significant spending
            suggestions.append({
                "category": cat,
                "category_name": cat_info["name"],
                "type": "new",
                "current_budget": 0,
                "suggested_budget": round(avg * 1.1, 2),
                "average_spending": round(avg, 2),
                "reason": f"No tienes presupuesto para {cat_info['name']} pero gastas ${avg:.2f}/mes en promedio",
                "is_deductible": cat_info.get("deductible", False)
            })
    
    # Sort by impact (difference between current and suggested)
    suggestions.sort(key=lambda x: abs(x["suggested_budget"] - x["current_budget"]), reverse=True)
    
    return {"suggestions": suggestions[:10], "months_analyzed": len(monthly_data)}

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

# ================= RECONCILIATION ENDPOINTS (CONTADORA) =================

@api_router.get("/reconciliation/pending")
async def get_pending_reconciliation(
    user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))
):
    """Get all transactions pending review - Vista Contadora"""
    # Get transactions that need review
    transactions = await db.transactions.find(
        {"status": {"$in": [TransactionStatus.PENDING_REVIEW, TransactionStatus.DUPLICATE_SUSPECT]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Group by status
    pending_review = [t for t in transactions if t.get("status") == TransactionStatus.PENDING_REVIEW]
    duplicate_suspects = [t for t in transactions if t.get("status") == TransactionStatus.DUPLICATE_SUSPECT]
    
    # Get stats
    total_pending_amount = sum(t.get("amount", 0) for t in pending_review)
    total_duplicate_amount = sum(t.get("amount", 0) for t in duplicate_suspects)
    
    return {
        "pending_review": pending_review,
        "duplicate_suspects": duplicate_suspects,
        "stats": {
            "total_pending": len(pending_review),
            "total_duplicates": len(duplicate_suspects),
            "pending_amount": total_pending_amount,
            "duplicate_amount": total_duplicate_amount
        }
    }

@api_router.get("/reconciliation/duplicates")
async def get_duplicate_pairs(
    user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))
):
    """Get duplicate transaction pairs for review"""
    duplicates = await db.transactions.find(
        {"status": TransactionStatus.DUPLICATE_SUSPECT, "duplicate_of": {"$ne": None}},
        {"_id": 0}
    ).to_list(100)
    
    pairs = []
    for dup in duplicates:
        original = await db.transactions.find_one(
            {"id": dup.get("duplicate_of")},
            {"_id": 0}
        )
        if original:
            pairs.append({
                "duplicate": dup,
                "original": original,
                "confidence": dup.get("match_confidence", 0),
                "amount_match": dup.get("amount") == original.get("amount"),
                "date_diff_days": abs((datetime.strptime(dup.get("date", "2000-01-01"), "%Y-%m-%d") - 
                                      datetime.strptime(original.get("date", "2000-01-01"), "%Y-%m-%d")).days)
            })
    
    return {"pairs": pairs}

@api_router.put("/reconciliation/approve/{transaction_id}")
async def approve_transaction(
    transaction_id: str,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))
):
    """Approve a transaction (mark as reconciled)"""
    update_data = {
        "status": TransactionStatus.APPROVED,
        "reviewed_by": user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Allow category correction
    if category:
        update_data["category"] = category
        update_data["is_deductible"] = SRI_CATEGORIES.get(category, {}).get("deductible", False)
    if subcategory:
        update_data["subcategory"] = subcategory
    
    result = await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    
    return {"message": "Transacción aprobada", "status": TransactionStatus.APPROVED}

@api_router.put("/reconciliation/reject/{transaction_id}")
async def reject_transaction(
    transaction_id: str,
    reason: Optional[str] = None,
    user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))
):
    """Reject a transaction (mark as invalid)"""
    result = await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": TransactionStatus.REJECTED,
            "reviewed_by": user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "notes": reason or "Rechazado por contadora"
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    
    return {"message": "Transacción rechazada", "status": TransactionStatus.REJECTED}

@api_router.put("/reconciliation/confirm-duplicate/{transaction_id}")
async def confirm_duplicate(
    transaction_id: str,
    keep_original: bool = True,
    user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))
):
    """Confirm a transaction as duplicate"""
    # Get the duplicate transaction
    dup_tx = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not dup_tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    
    if keep_original:
        # Mark this one as confirmed duplicate (won't count in totals)
        await db.transactions.update_one(
            {"id": transaction_id},
            {"$set": {
                "status": TransactionStatus.DUPLICATE_CONFIRMED,
                "reviewed_by": user["id"],
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "notes": "Confirmado como duplicado - no se cuenta en totales"
            }}
        )
        # Update original to have receipt/invoice
        if dup_tx.get("duplicate_of"):
            await db.transactions.update_one(
                {"id": dup_tx["duplicate_of"]},
                {"$set": {
                    "has_receipt": dup_tx.get("has_receipt", False) or True,
                    "has_invoice": dup_tx.get("has_invoice", False) or True
                }}
            )
    else:
        # Keep the duplicate, reject the original
        if dup_tx.get("duplicate_of"):
            await db.transactions.update_one(
                {"id": dup_tx["duplicate_of"]},
                {"$set": {
                    "status": TransactionStatus.DUPLICATE_CONFIRMED,
                    "reviewed_by": user["id"],
                    "reviewed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        # Approve this one
        await db.transactions.update_one(
            {"id": transaction_id},
            {"$set": {
                "status": TransactionStatus.APPROVED,
                "duplicate_of": None,
                "reviewed_by": user["id"],
                "reviewed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {"message": "Duplicado procesado", "kept_original": keep_original}

@api_router.put("/reconciliation/not-duplicate/{transaction_id}")
async def mark_not_duplicate(
    transaction_id: str,
    user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))
):
    """Mark a transaction as NOT a duplicate (false positive)"""
    result = await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": TransactionStatus.APPROVED,
            "duplicate_of": None,
            "match_confidence": None,
            "reviewed_by": user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "notes": "Revisado - no es duplicado"
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    
    return {"message": "Marcado como no duplicado", "status": TransactionStatus.APPROVED}

@api_router.put("/reconciliation/bulk-approve")
async def bulk_approve_transactions(
    transaction_ids: List[str],
    user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))
):
    """Bulk approve multiple transactions"""
    result = await db.transactions.update_many(
        {"id": {"$in": transaction_ids}},
        {"$set": {
            "status": TransactionStatus.APPROVED,
            "reviewed_by": user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"{result.modified_count} transacciones aprobadas"}

@api_router.get("/reconciliation/stats")
async def get_reconciliation_stats(
    user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))
):
    """Get reconciliation statistics"""
    # Count by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total_amount": {"$sum": "$amount"}}}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(10)
    
    stats = {
        "pending_review": 0,
        "approved": 0,
        "rejected": 0,
        "duplicate_suspect": 0,
        "duplicate_confirmed": 0,
        "total_pending_amount": 0,
        "total_approved_amount": 0
    }
    
    for r in results:
        status = r["_id"] or "pending_review"
        if status == TransactionStatus.PENDING_REVIEW:
            stats["pending_review"] = r["count"]
            stats["total_pending_amount"] = r["total_amount"]
        elif status == TransactionStatus.APPROVED:
            stats["approved"] = r["count"]
            stats["total_approved_amount"] = r["total_amount"]
        elif status == TransactionStatus.REJECTED:
            stats["rejected"] = r["count"]
        elif status == TransactionStatus.DUPLICATE_SUSPECT:
            stats["duplicate_suspect"] = r["count"]
        elif status == TransactionStatus.DUPLICATE_CONFIRMED:
            stats["duplicate_confirmed"] = r["count"]
    
    return stats

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
