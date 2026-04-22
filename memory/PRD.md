# FamilyFinance Ecuador - PRD

## Problem Statement
Aplicacion de finanzas personales adaptada a Ecuador con integracion SRI, clasificacion de gastos, conciliacion bancaria, integracion Gmail, chatbot financiero y herramientas de presupuesto.

## Responsive Rule (IMPORTANT)
La app Vesta se usa desde laptop, iPad y celular. Todo diseño debe ser responsive:
- Usa `sm:`, `md:`, `lg:` en clases Tailwind donde corresponda
- KPIs superiores: `grid-cols-2` en mobile, `grid-cols-4` en desktop
- Modales: `max-h-[90vh] overflow-y-auto`
- H1: `text-2xl sm:text-3xl md:text-4xl`


## [2026-04-22] SESIÓN 9 — 4 bugfixes quirúrgicos P0
- **seed_data.py**: eliminado `card-apple-card` del array `CREDIT_CARDS`. Admin queda con 3 tarjetas (Pacificard Black, Pichincha Platinum, Diners Club). Doc huérfano `card-apple-card` eliminado de MongoDB.
- **documents.py `_save_deferred_purchases`**: dedup ahora incluye `total_amount` ±5% → dos diferidos con misma description+card pero distinto total_amount se tratan como independientes.
- **dashboard.py `/dashboard/stats`**: `total_income` ahora SUMA `transactions(type=income)` + colección `incomes` (excluyendo `status=cancelled`) del mes actual.
- **dashboard.py `/dashboard/stats`**: `sri_deductible` ahora filtra por `transaction.sri_category` (no por 5 keys legacy que ya no existen post-refactor de taxonomía).

### Testing (iteration_29.json)
- 7/7 pytest PASS (test_iteration29_fixes.py creado)
- Apple Card confirmada ausente en API y DB
- Ingresos: +$1000 al insertar income received; 0 al insertar cancelled
- SRI: +$50 al insertar tx con sri_category='alimentacion'; 0 sin sri_category
- Dedup diferidos: $5000 vs $10000 = 2 docs independientes; $3000 x2 = decrement correcto

### Code review backlog (no-blocker)
- P2 `dashboard.py`: guardar contra `incomes` sin campo `date` (backfill o `$or` con `received_at`)
- P2 `documents.py`: guardar contra `total_amount=0` en el rango ±5% (actualmente matchea cualquier 0)
- P2 `dashboard.py`: una sola pasada por transactions (actualmente 2 loops)
- P2 `seed_data.py`: `delete_many` defensivo de tarjetas "desconocidas" del admin


## [2026-04-22] REFACTOR MASIVO — Taxonomía única + 6 páginas
### PARTE A — Taxonomía (fuente única de verdad)
- `PERSONAL_CATEGORIES` canónica en `/src/constants/categories.js` (12 keys: servicios_basicos, suscripciones, empleados, colegio_actividades, seguros, comida, restaurantes, carros, usa, viajes_entretenimiento, gastos_libres, otros). `impuestos` eliminado.
- `models.py BUDGET_CATEGORIES` sincronizado 1:1 con PERSONAL_CATEGORIES. Tildes preservadas (Alícuota B/GT, Angélica, Fútbol, Mamá).
- `DEMO_BUDGET_CATEGORIES` eliminado — `get_budget_categories()` retorna único dict.
- `CargarValidar.js`: eliminada copia local (triple fuente de verdad resuelta).
- `SRI_CATEGORIES` con `limit_fraction` decimal (0.325, 1.3) en front+back. Agregado transporte, viajes_internacionales, Odontología, Maestría. Eliminado no_deducible genérico.
- Migración MongoDB completada: 41 docs normalizados, 2 docs backfilled con category=otros.
- `DEFAULT_CATEGORIZATION_RULES` actualizadas para producir solo PERSONAL_CATEGORIES válidas.
- `TransactionBase.category` ahora `Optional[str] = "otros"` (defensivo contra data legacy).

### PARTE B — Sistema de diseño Forest homogéneo
- `semanticColors` agregado a `/src/styles/design-system.js` (income/expense/success/warning/danger/btnPrimary).
- Corregidos botones/texto emerald→#0D9E82 en MetasViaje, TabPorRevisar, PresupuestoEditable, AccountantView.
- Eliminados círculos coloridos en KPIs de Deudas.js y AccountantView.
- Transactions.js: mapa CATEGORY_COLORS colapsado a pill slate uniforme (Proxy).
- Ingresos.js: fuente Personal → bg-slate-100.
- Flujo.js: filas sin fondos bg-red/amber-50/40.

### PARTE C — Arquitectura 6 páginas
- Nuevos wrappers con tabs (reusan componentes existentes):
  - `/movimientos` — Por revisar + Todos (CargarValidar + Transactions)
  - `/mi-dinero` — Presupuesto + Ingresos + Flujo
  - `/fiscal` — Facturas + Deducciones + Resumen
- Menú lateral: 6 items con Lucide icons (LayoutDashboard, ArrowLeftRight, Wallet, Target, CreditCard, Scale).
- 11 redirects legacy activos: /cargar, /transactions, /budget, /ingresos, /flujo, /sri-match, /sri-limits, /accountant, /metas-viaje, /predictions, /international.
- Eliminados 2401 LOC muertos: Budget.js (617), Reconciliation.js (884), Upload.js (647), InternationalExpenses.js (253).
- Dashboard: links internos actualizados a nuevas rutas.

### Resultados (iteration_28.json)
- Backend: 9/9 pytest PASS. GET /api/transactions ahora devuelve 106 tx OK tras backfill.
- Frontend: 6/6 páginas + 11/11 redirects + sidebar con 6 items verificados.


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

## [2026-04-22] SESIÓN 7 — Badges Transactions + Verificación SESIÓN 6
- Bugfix Transactions.js: badge de categoría/subcategoría estilo slate uniforme (`Categoría · Subcategoría`) debajo de la fecha
- Bugfix Transactions.js: badge "Validada" (emerald-50/700/200) para `status=approved` o `estado=aprobado`
- Bugfix Transactions.js: badge "Auto" (slate) para `matched_rule` o `auto_categorized`
- Nuevos data-testid: `tx-category-{id}`, `tx-validated-{id}`, `tx-auto-{id}`
- MetasViaje.js: aria-label + data-testid `link-tx-{goal_id}` en botón "Vincular gasto"
- Verificación SESIÓN 6 completa: 10/10 backend tests PASS, 105 rows con badges correctos (99 Validada, 33 Auto)
- Test file creado: /app/backend/tests/test_session6_travel_goals.py

## Code Review Issues (backlog, no blockers)
- P2: cashflow.py `/link-transaction` permite vincular la misma tx a múltiples metas (double-count)
- P2: cashflow.py `PUT /travel-goals/{id}` acepta dict sin whitelist (riesgo overwrite user_id/id)
- P2: cashflow.py `monthly_needed` con days_remaining<30 devuelve valor enorme; considerar clamp

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


- [2026-04-21] SESIÓN 14 - Subcategoría + Rediseño Ejecutivo + Reglas en Perfil:
  - Task 1 (CargarValidar.js): Segundo dropdown "Subcategoría" junto al de Categoría
    en pestaña "Por revisar". Estado rowSubcategory[], reset al cambiar categoría,
    usa PERSONAL_CATEGORIES[selectedCat].subcategories (mismo mapeo del modal Historial).
    Bulk approve incluye subcategory en PUT /transactions y en query param de reconciliation/approve.
  - Task 2 (Layout.js, Dashboard.js, CargarValidar.js): Rediseño visual ejecutivo
    * Sistema: bg #FFFFFF, text #0F172A, acento #0F766E, bordes #E2E8F0, bg2 #F8FAFC
    * Alertas: rojo #DC2626, verde positivo #16A34A
    * Sidebar: bg #0F172A, texto #94A3B8, active bg-[#0F766E] text-white, íconos Lucide 18px
    * Todos los emojis reemplazados por íconos Lucide React (CheckCircle, RefreshCw, Clock,
      AlertTriangle, FileText, Bell, Edit2, Trash2, Store)
    * Cards: shadow-sm border border-slate-200, sin gradientes. Borde izquierdo 3px solo para estado
    * Botones primarios: bg-[#0F766E] hover:bg-[#0D6B63]. Secundarios: border slate-200
    * Eliminados: gradient-to-r/br violet/blue/cyan, emojis 📋✅🔄⏳⚠️🎭 y Badge Phosphor Scales/Airplane migrados a Lucide
  - Task 3 (Perfil.js): Nueva sección "Aprendizaje automático" con 2 tabs:
    * Comercios: lista known_vendors (GET /api/known-vendors), editar inline (Edit2) + eliminar (Trash2)
    * Reglas activas: lista custom_rules de categorization_rules, eliminar (DELETE /api/categorization-rules/{id})
    * PUT /api/known-vendors/{id} para editar vendor (endpoints backend ya existían)
  - Lint JS: 0 issues en los 4 archivos. Backend endpoints verificados vía curl.


- [2026-04-21] SESIÓN 15 - Rebrand Vesta + RUC + Invitación contadora + Fix factura_sri:
  - Task 1 (Rebrand): FamilyFinance → Vesta en Layout.js + Login.js (hero, mobile logo, tagline).
    Tagline "Ecuador" → "Tu patrimonio familiar, en orden." Title en index.html y name en package.json.
  - Task 2 (RUC): UserBase/UserResponse en models.py con 4 campos opcionales (ruc, nombre_legal,
    tipo_contribuyente, zona_sri). Nueva sección "Datos fiscales" en Perfil.js editable con
    5 tipos de contribuyente. PUT /api/auth/profile en routes/auth.py (update parcial).
    SRILimits y /api/sri/deduction-limits ahora construyen `contribuyente` desde el user doc
    (fallback a CONTRIBUYENTE_INFO solo si campos están vacíos). RUC hardcoded de Emilio
    eliminado — cada usuario ve su propio RUC.
  - Task 3 (Clasificador factura_sri): Prompt de _classify_email_with_ai reforzado con
    reglas explícitas de palabras clave ("factura", "documento electronico", "comprobante
    electronico", "comprobante de venta") y emisores (contifico, degeremcia, datil).
    Prefiltro de remitentes extendido (GMAIL_SENDER_FILTER + checks is_factura_subject
    e is_invoice_sender). GPT fallback fuerza tipo=factura_sri si invoice_sender.
    Test 3/3 casos marcan factura_sri y extraen numero_factura + ruc_emisor.
  - Task 4 (Invitación contadora): POST /api/auth/invite (admin-only, expira 48h, token
    secrets_mod.token_urlsafe(32)), GET /api/auth/accept-invite/{token} valida, POST
    /api/auth/register acepta query param invite_token (marca usado + usa email/rol del invite).
    Nueva ruta /accept-invite/:token en App.js renderiza Login.js con email prellenado y solo

- [2026-04-21] SESIÓN 16 - Design System centralizado + cleanup cromático masivo:
  - Nuevo archivo /app/frontend/src/styles/design-system.js con constantes
    colors (primary #0F766E, danger #DC2626, success #16A34A, warning #D97706),
    typography y components (card, buttonPrimary/Secondary/Ghost, input, badge variants).
  - Import `{ components, typography } from "../styles/design-system"` agregado a
    las 11 páginas (Dashboard, Transactions, Ingresos, CargarValidar, Flujo, Deudas,
    SRILimits, SriMatch, AccountantView, MetasViaje, PresupuestoEditable).
  - Emojis → Lucide React sin texto visible:
    * Transactions.js: 🍽️🏥📚🏠👔🏖️❌✓ → Utensils, HeartPulse, GraduationCap,
      Home, Shirt, Palmtree, XCircle, Check (SRI_CATEGORIES con campo Icon).
    * MetasViaje.js: 9 subcategory icons + 7 GOAL_TYPES icons + 💡 → Lucide
      (Hotel, Plane, Utensils, Drama, Shirt, Smartphone, Car, Map, Package, etc.).
    * SRILimits.js: ✓/✗ (12) → LICheck (verde)/LIX (rojo).
    * SriMatch.js: ✅🔄⏳⚠️📄💳 → Lucide counters + Factura/Consumo badges.
    * Ingresos.js: 💡 → Lightbulb.
  - Colores no-semánticos eliminados (sed global):
    * violet/purple/indigo/fuchsia/pink/cyan/sky → #0F766E (texto) / slate-100-200 (bg/border).
    * orange → amber (warning semántico).
    * blue → teal para acentos, slate para fondos/bordes informativos.
    * Dark-mode variants también (dark:bg-violet-900 → dark:bg-slate-800, etc.).
    * Cero gradientes (bg-gradient-to-* from-* to-*) eliminados.
  - Verificación final: 0 emojis, 0 violet/purple/indigo/fuchsia/pink/cyan/sky/orange,
    0 blue, 0 gradients en las 11 páginas. Lint JS: ✅ 0 issues en todo /pages.
  - 4 screenshots verificados (Dashboard, Transacciones, Mi Presupuesto, Bandeja Financiera):
    sidebar "Vesta" dark con teal activo, cards shadow-sm border-slate-200 sin gradientes,
    teal como único color de acento, rojo/verde/amber solo semánticos.

    nombre+password (via useParams). Sección "Accesos" en Perfil.js visible solo para admin
    con input email + botón "Invitar contadora" + display del link copiable.

- [2026-04-21] SESIÓN 17 - Paleta Forest + Fix factura_sri + Checklist pre-deploy:
  - Task 1 (Forest palette):
    * design-system.js reescrito con colors.primary=#0D9E82, primaryHover=#0B8A70,
      sidebarBg=#0F1D1A, sidebarText=#6B8F87, sidebarActiveBg=#1A3330, sidebarActiveText=#FFF,
      background=#F8FAF9, border=#E2EAE8, text=#0F1D1A, textSecondary=#5C7A74.
    * Layout.js migrado por sed: #0F766E→#0D9E82, #0F172A→#0F1D1A, slate-800→#1A3330,
      slate-400→#6B8F87, slate-200→#E2EAE8, F8FAFC→F8FAF9, etc. Cero referencias antiguas.
    * FAB.jsx: botón principal bg-gradient violet/purple → bg-[#0D9E82] sólido; opciones
      Camera(blue-500)/Image(emerald-500)/Gasto(violet-500) → [#0D9E82] + 2 bg-slate-700;
      Dialog submit bg-violet-600 → bg-[#0D9E82].
    * Screenshot confirma aesthetic Forest consistente.
  - Task 2 (Fix factura_sri):
    * Prompt reforzado con "Ha recibido su documento" y tono imperativo "DEBE ser factura_sri".
    * is_factura_subject ampliado con "ha recibido su documento".
    * Pre-filtro GMAIL_SENDER_FILTER ya incluía contifico/datil/degeremcia (S15).
    * Test directo 5/5 emails clasificados como factura_sri con extracción de numero + RUC.
  - Task 3 (Pre-deploy checklist):
    * backend/.env vars presentes: GOOGLE_CLIENT_ID ✓, GOOGLE_CLIENT_SECRET ✓,
      GOOGLE_REDIRECT_URI ✓, OPENAI_API_KEY ✓ (alias EMERGENT_LLM_KEY),
      MONGODB_URL ✓ (alias MONGO_URL), JWT_SECRET ✓ (alias JWT_SECRET_KEY).
    * CRON Gmail APScheduler activo: interval hours=6 (log "CRON gmail scheduler iniciado (cada 6h)").
    * Backend running, supervisor status OK.

  - Verificación: /auth/me retorna RUC, screenshot Perfil muestra datos fiscales persistidos,
    clasificador marca facturas. Lint Python + JS: 0 issues.


- [2026-04-21] SESIÓN 18 - Fix regresión post-refactor CargarValidar.js:
  - Refactor previo dividió CargarValidar.js (1600+ líneas) en 5 subcomponentes
    /app/frontend/src/components/bandeja/ (TabImportar, TabPorRevisar, TabHistorial,
    BandejaStats, BandejaDialogs) pero quedó una regresión sin detectar.
  - Bug HIGH encontrado por testing_agent_v3_fork (iteration_20):
    BandejaStats importado pero nunca montado — bloque inline quedó gated en
    `activeTab === "validate"` (nombre legacy; tabs renombradas a importar/revisar/historial).
    Resultado: las 4 cards de stats (Pendientes/Duplicados/Aprobados/Por revisar $)
    nunca aparecían arriba de las pestañas.
  - Bug LOW: duplicación de subtítulo en el header de Bandeja Financiera.
  - Bug MEDIUM: botón "Aprobar seleccionadas" en header gated en 'validate' (muerto);
    BulkActionDialog montado pero nunca abierto (setShowBulkDialog nunca llamado).
  - Fix aplicado en CargarValidar.js:
    * Reemplazado bloque stats inline por `<BandejaStats stats={stats}
      duplicatePairs={duplicatePairs} crossCanalCount={crossCanalCount}
      formatCurrency={formatCurrency} />` montado unconditionally arriba de los tabs.
    * Removido párrafo de subtítulo duplicado (ahora solo "Sube archivos y aprueba
      transacciones en un solo lugar").
    * Removido botón bulk approve header-level y BulkActionDialog huérfano.
    * Import de BulkActionDialog removido (solo GmailConsentDialog).
  - Retest iteration_21: 100% passed (7/7 acceptance items).
    BandejaStats renderiza con data viva: Pendientes:33, Duplicados:2 (+3 cross-canal),
    Aprobados:46, Por revisar: $3.302,18. Forest Palette preservado. Lint: 0 issues.
  - Pre-existente (no introducido): 500 errors en carga de /cargar (endpoints
    /api/reconciliation/* o /api/gmail/*). Se sugiere investigar en sesión futura.
