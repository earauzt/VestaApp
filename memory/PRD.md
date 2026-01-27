# FinTrack Ecuador - Personal Finance Application
## PRD (Product Requirements Document)

### Original Problem Statement
Aplicación de finanzas personales para gestión familiar en Ecuador, con soporte para:
- Usuario administrador (Emilio)
- Esposa (rol spouse)
- Contadora (rol accountant)

La aplicación debe cumplir con las leyes tributarias de Ecuador (SRI) y permitir:
- Seguimiento de gastos personales según categorías del presupuesto del usuario
- Cálculo de límites de deducción del SRI (3 dependientes familiares)
- Gestión de múltiples fuentes de ingreso (Personal, APX, USA)
- Control de deudas y tarjetas de crédito

### User Personas
1. **Admin (Emilio)**: Acceso completo a todas las funciones
2. **Esposa**: Acceso a dashboard, transacciones, ingresos, deudas, flujo
3. **Contadora**: Acceso a conciliación, límites SRI, vista contable

---

## Core Requirements

### 1. Autenticación y Roles
- [x] Login con JWT
- [x] Tres roles: admin, spouse, accountant
- [x] Rutas protegidas según rol

### 2. Categorías de Presupuesto Personal (Excel PROYECCION EA 2026)
| Categoría | Presupuesto Mensual | Presupuesto Anual |
|-----------|---------------------|-------------------|
| Servicios Básicos | $1,280 | $15,360 |
| Empleados | $1,300 | $15,600 |
| Colegio y Actividades | $2,360 | $28,320 |
| Seguros | $1,150 | $13,800 |
| Comida | $950 | $11,400 |
| Restaurantes | $550 | $6,600 |
| Carros | $565 | $6,780 |
| USA | $1,250 | $15,000 |
| Viajes y Entretenimiento | Variable | $16,500 |
| Gastos Libres (Otros) | $1,300 | $15,600 |

### 3. Estructura de Ingresos
| Fuente | Mensual | Anual |
|--------|---------|-------|
| Personal | $7,250 | $87,000 |
| APX | $2,500 | $30,000 |
| USA | $2,750 | $33,000 |
| **Total** | **$12,500** | **$150,000** |

### 4. Funcionalidades Implementadas

#### Dashboard Inteligente
- [x] Gráfico de gastos por categoría con presupuesto vs gastado
- [x] Recordatorios y acciones inteligentes
- [x] Stats: Balance, Gastos, Ingresos, Transacciones

#### Chatbot de OpenAI (GPT-5.2)
- [x] Botón flotante para abrir/cerrar
- [x] Contexto financiero del usuario inyectado
- [x] Respuestas en español sobre gastos, presupuesto, consejos

#### Cargar y Validar (Upload + Reconciliation fusionados)
- [x] Tab "Cargar Archivos": Drag & drop para imágenes, PDF, Excel
- [x] Tab "Validar": Lista de transacciones pendientes
- [x] Aprobación individual y masiva
- [x] Detección de duplicados
- [x] Modal de detalles con edición

#### Deudas y Tarjetas de Crédito
- [x] CRUD de tarjetas (Diners, Pichincha, Pacificard, Apple)
- [x] Resumen de deuda total y utilización
- [x] Plan Avalanche con calculadora de pago extra

#### Planificación de Flujo
- [x] Vista semanal (4 semanas)
- [x] Pagos programados por día/semana
- [x] Selección de método de pago

#### Ingresos
- [x] Registro manual de ingresos
- [x] Distribución por categoría (Personal, APX, USA)
- [x] Resumen y filtros por año

#### Límites SRI (Vista Contadora)
- [x] Cálculo basado en canasta básica 2025
- [x] 3 dependientes configurados
- [x] Tracking de gastos deducibles

---

## Tech Stack
- **Frontend**: React 18, Tailwind CSS, shadcn/ui, Framer Motion, Recharts
- **Backend**: FastAPI, Python 3.11
- **Database**: MongoDB
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Auth**: JWT con bcrypt

---

## API Endpoints Principales
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/auth/login | Autenticación |
| POST | /api/chatbot | Chatbot OpenAI |
| POST | /api/process/bank-statement | Procesar estado de cuenta PDF (OCR mejorado) |
| POST | /api/process/receipt | Procesar recibo/factura |
| GET | /api/budget/config | Obtener presupuesto editable |
| POST | /api/budget/config | Guardar presupuesto editable |
| GET | /api/deferred-payments | Listar pagos diferidos |
| POST | /api/deferred-payments | Crear pago diferido |
| PUT | /api/deferred-payments/{id} | Editar pago diferido |
| DELETE | /api/deferred-payments/{id} | Eliminar pago diferido |
| GET | /api/reconciliation/pending | Transacciones por validar |
| PUT | /api/reconciliation/approve/{id} | Aprobar transacción |
| GET | /api/credit-cards | Lista tarjetas |
| GET | /api/debt/avalanche-plan | Plan Avalanche |
| GET | /api/scheduled-payments | Pagos programados |
| POST | /api/income | Registrar ingreso |
| GET | /api/dashboard/stats | Estadísticas dashboard |
| GET | /api/reminders | Recordatorios inteligentes |

---

## Issues Conocidos (P1-P2)
1. **P1**: Backend devuelve 403 en lugar de 401 en fallos de autenticación
2. **P1**: Problema de visibilidad en dropdown de categorías
3. **P2**: Advertencias de react-hooks/exhaustive-deps en varios componentes

---

## Testing
- **Última iteración**: iteration_7.json
- **Backend**: 95% pass rate (18/19)
- **Frontend**: 100% pass rate
- **Credenciales de prueba**: earauzt@gmail.com / password123

---

## Cambios Recientes (Enero 2026)
1. ✅ **Procesamiento de Estados de Cuenta PDF MEJORADO** (27 Enero 2026)
   - Integración de pdfplumber para extracción de texto de PDFs nativos
   - OCR mejorado con Gemini para PDFs escaneados/imagen (como Pacificard)
   - Prompt optimizado específicamente para estados de cuenta ecuatorianos
   - Soporte mejorado para Pacificard: extrae tarjeta, transacciones y diferidos
   - Timeout extendido a 5 minutos en frontend para procesamiento largo
   - **Resultado exitoso**: 186 transacciones, 15 diferidos extraídos de Pacificard

2. ✅ Corrección de error de sintaxis en Flujo.js (código duplicado eliminado)
3. ✅ Arreglo de autenticación para usuario earauzt@gmail.com
4. ✅ Chatbot OpenAI integrado con contexto financiero
5. ✅ Página "Cargar y Validar" fusionada
6. ✅ Categorías de presupuesto con montos exactos del Excel
7. ✅ Dashboard actualizado con barras de progreso por categoría
8. ✅ Navegación reorganizada

---

## Backlog / Próximas Tareas

### P0 (Crítica)
- [ ] Refactorizar Flujo.js a vista lineal (parcialmente completado)
- [ ] Sincronizar página Transacciones con lógica de categorías de CargarValidar.js

### P1 (Alta Prioridad)
- [ ] Corregir 403 -> 401 en autenticación fallida
- [ ] Corregir visibilidad dropdown de categorías
- [ ] Investigar integración con Apple Card

### P2 (Media Prioridad)
- [ ] Notificaciones push al acercarse a límites SRI (80%)
- [ ] Sugerencias de ajuste de presupuesto basadas en historial
- [ ] Corregir advertencias exhaustive-deps en React hooks

### P3 (Baja Prioridad)
- [ ] Exportación de reportes a Excel/PDF mejorada
- [ ] Gráficos comparativos mes a mes
- [ ] Modo oscuro completo
