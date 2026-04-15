# FamilyFinance Ecuador - PRD

## Problem Statement
Aplicacion de finanzas personales adaptada a Ecuador con integracion SRI, clasificacion de gastos, conciliacion bancaria, integracion Gmail, chatbot financiero y herramientas de presupuesto.

## User Personas
- **Admin (Emilio)**: Gestor principal de finanzas familiares
- **Contadora**: Revision y aprobacion de transacciones
- **Esposa (KP)**: Acceso parcial a gastos compartidos
- **Demo User**: Acceso de prueba con datos ficticios

## Core Requirements
1. Clasificacion de gastos segun categorias SRI Ecuador
2. Conciliacion bancaria automatica con estados de cuenta PDF
3. Integracion Gmail para lectura de correos bancarios y facturas
4. Presupuesto personal con categorias personalizadas
5. Gestion de tarjetas de credito y deudas (Snowball/Avalanche)
6. Pagos diferidos con deduccion automatica
7. Flujo de caja y proyeccion financiera
8. Fondo de viajes con seguimiento de depositos
9. Chatbot financiero con IA (GPT-5.2)
10. Exportacion de reportes SRI (PDF/Excel)

## Architecture
```
/app/backend/
  server.py          (78 lines - slim entry point)
  database.py        (14 lines - MongoDB connection)
  models.py          (738 lines - all Pydantic models, constants, enums)
  utils.py           (532 lines - auth, AI, vendor lookup, helpers)
  seed_data.py       (credentials via env vars with fallback defaults)
  routes/
    auth.py, transactions.py, vendors.py, dashboard.py,
    reconciliation.py, documents.py, budget.py, deferred.py,
    credit_cards.py, cashflow.py, gmail.py, chat.py
  tests/
    conftest_credentials.py  (shared test config - creds from env vars)
    test_modularization.py   (33 endpoint tests)
    ...
```

## What's Been Implemented
- Full authentication (JWT) with role-based access
- Transaction CRUD with auto-categorization
- SRI deduction tracking with limits and alerts
- Bank statement reconciliation (PDF OCR via Gemini)
- Gmail integration (OAuth2, GPT-4o classification)
- Budget management, credit cards, deferred payments
- Cash flow projection, travel fund, AI chatbot
- Export reports (Excel + SRI PDF)

## Completed Tasks (Latest)
- [2026-04-15] Backend modularization: server.py 7111 -> 78 lines, 14 modular files
- [2026-04-15] Code quality fixes (Fase 1):
  - Fixed undefined variable risk in cashflow.py (status/message defaults)
  - Fixed late-binding closure in vendors.py (lambda default args)
  - Moved hardcoded secrets from seed_data.py to env vars
  - Moved hardcoded credentials from 10 test files to shared conftest_credentials.py

## Tech Stack
- Backend: FastAPI, Python, Motor (async MongoDB)
- Frontend: React.js, Tailwind CSS, shadcn/ui
- AI: OpenAI GPT-5.2, GPT-4o, Gemini 2.5 Flash
- Database: MongoDB Atlas
- Auth: JWT (bcrypt)

## Upcoming Tasks
- (P1-Fase2) Migrar JWT token storage de localStorage a httpOnly cookies
- (P1-Fase2) Fix missing React hook dependencies (27 hooks)
- (P1-Fase2) Fix array index as React key (15 instances)
- (P1-Fase2) Remove console.log from production (13 instances)
- (P1) Banner de Notificaciones Inteligentes
- (P1) Widget "Proximas Acciones" en Dashboard

## Future Tasks (P2)
- Refactor process_bank_statement() (complejidad 48)
- Split componentes masivos (CargarValidar 1352 lines, etc.)
- Reduce inline objects (265 instancias)
- Conexion directa con Apple Card
- Notificaciones push, modo oscuro
