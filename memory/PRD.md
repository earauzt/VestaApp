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
- [2026-04-20] Gmail consent modal + sender filter:
  - Pre-OAuth consent modal with clear data access explanation
  - Gmail API query changed from 'is:unread' to sender-specific filter
    (Diners, PacifiCard, Pichincha, Bolivariano, Pacifico + service domains)
  - state now uses secrets.token_urlsafe(32) with 10min expiry in DB
  - callback validates state exists + not expired, deletes after use (one-time)
  - Invalid/expired state returns HTTP 400 {"detail":"invalid_state"}
  - Frontend: window.open→window.location.href, loading state + error toast
  - GOOGLE_REDIRECT_URI verified correct in .env
  - Confirmed all `is` comparisons are correct (is None/is not None)
  - CargarValidar.js:177 already fixed in prior session
  - Split ReconciliacionEstados.jsx (577→184 lines) into 3 sub-components:
    ReconciliationHeader.jsx (116), TransactionList.jsx (189), MatchingPanel.jsx (142)
  - Refactored process_bank_statement() (114 lines → 30 lines) with 4 helpers:
    _upsert_card_from_statement, _save_deferred_purchases, _categorize_transaction,
    _save_statement_transactions
  - 19/19 backend + frontend verified (iteration_16)
  - secrets.choice replaces random.choice in cashflow.py reminders
  - Renamed list comprehension variable (item→it) to silence false positive
  - Removed unused import (random) and variable (budget_goals)
  - Added error logging to AuthContext.js logout catch block
  - Fixed last array index key (Dashboard.js:626)
  - Added useMemo for sorted categoryData in Dashboard.js
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
