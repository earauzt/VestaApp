"""
Script de datos iniciales para FinTrack Ecuador
Se ejecuta automáticamente al iniciar la app para asegurar que los datos base existan
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timezone
import os
import logging

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Datos del usuario admin
ADMIN_USER = {
    "id": "admin-emilio-001",
    "email": "earauzt@gmail.com",
    "name": "Emilio Arauz",
    "role": "admin",
    "created_at": "2026-01-01T00:00:00Z"
}
ADMIN_PASSWORD = "password123"

# Datos de las 4 tarjetas
CREDIT_CARDS = [
    {
        "id": "card-pacificard-black",
        "user_id": "admin-emilio-001",
        "name": "Pacificard Black",
        "bank": "Pacificard",
        "credit_limit": 15000.00,
        "current_balance": 27677.32,
        "minimum_payment": 1807.17,
        "available_credit": 0,
        "apr": 16.77,
        "statement_date": "2026-01-23",
        "due_date": "2026-02-09",
        "currency": "USD",
        "is_international": False
    },
    {
        "id": "card-pichincha-platinum",
        "user_id": "admin-emilio-001",
        "name": "Pichincha Platinum",
        "bank": "Banco Pichincha",
        "credit_limit": 40000.00,
        "current_balance": 2009.16,
        "minimum_payment": 1874.49,
        "available_credit": 34792.80,
        "apr": 16.77,
        "card_number_last4": "3223",
        "statement_date": "2026-01-24",
        "due_date": "2026-02-09",
        "currency": "USD",
        "is_international": False
    },
    {
        "id": "card-diners",
        "user_id": "admin-emilio-001",
        "name": "Diners Club",
        "bank": "Diners Club",
        "credit_limit": 12700.00,
        "current_balance": 2313.35,
        "minimum_payment": 369.33,
        "available_credit": 10366.27,
        "apr": 16.77,
        "statement_date": "2026-01-03",
        "due_date": "2026-01-20",
        "currency": "USD",
        "is_international": False
    },
    {
        "id": "card-apple-card",
        "user_id": "admin-emilio-001",
        "name": "Apple Card",
        "bank": "Goldman Sachs",
        "credit_limit": 5000.00,
        "current_balance": 6912.08,
        "minimum_payment": 148.00,
        "apr": 19.74,
        "statement_date": "2025-12-31",
        "due_date": "2026-01-31",
        "currency": "USD",
        "is_international": True
    }
]

# Datos de los 6 diferidos
DEFERRED_PAYMENTS = [
    # Pacificard
    {
        "id": "def-pacificard-001",
        "user_id": "admin-emilio-001",
        "description": "PACIFICARD EFECTIVO BANCA",
        "total_amount": 11070.90,
        "monthly_payment": 738.06,
        "remaining_installments": 13,
        "total_installments": 15,
        "card_id": "card-pacificard-black",
        "card_name": "Pacificard Black"
    },
    {
        "id": "def-pacificard-002",
        "user_id": "admin-emilio-001",
        "description": "PACIFICARD EFECTIVO BANCA",
        "total_amount": 12639.90,
        "monthly_payment": 601.90,
        "remaining_installments": 13,
        "total_installments": 21,
        "card_id": "card-pacificard-black",
        "card_name": "Pacificard Black"
    },
    {
        "id": "def-pacificard-003",
        "user_id": "admin-emilio-001",
        "description": "TECNICENTRO JULIO GUERRA",
        "total_amount": 1557.42,
        "monthly_payment": 259.57,
        "remaining_installments": 1,
        "total_installments": 6,
        "card_id": "card-pacificard-black",
        "card_name": "Pacificard Black"
    },
    # Pichincha
    {
        "id": "def-pichincha-001",
        "user_id": "admin-emilio-001",
        "description": "MUNICIPIO DE SAMBOROND",
        "total_amount": 3953.46,
        "monthly_payment": 1317.82,
        "remaining_installments": 2,
        "total_installments": 3,
        "card_id": "card-pichincha-platinum",
        "card_name": "Pichincha Platinum"
    },
    {
        "id": "def-pichincha-002",
        "user_id": "admin-emilio-001",
        "description": "SRI PAGOS EN LINEA",
        "total_amount": 737.88,
        "monthly_payment": 245.96,
        "remaining_installments": 1,
        "total_installments": 3,
        "card_id": "card-pichincha-platinum",
        "card_name": "Pichincha Platinum"
    },
    {
        "id": "def-pichincha-003",
        "user_id": "admin-emilio-001",
        "description": "SRI PAGOS EN LINEA",
        "total_amount": 1665.84,
        "monthly_payment": 277.64,
        "remaining_installments": 1,
        "total_installments": 6,
        "card_id": "card-pichincha-platinum",
        "card_name": "Pichincha Platinum"
    }
]


async def seed_database(mongo_url: str, db_name: str):
    """Carga los datos iniciales si no existen"""
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # 1. Crear usuario admin si no existe
        existing_user = await db.users.find_one({"email": ADMIN_USER["email"]})
        if not existing_user:
            user_doc = {
                **ADMIN_USER,
                "password": pwd_context.hash(ADMIN_PASSWORD),
                "hashed_password": pwd_context.hash(ADMIN_PASSWORD)
            }
            await db.users.insert_one(user_doc)
            logger.info(f"✅ Usuario admin creado: {ADMIN_USER['email']}")
        else:
            # Actualizar el user_id si ya existe para que coincida
            if existing_user.get("id") != ADMIN_USER["id"]:
                await db.users.update_one(
                    {"email": ADMIN_USER["email"]},
                    {"$set": {"id": ADMIN_USER["id"]}}
                )
            logger.info(f"ℹ️ Usuario admin ya existe: {ADMIN_USER['email']}")
        
        # 2. Crear tarjetas si no existen
        for card in CREDIT_CARDS:
            existing_card = await db.credit_cards.find_one({"id": card["id"]})
            if not existing_card:
                card_doc = {
                    **card,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.credit_cards.insert_one(card_doc)
                logger.info(f"✅ Tarjeta creada: {card['name']}")
            else:
                # Actualizar datos de la tarjeta
                await db.credit_cards.update_one(
                    {"id": card["id"]},
                    {"$set": {
                        "current_balance": card["current_balance"],
                        "minimum_payment": card["minimum_payment"],
                        "due_date": card["due_date"],
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logger.info(f"ℹ️ Tarjeta actualizada: {card['name']}")
        
        # 3. Crear diferidos si no existen
        for deferred in DEFERRED_PAYMENTS:
            existing_def = await db.deferred_payments.find_one({"id": deferred["id"]})
            if not existing_def:
                def_doc = {
                    **deferred,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.deferred_payments.insert_one(def_doc)
                logger.info(f"✅ Diferido creado: {deferred['description']}")
            else:
                logger.info(f"ℹ️ Diferido ya existe: {deferred['description']}")
        
        # Resumen
        cards_count = await db.credit_cards.count_documents({})
        deferred_count = await db.deferred_payments.count_documents({})
        users_count = await db.users.count_documents({})
        
        logger.info(f"\n📊 Base de datos inicializada:")
        logger.info(f"   - Usuarios: {users_count}")
        logger.info(f"   - Tarjetas: {cards_count}")
        logger.info(f"   - Diferidos: {deferred_count}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error en seed_database: {e}")
        return False


async def run_seed():
    """Función para ejecutar el seed manualmente"""
    from dotenv import load_dotenv
    load_dotenv()
    
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'fintrack_ec')
    
    if not mongo_url:
        print("❌ MONGO_URL no configurada")
        return
    
    await seed_database(mongo_url, db_name)


if __name__ == "__main__":
    asyncio.run(run_seed())
