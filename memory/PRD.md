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
- [2026-04-20] UI renaming + navigation + profile:
  - "Cargar y Validar" → "Bandeja Financiera" + subtitulo
  - "Viajes" → "Metas y Ahorro"
  - Gmail tab removed from Bandeja, moved to Perfil page (/perfil)
  - Profile page: user info, Gmail connection (consent modal), logout
  - Bandeja tabs: Cargar, Estados, Validar (3 cols)
  - Ingresos: inline editable distribution names (click badge → input)
  - Fingerprint: sha256(user_id|card|amount|date) stored on every transaction
  - dedup_or_merge() checks fingerprint then fuzzy (±1% amount, ±2 days, same card)
  - Merges sources array ["email_banco", "estado_cuenta"] with priority escalation
  - Integrated in gmail approve, reconciliation confirm, statement processing
  - /reconciliation/cross-canal-stats endpoint
  - Frontend: cross-canal badge + fuentes display in duplicate review dialog
  - 25/25 parser tests + fingerprint unit tests passing
  - /app/backend/parsers/__init__.py with 10 dedicated parsers:
    PacifiCard consumo, Diners consumo, Pichincha consumo, Bolivariano consumo,
    Pacifico pago, Pichincha transferencia, Pichincha estado, PacifiCard estado,
    Pacifico estado, Bolivariano estado (sin adjunto → notificacion)
  - Dispatcher tries parsers before GPT-4o fallback
  - Parser quality monitor endpoint /gmail/parser-quality
  - Gmail sender filter expanded with new senders
  - 25/25 parser tests passing (tests/test_parsers.py)
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
- [2026-04-20] SESIÓN 6B - Metas y Ahorro verificación y fixes:
  - Backend bug: add-savings era PUT con amount query param → cambio a POST con body dict
  - Backend bug: datetime naive vs tz-aware en get_travel_goals hacía days_remaining=0 siempre
    → fix: convertir target a tz-aware antes de restar
  - Backend: TransactionBase ahora incluye linked_goal_id, linked_goal_name
    (antes el response_model los filtraba por extra="ignore")
  - Frontend: Transactions.js muestra badge violeta con Target icon para txs vinculadas a meta
  - Todos los endpoints CRUD verificados con curl (crear/listar/editar/eliminar + add-savings suma + link-transaction)
  - UI dialog mobile OK: 7 tipos en grid 4x2 sin overflow
- [2026-04-20] SESIÓN 7 - Match consumo ↔ factura SRI:
  - Módulo nuevo /app/backend/routes/sri_match.py con try_sri_match + retry_pending_matches
  - Tolerancias: EXACT ±2%, APPROX ±10%, fecha ±7 días, pendiente 72h
  - Estados: con_respaldo / match_aproximado / pendiente_match / sin_respaldo / sin_respaldo_72h
  - TransactionBase extendido: estado_sri, factura_vinculada_id, consumo_vinculado_id,
    match_aproximado_candidato_id/confianza, match_pendiente_hasta, uso_empresarial
  - Endpoints: GET /sri/counters + /sri/pending, POST confirm-match/reject-match/mark-cash/
    link-manual/discard/scan, PATCH corporate
  - Hooks auto-match en: POST /transactions, gmail approve, process_multiple_receipts
  - Filtro uso_empresarial=true excluído de deducibles SRI (dashboard.py + documents.py pdf)
  - Frontend: widget 4 counters en Dashboard (✅🔄⏳⚠️) + página /sri-match con tabs y acciones
  - Transactions.js: toggle "Uso empresarial" en edit dialog (solo expense)
  - Sidebar: nav item "Match SRI" para todos los roles
  - 12/12 backend pytest + smoke frontend PASSED (iteration_17)
- [2026-04-20] SESIÓN 8 - Cálculo SRI correcto:
  - Nueva colección sri_categorias seeded desde SRI_CATEGORIAS_REGLAS (6 reglas 2024+):
    salud 100% sin tope, educacion 100% sin tope, alimentacion 0%,
    vestimenta tope $850, turismo/vivienda tope $3868.15
  - TransactionBase extendido con beneficiario (yo/conyuge/hijo/padre_madre),
    aplica_iva (default true), subtotal_sin_iva
  - GET /sri/deduction-limits: límite efectivo = MIN(20% ingresos_gravados, TOPE_LEGAL=$2784).
    Ingresos leídos de personal_budgets.income_projection con fallback INCOME_STRUCTURE.
    Devuelve ingresos_gravados_anual, limite_20pct, limite_legal, limite_efectivo
  - Lógica IVA: si aplica_iva=false → deducible = subtotal_sin_iva, else amount
  - Dashboard widget actualizado: "Tu límite: $X (20% de $Y = $Z) — Tope legal: $W"
  - Transactions edit dialog: select Beneficiario + toggle Aplica IVA + input Subtotal (condicional)
  - 13/13 backend + frontend verificado (iteration_18)
- [2026-04-20] SESIÓN 9 - Recibos de servicios digitales (mini-fix):
  - Feature ya existente de sesiones previas (SERVICE_DOMAINS, _classify_service_receipt,
    endpoint /dashboard/subscription-renewals, widget Dashboard con 🔄)
  - Gap corregido 1: endpoint filtra SOLO los ≤7 días (antes incluía los sin fecha)
  - Gap corregido 2: backend agrega days_until_renewal al payload
  - Gap corregido 3: widget Dashboard cambia texto de "Renueva el YYYY-MM-DD" a
    "Se renueva en X días — $X.XX" + subtítulo "🔄 Esta semana (n)"
  - Verificado con curl: Netflix in 3d aparece, Spotify in 10d no aparece, Apple sin fecha no aparece
- [2026-04-20] SESIÓN 10 - Banner Notificaciones + Widget Esta semana:
  - Tarea 1 (hook deps): sin cambios — Flujo.js/Transactions.js/Dashboard.js ya usan patrón useRef
  - Backend: 2 endpoints nuevos en dashboard.py reutilizando credit_cards, scheduled_payments,
    transactions, deferred_payments, gmail_transactions, get_budget_categories
    * /api/notificaciones → 4 tipos (pago_proximo, limite_categoria, sugerir_filtro, gmail_nuevos),
      orden por prioridad (high/medium/low) + days_until
    * /api/dashboard/esta-semana → máx 5 items (card_payment, deferred, category_limit),
      badge red ≤2d / yellow ≤7d
  - Frontend Dashboard.js:
    * Reemplaza banner 'Smart Reminders' por sistema /notificaciones (máx 3 visibles + Ver más)
    * Dismiss persiste en localStorage key 'dismissed_notif_ids'
    * Nueva card 'Esta semana' entre KPIs y widget SRI
  - 16/17 pytest + Playwright frontend PASSED (iteration_19)
- [2026-04-20] PARTE B - Auto-reglas desde notificación sugerir_filtro:
  - Nuevo componente /app/frontend/src/components/AutoRuleModal.jsx reutilizando Dialog shadcn
  - Modal pre-rellena establishment + categoría sugerida desde /api/known-vendors/lookup
  - Al confirmar crea en paralelo:
    * POST /api/known-vendors (upsert vendor)
    * POST /api/categorization-rules (regla con keywords)
  - Dashboard.js: intercepta "Crear regla" cuando tipo=sugerir_filtro → abre modal sin navegar
  - Backend: /api/notificaciones agrega campo establishment al payload de sugerir_filtro
  - Verificado: 3 txs 'Cafeteria Central' → notificación aparece → click abre modal con datos
    pre-rellenados → confirmar crea vendor + rule en DB, toast de éxito, refresh dashboard

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

- [2026-04-20] PROMPT 1 - Fix categorización + bulk approve:
  - routes/gmail.py: helper _resolve_budget_category(user_id, establishment, description, personal_category)
    * 1) known_vendors con SequenceMatcher ≥0.85
    * 2) user categorization_rules + apply_categorization_rules (defaults)
    * 3) fallback personal_category si no es 'otros', else 'otros'
  - Helper _approve_and_insert reutilizado por approve_gmail_transaction y bulk-approve
  - tx resultante: category = budget_category (consistencia), matched_rule guarda la fuente
  - Nuevo POST /api/gmail/transactions/bulk-approve {gmail_ids:[]} → {approved, errors, categorias_usadas, message}
  - CargarValidar.js: nuevo tab 'Gmail' visible (antes orphan). Toolbar con filtros
    (Solo consumos / Solo servicios / Todos), checkbox Seleccionar todos, botón
    Aprobar seleccionados (N), checkboxes individuales. Toast con resumen categorías
  - Verificado: Supermaxi→alimentacion/Supermercado por default_rule, bulk 2 txs OK
