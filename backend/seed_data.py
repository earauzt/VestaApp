"""Datos iniciales de Vesta — se asegura de que existan al arrancar la app.
Un solo usuario, sin login: nada de contraseñas ni tabla de usuarios aca.
"""
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

USER_ID = "emilio"

CREDIT_CARDS = [
    {
        "id": "card-pacificard-black", "user_id": USER_ID, "name": "Pacificard Black", "bank": "Pacificard",
        "credit_limit": 15000.00, "current_balance": 27677.32, "minimum_payment": 1807.17,
        "apr": 16.77, "cut_off_day": 23, "payment_due_day": 9, "currency": "USD", "is_international": False,
    },
    {
        "id": "card-pichincha-platinum", "user_id": USER_ID, "name": "Mastercard Quantum", "bank": "Banco Pichincha",
        "credit_limit": 40000.00, "current_balance": 5648.09, "minimum_payment": 4613.61,
        "apr": 16.77, "cut_off_day": 24, "payment_due_day": 9, "currency": "USD", "is_international": False,
    },
    {
        "id": "card-diners", "user_id": USER_ID, "name": "Diners Club", "bank": "Diners Club",
        "credit_limit": 12700.00, "current_balance": 2313.35, "minimum_payment": 369.33,
        "apr": 16.77, "cut_off_day": 3, "payment_due_day": 20, "currency": "USD", "is_international": False,
    },
]

DEFERRED_PAYMENTS = [
    {"id": "def-pacificard-001", "user_id": USER_ID, "description": "PACIFICARD EFECTIVO BANCA", "total_amount": 11070.90, "monthly_payment": 738.06, "remaining_installments": 13, "total_installments": 15, "card_id": "card-pacificard-black", "card_name": "Pacificard Black"},
    {"id": "def-pacificard-002", "user_id": USER_ID, "description": "PACIFICARD EFECTIVO BANCA", "total_amount": 12639.90, "monthly_payment": 601.90, "remaining_installments": 13, "total_installments": 21, "card_id": "card-pacificard-black", "card_name": "Pacificard Black"},
    {"id": "def-pacificard-003", "user_id": USER_ID, "description": "TECNICENTRO JULIO GUERRA", "total_amount": 1557.42, "monthly_payment": 259.57, "remaining_installments": 1, "total_installments": 6, "card_id": "card-pacificard-black", "card_name": "Pacificard Black"},
    {"id": "def-pichincha-001", "user_id": USER_ID, "description": "MUNICIPIO DE SAMBOROND", "total_amount": 3953.46, "monthly_payment": 1317.82, "remaining_installments": 2, "total_installments": 3, "card_id": "card-pichincha-platinum", "card_name": "Mastercard Quantum"},
    {"id": "def-pichincha-002", "user_id": USER_ID, "description": "SRI PAGOS EN LINEA", "total_amount": 737.88, "monthly_payment": 245.96, "remaining_installments": 1, "total_installments": 3, "card_id": "card-pichincha-platinum", "card_name": "Mastercard Quantum"},
    {"id": "def-pichincha-003", "user_id": USER_ID, "description": "SRI PAGOS EN LINEA", "total_amount": 1665.84, "monthly_payment": 277.64, "remaining_installments": 1, "total_installments": 6, "card_id": "card-pichincha-platinum", "card_name": "Mastercard Quantum"},
]


async def seed_database():
    from database import db
    try:
        for card in CREDIT_CARDS:
            existing = await db.credit_cards.find_one({"id": card["id"]})
            if not existing:
                await db.credit_cards.insert_one({**card, "created_at": datetime.now(timezone.utc).isoformat()})
                logger.info(f"Tarjeta creada: {card['name']}")

        for deferred in DEFERRED_PAYMENTS:
            existing = await db.deferred_payments.find_one({"id": deferred["id"]})
            if not existing:
                await db.deferred_payments.insert_one({**deferred, "created_at": datetime.now(timezone.utc).isoformat()})
                logger.info(f"Diferido creado: {deferred['description']}")

        try:
            from models import SRI_CATEGORIAS_REGLAS
            for key, rule in SRI_CATEGORIAS_REGLAS.items():
                await db.sri_categorias.update_one(
                    {"categoria": key},
                    {"$set": {"categoria": key, **rule}},
                    upsert=True,
                )
        except Exception as e:
            logger.warning(f"SRI categorias seed fallo: {e}")

        cards_count = await db.credit_cards.count_documents({})
        deferred_count = await db.deferred_payments.count_documents({})
        logger.info(f"Base de datos inicializada — tarjetas: {cards_count}, diferidos: {deferred_count}")
        return True
    except Exception as e:
        logger.error(f"Error en seed_database: {e}")
        return False
