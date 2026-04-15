# FamilyFinance Ecuador - PRD

## Problem Statement
Aplicacion de finanzas personales adaptada a Ecuador con integracion SRI, clasificacion de gastos, conciliacion bancaria, integracion Gmail, chatbot financiero y herramientas de presupuesto.

## User Personas
- **Admin (Emilio)**: Gestor principal de finanzas familiares
- **Contadora**: Revision y aprobacion de transacciones
- **Esposa (KP)**: Acceso parcial a gastos compartidos
- **Demo User**: Acceso de prueba con datos ficticios

## Core Requirements
1. Clasificacion de gastos segun categorias SRI Ecuador (alimentacion, salud, educacion, vivienda, vestimenta, turismo)
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
  seed_data.py       (data seeding)
  routes/
    auth.py          (authentication + users)
    transactions.py  (CRUD + split + grouped + categorization rules)
    vendors.py       (known vendors CRUD + learn-vendors)
    dashboard.py     (stats, chart, SRI limits, categories)
    reconciliation.py(upload-statement, confirm, approve/reject, bulk, duplicates)
    documents.py     (process receipt/email/excel/bank-stmt, attachments, exports)
    budget.py        (budget, personal budget, income, predictions, suggestions)
    deferred.py      (deferred payments CRUD + installment registration)
    credit_cards.py  (credit cards CRUD + debt summary + snowball plan)
    cashflow.py      (scheduled payments, expected income, receivable, travel, reminders)
    gmail.py         (OAuth, sync, transactions, documents)
    chat.py          (AI chatbot + history)
/app/frontend/
  src/pages/
    Dashboard.js, Flujo.js, CargarValidar.js
```

## What's Been Implemented
- Full authentication (JWT) with role-based access
- Transaction CRUD with auto-categorization (known vendors + AI)
- SRI deduction tracking with limits and alerts
- Bank statement reconciliation (PDF OCR via Gemini)
- Gmail integration (OAuth2, email classification via GPT-4o, PDF download)
- Budget management (personal categories from Excel)
- Credit card management with debt payoff strategies
- Deferred payment tracking with auto-deduction
- Cash flow projection and smart reminders
- Travel fund management
- AI chatbot for financial advice
- Export reports (Excel + SRI PDF)
- Backend modularization (7111 lines -> 14 modular files)

## Completed Tasks (Latest)
- [2026-04-15] Backend modularization: server.py (7111 lines) split into 14 files
  - models.py, utils.py, database.py + 12 route files in /routes/
  - All URLs preserved, 33/33 backend tests passed
  - server.py reduced to 78 lines (just initialization + router includes)

## Tech Stack
- Backend: FastAPI, Python, Motor (async MongoDB)
- Frontend: React.js, Tailwind CSS, shadcn/ui
- AI: OpenAI GPT-5.2 (chat, classification), GPT-4o (Gmail), Gemini 2.5 Flash (OCR)
- Database: MongoDB Atlas
- Auth: JWT (bcrypt)
- Integrations: Google OAuth/Gmail API, Emergent LLM Key

## Upcoming Tasks (P1)
- Banner de Notificaciones Inteligentes (alertas de flujo de caja, limites SRI)
- Widget de "Proximas Acciones" al Dashboard

## Future Tasks (P2)
- Conexion directa con Apple Card
- Notificaciones push cuando categoria de gasto se acerque a su limite
- Modo oscuro completo

## Known Issues
- React hooks exhaustive-deps warnings (frontend linting)
