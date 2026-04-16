# FamilyFinance Ecuador - PRD

## Problem Statement
Aplicacion de finanzas personales adaptada a Ecuador con integracion SRI, clasificacion de gastos, conciliacion bancaria, integracion Gmail, chatbot financiero y herramientas de presupuesto.

## Architecture
```
/app/backend/
  server.py          (78 lines - slim entry point)
  database.py, models.py, utils.py, seed_data.py
  routes/ (12 files: auth, transactions, vendors, dashboard,
           reconciliation, documents, budget, deferred,
           credit_cards, cashflow, gmail, chat)
  tests/conftest_credentials.py (shared test config)
/app/frontend/
  src/context/AuthContext.js  (httpOnly cookie auth, no localStorage)
  src/pages/  (Dashboard, Transactions, Flujo, CargarValidar, etc.)
```

## What's Been Implemented
- Full auth (JWT via httpOnly cookies + header backward compat)
- Transaction CRUD with auto-categorization
- SRI deduction tracking, bank statement reconciliation
- Gmail integration (OAuth2, GPT-4o classification)
- Budget, credit cards, deferred payments, cash flow
- Travel fund, AI chatbot, export reports
- Backend modularized (7111 -> 78 lines in server.py)

## Completed Tasks
- [2026-04-15] Backend modularization: 14 modular files, 33/33 tests
- [2026-04-15] Fase 1 code quality: undefined vars, closure bug, hardcoded secrets
- [2026-04-15] Fase 2 code quality:
  - JWT httpOnly cookies (secure=True, samesite=lax) replacing localStorage
  - useRef pattern in Dashboard/Transactions/MetasViaje/Ingresos for hook deps
  - Array index as key replaced in 8 instances (Upload, Dashboard, CargarValidar, ChatBot)
  - 8 console.log wrapped in NODE_ENV === 'development' guards
  - 29/29 backend + frontend login flow verified
- [2026-04-15] Code quality round 3: removed hardcoded secrets from 2 new test files,
  fixed array index as key in 7 frontend files (Reconciliation, Predictions, SRILimits,
  SplitTransactionModal, AttachmentUploader). 49/49 pytest passed.
- [2026-04-15] Gmail service receipts feature:
  - SERVICE_DOMAINS whitelist (Apple, Netflix, Spotify, Google, Amazon, Adobe)
  - _classify_service_receipt GPT-4o classifier for tipo=recibo_servicio
  - New fields: es_suscripcion, proxima_renovacion
  - /dashboard/subscription-renewals endpoint
  - UI: orange icon + "Servicio Digital" badge in Gmail tab
  - Dashboard: subscription renewal widget below reminders
  - 20/20 tests passed

## Tech Stack
- Backend: FastAPI, Python, Motor (async MongoDB), JWT httpOnly cookies
- Frontend: React.js, Tailwind CSS, shadcn/ui, axios withCredentials
- AI: OpenAI GPT-5.2, GPT-4o, Gemini 2.5 Flash
- Database: MongoDB Atlas

## Upcoming Tasks
- (P1) Banner de Notificaciones Inteligentes
- (P1) Widget "Proximas Acciones" en Dashboard

## Future Tasks (P2+)
- Refactor process_bank_statement() (complejidad 48)
- Split componentes masivos (CargarValidar 1352 lines, etc.)
- Reduce inline objects (265 instancias)
- Conexion directa con Apple Card
- Notificaciones push, modo oscuro
