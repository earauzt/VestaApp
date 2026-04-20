from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from enum import Enum


# ================= USER ROLES =================
class UserRole:
    ADMIN = "admin"
    ACCOUNTANT = "accountant"
    SPOUSE = "spouse"


# ================= TRANSACTION STATUS =================
class TransactionStatus:
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    DUPLICATE_SUSPECT = "duplicate_suspect"
    DUPLICATE_CONFIRMED = "duplicate_confirmed"


class SourceType:
    MANUAL = "manual"
    EMAIL = "email"
    RECEIPT = "receipt"
    INVOICE = "invoice"
    EXCEL = "excel"
    BANK_STATEMENT = "bank_statement"


# ================= ENUMS =================
class StatementType(str, Enum):
    CREDIT_CARD = "credit_card"
    BANK_ACCOUNT = "bank_account"


class BankName(str, Enum):
    DINERS = "diners"
    PICHINCHA = "pichincha"
    PACIFICARD = "pacificard"
    APPLE_CARD = "apple_card"
    BANCO_PACIFICO = "banco_pacifico"
    BOLIVARIANO = "bolivariano"


class ReconciliationStatus(str, Enum):
    MATCHED = "matched"
    NEW = "new"
    NO_MATCH = "no_match"
    DUPLICATE = "duplicate"


# ================= SRI ECUADOR CONSTANTS =================
CANASTA_BASICA = 798.31
FRACCION_BASICA_EXENTA = 11902.00
CARGAS_FAMILIARES_CBF = {
    0: 7, 1: 9, 2: 11, 3: 13, 4: 15, 5: 17,
}
PORCENTAJE_REBAJA_IR = 0.18

SRI_CATEGORIES = {
    "alimentacion": {
        "name": "Alimentacion",
        "subcategories": ["Comida", "Restaurantes", "Supermercado", "Mercado"],
        "deductible": True,
        "limit_percentage": 0.325,
        "limit_usd": 3868.15,
        "description": "Compras de alimentos, restaurantes, supermercados"
    },
    "salud": {
        "name": "Salud",
        "subcategories": ["Seguros", "Medicina", "Consultas", "Hospitalizacion", "Laboratorio"],
        "deductible": True,
        "limit_percentage": 1.3,
        "limit_usd": 15472.60,
        "description": "Consultas medicas, medicinas, seguros de salud, hospitalizacion"
    },
    "educacion": {
        "name": "Educacion",
        "subcategories": ["Colegio y actividades", "Cursos", "Materiales", "Universidad", "Maestria"],
        "deductible": True,
        "limit_percentage": 0.325,
        "limit_usd": 3868.15,
        "description": "Matriculas, pensiones, utiles escolares, cursos, seminarios"
    },
    "vivienda": {
        "name": "Vivienda",
        "subcategories": ["Servicios basicos", "Arriendo", "Intereses hipoteca", "Mantenimiento"],
        "deductible": True,
        "limit_percentage": 0.325,
        "limit_usd": 3868.15,
        "description": "Arriendo, servicios basicos (agua, luz, telefono), intereses hipotecarios"
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
        "subcategories": ["Hoteles Ecuador", "Tours locales", "Transporte turistico"],
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
        "subcategories": ["USA", "Europa", "Otros paises"],
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

PAYMENT_METHODS = {
    "transferencia": {"name": "Transferencia", "keywords": ["transfer", "wire", "venmo", "zelle", "deposito", "banco"]},
    "tarjeta": {"name": "Tarjeta", "keywords": ["visa", "mastercard", "card", "tarjeta", "pacificard", "diners"]},
    "efectivo": {"name": "Efectivo", "keywords": ["cash", "efectivo", "contado"]},
    "venmo": {"name": "Venmo", "keywords": ["venmo"]},
    "apple_card": {"name": "Apple Card", "keywords": ["apple card", "apple pay", "apple cash"]}
}

PAYMENT_SOURCES = ["local", "internacional"]
INCOME_SOURCES = ["Personal", "APX", "USA"]
INCOME_CONCEPTS = ["Salario", "Bonus", "Dividendos", "Arriendo", "Honorarios", "Otros"]

INTERNATIONAL_COUNTRIES = [
    "USA", "United States", "Estados Unidos", "US", "EU", "Europa", "Spain",
    "Colombia", "Peru", "Mexico", "Miami", "New York", "Los Angeles",
    "Houston", "Texas", "California", "Florida"
]

SUBSCRIPTION_SERVICES = [
    "netflix", "spotify", "amazon prime", "disney", "hbo", "youtube",
    "apple music", "icloud", "google one", "dropbox", "adobe",
    "microsoft 365", "office 365", "chatgpt", "openai", "canva",
    "audible", "kindle", "paramount", "star+", "crunchyroll"
]

# ================= BUDGET CATEGORIES =================
BUDGET_CATEGORIES = {
    "servicios_basicos": {
        "name": "Servicios Basicos",
        "subcategories": {"Alicuota B": 500, "Alicuota GT": 100, "Luz": 200, "Gas": 15, "Celular": 80, "Agua": 60, "Clubes": 275, "Internet": 50, "Suscripciones": 0},
        "monthly_budget": 1280, "annual_budget": 15360, "type": "fixed",
        "payment_methods": ["transferencia", "tarjeta"], "is_recurring": True
    },
    "suscripciones": {
        "name": "Suscripciones",
        "subcategories": {"Netflix": 0, "Spotify": 0, "Amazon Prime": 0, "Disney+": 0, "YouTube Premium": 0, "iCloud": 0, "Otras": 0},
        "monthly_budget": 0, "annual_budget": 0, "type": "recurring",
        "payment_methods": ["tarjeta"], "is_recurring": True, "tags": ["recurrente", "suscripcion"]
    },
    "empleados": {
        "name": "Empleados",
        "subcategories": {"Ramona": 600, "Angelica": 550, "IESS": 150},
        "monthly_budget": 1300, "annual_budget": 15600, "type": "fixed",
        "payment_methods": ["transferencia", "efectivo"], "is_recurring": True
    },
    "colegio_actividades": {
        "name": "Colegio y Actividades",
        "subcategories": {"Menor": 2000, "Futbol": 150, "Telas Aros": 210},
        "monthly_budget": 2360, "annual_budget": 28320, "type": "fixed",
        "payment_methods": ["transferencia", "tarjeta", "efectivo"], "is_recurring": True
    },
    "seguros": {
        "name": "Seguros",
        "subcategories": {"Salud": 900, "Carros": 250},
        "monthly_budget": 1150, "annual_budget": 13800, "type": "fixed",
        "payment_methods": ["tarjeta", "transferencia"], "is_recurring": True
    },
    "comida": {
        "name": "Comida",
        "subcategories": {"Supermaxi": 800, "Mercado": 150},
        "monthly_budget": 950, "annual_budget": 11400, "type": "variable",
        "payment_methods": ["tarjeta", "efectivo"], "is_recurring": False
    },
    "restaurantes": {
        "name": "Restaurantes",
        "subcategories": {"Comida afuera": 350, "Delivery": 200},
        "monthly_budget": 550, "annual_budget": 6600, "type": "variable",
        "payment_methods": ["tarjeta", "efectivo"], "is_recurring": False
    },
    "carros": {
        "name": "Carros",
        "subcategories": {"Gasolina 1": 360, "Gasolina 2": 105, "Mantenimiento": 100},
        "monthly_budget": 565, "annual_budget": 6780, "type": "variable",
        "payment_methods": ["tarjeta", "efectivo"], "is_recurring": False
    },
    "usa": {
        "name": "USA",
        "subcategories": {"Mama (Venmo)": 600, "TMobile": 150, "Universidad": 400},
        "monthly_budget": 1150, "annual_budget": 13800, "type": "fixed",
        "payment_methods": ["venmo", "apple_card", "transferencia"], "is_recurring": True, "is_international": True
    },
    "viajes_entretenimiento": {
        "name": "Viajes y Entretenimiento",
        "subcategories": {"Hoteles": 3000, "Pasajes": 3000, "Comida": 2000, "Entretenimiento": 2000, "Ropa": 2000, "Tech": 1500, "Transporte": 1000, "Tours": 1000, "Otros": 1000},
        "monthly_budget": 0, "annual_budget": 16500, "type": "variable",
        "payment_methods": ["tarjeta", "apple_card", "efectivo"], "is_recurring": False,
        "notes": "Pasajes en Enero $500, Diciembre $3000. Navidad $7000 en Diciembre"
    },
    "gastos_libres": {
        "name": "Gastos Libres (Otros)",
        "subcategories": {"KP (Esposa)": 800, "EA (Emilio)": 500},
        "monthly_budget": 1300, "annual_budget": 15600, "type": "discretionary",
        "payment_methods": ["tarjeta", "efectivo"], "is_recurring": True
    }
}

INCOME_STRUCTURE = {
    "personal": {"monthly": 7250, "annual": 87000, "source": "Personal", "note": "Estimado variable"},
    "apx": {"monthly": 2500, "annual": 30000, "source": "APX", "note": "Estimado variable"},
    "usa": {"monthly": 2750, "annual": 33000, "source": "USA", "note": "Estimado variable"}
}
TOTAL_MONTHLY_INCOME = 12500
TOTAL_ANNUAL_INCOME = 150000

BUDGET_SUMMARY = {
    "total_gastos_fijos_monthly": 8155,
    "total_gastos_fijos_annual": 97860,
    "flujo_neto_mensual": 1595,
    "ahorro_esperado": {"monthly": 1250, "annual": 15000, "percentage": 10},
    "inversion_esperada": {"monthly": 1875, "annual": 22500, "percentage": 15}
}

BUDGET_GOALS = {
    "gastos_fijos_target": {"min": 0.55, "max": 0.65, "name": "Gastos Fijos"},
    "ahorro_target": {"min": 0.10, "max": 0.10, "name": "Ahorro"},
    "inversion_target": {"min": 0.15, "max": 0.15, "name": "Inversion"},
    "gastos_libres_max_annual": 30000
}

# ================= CONTRIBUYENTE INFO =================
CONTRIBUYENTE_INFO = {
    "ruc": "0912514890001",
    "nombre": "ARAUZ TRIVINO EMILIO JOSE",
    "tipo": "PERSONA NATURAL",
    "regimen": "GENERAL",
    "obligado_contabilidad": False,
    "actividad_principal": "SERVICIOS DE MARKETING Y PUBLICIDAD",
    "jurisdiccion": "ZONA 8 / GUAYAS / SAMBORONDON",
    "cargas_familiares": 3,
    "cargas_detalle": [
        {"tipo": "conyuge", "nombre": "Esposa"},
        {"tipo": "hijo", "nombre": "Hijo 1"},
        {"tipo": "hijo", "nombre": "Hijo 2"}
    ]
}

# ================= DEMO USER DATA =================
DEMO_BUDGET_CATEGORIES = {
    "servicios_basicos": {"name": "Servicios Basicos", "subcategories": {"Luz": 60, "Agua": 25, "Internet": 45, "Gas": 15}, "monthly_budget": 145, "annual_budget": 1740, "type": "fixed"},
    "comida": {"name": "Alimentacion", "subcategories": {"Supermercado": 300, "Mercado": 50}, "monthly_budget": 350, "annual_budget": 4200, "type": "variable"},
    "restaurantes": {"name": "Restaurantes", "subcategories": {"Restaurantes": 150, "Delivery": 50}, "monthly_budget": 200, "annual_budget": 2400, "type": "discretionary"},
    "transporte": {"name": "Transporte", "subcategories": {"Gasolina": 80, "Mantenimiento": 40}, "monthly_budget": 120, "annual_budget": 1440, "type": "variable"},
    "entretenimiento": {"name": "Entretenimiento", "subcategories": {"Streaming": 30, "Salidas": 70}, "monthly_budget": 100, "annual_budget": 1200, "type": "discretionary"},
    "otros": {"name": "Otros Gastos", "subcategories": {"Varios": 100}, "monthly_budget": 100, "annual_budget": 1200, "type": "discretionary"}
}
DEMO_INCOME_STRUCTURE = {"personal": {"monthly": 3500, "annual": 42000, "source": "Salario", "note": "Ingreso principal"}}
DEMO_BUDGET_SUMMARY = {"total_gastos_fijos_monthly": 1015, "total_gastos_fijos_annual": 12180, "flujo_neto_mensual": 2485, "ahorro_esperado": {"monthly": 350, "annual": 4200, "percentage": 10}, "inversion_esperada": {"monthly": 175, "annual": 2100, "percentage": 5}}
DEMO_BUDGET_GOALS = {"gastos_fijos_target": {"min": 0.25, "max": 0.35, "name": "Gastos Fijos"}, "ahorro_target": {"min": 0.10, "max": 0.10, "name": "Ahorro"}, "inversion_target": {"min": 0.05, "max": 0.05, "name": "Inversion"}, "gastos_libres_max_annual": 5000}
DEMO_CONTRIBUYENTE_INFO = {"ruc": "0900000000001", "nombre": "USUARIO DEMO", "tipo": "PERSONA NATURAL", "regimen": "RIMPE", "obligado_contabilidad": False, "actividad_principal": "SERVICIOS PROFESIONALES", "jurisdiccion": "GUAYAS / GUAYAQUIL", "cargas_familiares": 1, "cargas_detalle": [{"tipo": "conyuge", "nombre": "Conyuge Demo"}]}


def is_demo_user(user: dict) -> bool:
    return user.get("role") == "demo" or user.get("email") == "demo@fintrack.ec"

def get_budget_categories(user: dict):
    return DEMO_BUDGET_CATEGORIES if is_demo_user(user) else BUDGET_CATEGORIES

def get_income_structure(user: dict):
    return DEMO_INCOME_STRUCTURE if is_demo_user(user) else INCOME_STRUCTURE

def get_budget_summary(user: dict):
    return DEMO_BUDGET_SUMMARY if is_demo_user(user) else BUDGET_SUMMARY

def get_budget_goals(user: dict):
    return DEMO_BUDGET_GOALS if is_demo_user(user) else BUDGET_GOALS

def get_contribuyente_info(user: dict):
    return DEMO_CONTRIBUYENTE_INFO if is_demo_user(user) else CONTRIBUYENTE_INFO


# ================= AUTO-CATEGORIZATION RULES =================
DEFAULT_CATEGORIZATION_RULES = [
    {"keywords": ["supermaxi", "mi comisariato", "megamaxi", "tia", "aki", "gran aki", "coral"], "category": "alimentacion", "subcategory": "Supermercado"},
    {"keywords": ["mcdonalds", "mcdonald's", "burger king", "kfc", "pollo", "pizza hut", "dominos", "subway", "juan valdez", "sweet & coffee"], "category": "alimentacion", "subcategory": "Restaurantes"},
    {"keywords": ["mercado", "feria", "verduras", "frutas", "carniceria", "panaderia"], "category": "alimentacion", "subcategory": "Comida"},
    {"keywords": ["farmacia", "fybeca", "pharmacy", "medicity", "cruz azul", "sana sana", "economicas"], "category": "salud", "subcategory": "Medicina"},
    {"keywords": ["hospital", "clinica", "consultorio", "medico", "doctor", "laboratorio", "examen"], "category": "salud", "subcategory": "Consultas"},
    {"keywords": ["seguro medico", "seguros", "salud sa", "bmi", "humana", "saludsa", "ecuasanitas"], "category": "salud", "subcategory": "Seguros"},
    {"keywords": ["colegio", "escuela", "liceo", "unidad educativa", "academia"], "category": "educacion", "subcategory": "Colegio y actividades"},
    {"keywords": ["universidad", "uees", "espol", "ucsg", "usfq", "udla", "maestria", "postgrado"], "category": "educacion", "subcategory": "Universidad"},
    {"keywords": ["curso", "capacitacion", "udemy", "coursera", "platzi", "taller"], "category": "educacion", "subcategory": "Cursos"},
    {"keywords": ["libreria", "libro", "papeleria", "utiles"], "category": "educacion", "subcategory": "Materiales"},
    {"keywords": ["luz", "electrica", "cnel", "energia"], "category": "vivienda", "subcategory": "Servicios basicos"},
    {"keywords": ["agua potable", "interagua", "emapag"], "category": "vivienda", "subcategory": "Servicios basicos"},
    {"keywords": ["telefono", "cnt", "claro", "movistar", "internet", "netlife", "tv cable"], "category": "vivienda", "subcategory": "Servicios basicos"},
    {"keywords": ["arriendo", "alquiler", "renta mensual"], "category": "vivienda", "subcategory": "Arriendo"},
    {"keywords": ["hipoteca", "credito hipotecario", "banco vivienda"], "category": "vivienda", "subcategory": "Intereses hipoteca"},
    {"keywords": ["zara", "h&m", "forever 21", "mango", "tennis", "etafashion", "de prati", "ri", "payless"], "category": "vestimenta", "subcategory": "Ropa"},
    {"keywords": ["marathon", "nike", "adidas", "puma", "calzado", "zapatos"], "category": "vestimenta", "subcategory": "Calzado"},
    {"keywords": ["gasolina", "diesel", "primax", "mobil", "petroecuador", "terpel", "combustible"], "category": "transporte", "subcategory": "Combustible"},
    {"keywords": ["mecanica", "taller", "llantas", "aceite motor", "repuestos"], "category": "transporte", "subcategory": "Mantenimiento vehicular"},
    {"keywords": ["uber", "cabify", "taxi", "indriver"], "category": "transporte", "subcategory": "Taxi"},
    {"keywords": ["hotel ecuador", "hostal", "airbnb ecuador", "decameron", "hilton colon"], "category": "turismo", "subcategory": "Hoteles Ecuador"},
    {"keywords": ["amazon.com", "ebay", "aliexpress", "wish", "shein"], "category": "viajes_internacionales", "subcategory": "USA"},
    {"keywords": ["booking.com internacional", "expedia", "hotel usa", "hotel miami"], "category": "viajes_internacionales", "subcategory": "USA"},
    {"keywords": ["netflix", "spotify", "disney", "hbo", "prime video", "youtube premium"], "category": "otros", "subcategory": "Entretenimiento"},
    {"keywords": ["empleada", "domestico", "jardinero", "limpieza casa"], "category": "otros", "subcategory": "Empleados"},
]


def apply_categorization_rules(description: str, establishment: str = "") -> dict:
    text = f"{description} {establishment}".lower()
    for rule in DEFAULT_CATEGORIZATION_RULES:
        for keyword in rule["keywords"]:
            if keyword.lower() in text:
                return {"category": rule["category"], "subcategory": rule["subcategory"], "auto_categorized": True, "matched_keyword": keyword}
    return {"category": None, "subcategory": None, "auto_categorized": False, "matched_keyword": None}


def detect_payment_method(description: str, establishment: str = "") -> str:
    text = f"{description} {establishment}".lower()
    for method_key, method_info in PAYMENT_METHODS.items():
        for keyword in method_info["keywords"]:
            if keyword.lower() in text:
                return method_key
    return "tarjeta"


# ================= GMAIL CONSTANTS =================
GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
]
BANK_DOMAINS = [
    "pichincha.com", "bancoguayaquil.com", "pacifico.fin.ec",
    "produbanco.com", "internacional.fin.ec", "bolivariano.com", "diners.com.ec"
]
BANK_SENDERS = [
    "notificaciones@infopacificard.com.ec",
    "servicios@dinersclub.com.ec",
    "notifications@degeremcia.com"
]
DISCARD_SUBJECTS = [
    "oferta", "promocion", "sorteo", "puntos canjeables",
    "actualiza tus datos", "encuesta", "bienvenido"
]

SERVICE_DOMAINS = [
    "email.apple.com", "apple.com",
    "netflix.com",
    "spotify.com",
    "google.com", "youtube.com",
    "amazon.com",
    "adobe.com"
]

# ================= STATUS LABELS =================
STATUS_LABELS = {
    TransactionStatus.PENDING_REVIEW: "Pendiente",
    TransactionStatus.APPROVED: "Aprobado",
    TransactionStatus.REJECTED: "Rechazado",
    TransactionStatus.DUPLICATE_SUSPECT: "Posible Duplicado",
    TransactionStatus.DUPLICATE_CONFIRMED: "Duplicado"
}

# ================= PYDANTIC MODELS =================

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
    subcategory: Optional[str] = None
    date: str
    transaction_type: str = "expense"
    source: Optional[str] = None
    establishment: Optional[str] = None
    card_last_digits: Optional[str] = None
    country: Optional[str] = None
    is_international: bool = False
    payment_source: str = "local"
    is_deductible: bool = True
    status: str = TransactionStatus.PENDING_REVIEW
    source_type: str = SourceType.MANUAL
    has_receipt: bool = False
    has_invoice: bool = False
    invoice_number: Optional[str] = None
    notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    duplicate_of: Optional[str] = None
    match_confidence: Optional[float] = None
    is_split: bool = False
    parent_transaction_id: Optional[str] = None
    attachments: List[str] = []
    auto_categorized: bool = False
    matched_rule: Optional[str] = None
    payment_method: Optional[str] = None
    budget_category: Optional[str] = None
    receipt_group_id: Optional[str] = None
    linked_goal_id: Optional[str] = None
    linked_goal_name: Optional[str] = None
    # SRI factura ↔ consumo matching
    estado_sri: Optional[str] = None  # con_respaldo | match_aproximado | pendiente_match | sin_respaldo
    factura_vinculada_id: Optional[str] = None
    consumo_vinculado_id: Optional[str] = None
    match_aproximado_candidato_id: Optional[str] = None
    match_aproximado_confianza: Optional[float] = None
    match_pendiente_hasta: Optional[str] = None
    uso_empresarial: bool = False
    numero_factura: Optional[str] = None
    ruc_emisor: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    created_at: str
    ai_classified: bool = False

class SplitItem(BaseModel):
    amount: float
    category: str
    subcategory: str
    description: Optional[str] = None

class TransactionSplitRequest(BaseModel):
    transaction_id: str
    splits: List[SplitItem]

class CategorizationRule(BaseModel):
    keywords: List[str]
    category: str
    subcategory: str
    is_active: bool = True

class IncomeEntry(BaseModel):
    amount: float
    date: str
    distribution: str
    concept: str
    description: Optional[str] = None
    is_recurring: bool = False
    payment_method: Optional[str] = None

class IncomeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    amount: float
    date: str
    distribution: str
    concept: str
    description: Optional[str] = None
    is_recurring: bool
    payment_method: Optional[str] = None
    created_at: str

class BudgetItem(BaseModel):
    category: str
    subcategory: str
    planned_amount: float
    month: str

class BudgetResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    items: List[BudgetItem]
    total_income: float
    total_expenses: float
    created_at: str

class CreditCard(BaseModel):
    name: str
    bank: str
    apr: float
    credit_limit: float
    current_balance: float = 0
    minimum_payment: float = 0
    cut_off_day: int
    payment_due_day: int
    currency: str = "USD"
    is_international: bool = False

class CreditCardUpdate(BaseModel):
    name: Optional[str] = None
    bank: Optional[str] = None
    apr: Optional[float] = None
    credit_limit: Optional[float] = None
    current_balance: Optional[float] = None
    minimum_payment: Optional[float] = None
    cut_off_day: Optional[int] = None
    payment_due_day: Optional[int] = None
    currency: Optional[str] = None
    is_international: Optional[bool] = None

class CreditCardResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    name: str
    bank: str
    apr: float
    credit_limit: float
    current_balance: float
    minimum_payment: float
    available_credit: float
    cut_off_day: int
    payment_due_day: int
    currency: str
    is_international: bool
    created_at: str
    updated_at: Optional[str] = None

class DebtPayment(BaseModel):
    card_id: str
    amount: float
    date: str
    payment_type: str

class SnowballPlan(BaseModel):
    strategy: str
    extra_payment: float

class ScheduledPayment(BaseModel):
    name: str
    amount: float
    due_day: int
    category: str
    subcategory: Optional[str] = None
    payment_method: str
    is_recurring: bool = True
    reminder_days_before: int = 2
    minimum_amount: Optional[float] = None
    total_balance: Optional[float] = None
    card_name: Optional[str] = None

class ScheduledPaymentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    name: str
    amount: float
    due_day: int
    category: str
    subcategory: Optional[str] = None
    payment_method: str
    is_recurring: bool
    reminder_days_before: int
    minimum_amount: Optional[float] = None
    total_balance: Optional[float] = None
    card_name: Optional[str] = None
    last_paid_date: Optional[str] = None
    next_due_date: str
    created_at: str

class ExpectedIncomeCreate(BaseModel):
    description: str
    amount: float
    expected_date: str
    source: str = "personal"
    recurring: bool = False
    recurring_frequency: Optional[str] = None
    notes: Optional[str] = None

class ExpectedIncomeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    description: str
    amount: float
    expected_date: str
    source: str
    status: str
    recurring: bool
    recurring_frequency: Optional[str] = None
    linked_transaction_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: str

class AccountReceivableCreate(BaseModel):
    client_name: str
    invoice_number: Optional[str] = None
    amount: float
    invoice_date: str
    due_date: str
    notes: Optional[str] = None

class AccountReceivableResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    client_name: str
    invoice_number: Optional[str] = None
    amount: float
    amount_paid: float
    invoice_date: str
    due_date: str
    status: str
    notes: Optional[str] = None
    payment_history: List[dict] = []
    created_at: str

class TravelGoalCreate(BaseModel):
    destination: str
    target_amount: float
    target_date: str
    tipo: str = "viaje"
    notes: Optional[str] = None

class TravelGoalResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    destination: str
    target_amount: float
    saved_amount: float
    target_date: str
    tipo: str = "viaje"
    status: str
    notes: Optional[str] = None
    linked_transactions: List[str] = []
    total_spent: float = 0
    created_at: str

class DocumentUpload(BaseModel):
    document_type: str
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

class KnownVendorCreate(BaseModel):
    establishment: str
    personal_category: str
    sri_category: Optional[str] = None
    subcategory: Optional[str] = None
    is_deductible: bool = False

class KnownVendorResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    establishment: str
    personal_category: str
    sri_category: Optional[str] = None
    subcategory: Optional[str] = None
    is_deductible: bool
    times_used: int = 1
    match_count: int = 1
    aliases: List[str] = []
    source: Optional[str] = None
    last_used: str
    created_at: str

class StatementUploadResponse(BaseModel):
    statement_id: str
    statement_type: str
    bank_name: str
    period: str
    total_transactions: int
    matched: int
    new: int
    no_match: int
    card_info: Optional[Dict] = None
    transactions: List[Dict]

class ReconciliationResult(BaseModel):
    transaction_id: str
    status: str
    confidence: float
    matched_transaction_id: Optional[str] = None
    amount: float
    date: str
    description: str
    establishment: Optional[str] = None
    suggested_category: Optional[str] = None
    suggested_sri_category: Optional[str] = None

class DeferredPaymentModel(BaseModel):
    description: str
    total_amount: float
    monthly_payment: float
    remaining_installments: int
    total_installments: int
    card_id: Optional[str] = None
    card_name: Optional[str] = None
    start_date: Optional[str] = None

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
