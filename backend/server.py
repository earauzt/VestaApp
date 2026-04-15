from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

from database import db, client, MONGO_URL, DB_NAME
from seed_data import seed_database

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI(title="FamilyFinance Ecuador API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Import route modules
from routes.auth import router as auth_router
from routes.transactions import router as transactions_router
from routes.vendors import router as vendors_router
from routes.dashboard import router as dashboard_router
from routes.reconciliation import router as reconciliation_router
from routes.documents import router as documents_router
from routes.budget import router as budget_router
from routes.deferred import router as deferred_router
from routes.credit_cards import router as credit_cards_router
from routes.cashflow import router as cashflow_router
from routes.gmail import router as gmail_router
from routes.chat import router as chat_router

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(transactions_router)
api_router.include_router(vendors_router)
api_router.include_router(dashboard_router)
api_router.include_router(credit_cards_router)
api_router.include_router(reconciliation_router)
api_router.include_router(documents_router)
api_router.include_router(budget_router)
api_router.include_router(deferred_router)
api_router.include_router(cashflow_router)
api_router.include_router(gmail_router)
api_router.include_router(chat_router)


# Health and root endpoints
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

@app.on_event("startup")
async def startup_db_seed():
    logger.info("Iniciando aplicacion - Ejecutando seed de datos...")
    await seed_database(MONGO_URL, DB_NAME)
    logger.info("Seed de datos completado")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
