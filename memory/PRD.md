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
2. **Esposa (KP)**: Acceso a dashboard, transacciones, ingresos, metas de viaje, deudas, flujo
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

---

## Funcionalidades Implementadas

### Dashboard Inteligente ✅
- [x] Gráfico de gastos por categoría con presupuesto vs gastado
- [x] Recordatorios y acciones inteligentes (con botón X para cerrar)
- [x] Stats: Balance, Gastos, Ingresos, Transacciones
- [x] **Widget de Flujo Proyectado a 30 días** (Fase 2) - Muestra ingresos esperados, gastos programados y neto
- [x] **Widget de Metas de Viaje** (Fase 3) - Muestra metas activas con progreso
- [x] Vista simplificada para rol "Familiar" (KP)

### Chatbot de OpenAI (GPT-5.2) ✅
- [x] Botón flotante para abrir/cerrar
- [x] Contexto financiero del usuario inyectado
- [x] Respuestas en español sobre gastos, presupuesto, consejos

### Cargar y Validar (Upload + Reconciliation fusionados) ✅
- [x] Tab "Cargar Archivos": Drag & drop para imágenes, PDF, Excel
- [x] Tab "Validar": Lista de transacciones pendientes
- [x] Aprobación individual y masiva
- [x] Detección de duplicados
- [x] Modal de detalles con edición
- [x] Filtro de búsqueda

### FAB (Botón de Acción Flotante) ✅ - FASE 1
- [x] Posicionado correctamente (sin overlap con badge de Emergent)
- [x] Opción "Tomar Foto" - Abre cámara para capturar recibos
- [x] Opción "Subir Imagen" - Seleccionar de galería
- [x] Opción "Gasto Rápido" - Formulario manual con categorías rápidas
- [x] Procesamiento OCR con Gemini (fallback a entrada manual si falla)

### Ingresos (Con 3 pestañas) ✅ - FASE 2
- [x] **Tab "Ingresos Registrados"**: CRUD de ingresos con distribución (Personal/APX/USA)
- [x] **Tab "Ingresos Previstos"**: Gestión de ingresos esperados con fecha y status
- [x] **Tab "Cuentas por Cobrar"**: Facturas emitidas pendientes con registro de pagos parciales
- [x] Cards de resumen: Total Recibido, Esperado Pendiente, Por Cobrar, Flujo Proyectado
- [x] Marcar ingreso previsto como "Recibido" crea transacción automática

### Metas de Viaje ✅ - FASE 3
- [x] Nueva página /metas-viaje con CRUD completo
- [x] Cards de resumen: Meta Total, Total Ahorrado, Progreso General
- [x] Destinos preset (Miami, Nueva York, Orlando, Cancún, Galápagos, Europa)
- [x] Cálculo automático de ahorro mensual necesario
- [x] Botón "Agregar Ahorro" para registrar aportaciones
- [x] Indicador de días restantes y progreso visual

### Deudas y Tarjetas de Crédito ✅
- [x] CRUD de tarjetas (Diners, Pichincha, Pacificard, Apple)
- [x] Resumen de deuda total y utilización
- [x] Plan Avalanche con calculadora de pago extra
- [x] Corrección de bug al editar límites de tarjetas

### Planificación de Flujo ✅
- [x] Vista semanal (4 semanas)
- [x] Pagos programados por día/semana
- [x] Selección de método de pago

### Límites SRI (Vista Contadora) ✅
- [x] Cálculo basado en canasta básica 2025
- [x] 3 dependientes configurados
- [x] Tracking de gastos deducibles

---

## Tech Stack
- **Frontend**: React 18, Tailwind CSS, shadcn/ui, Framer Motion, Recharts
- **Backend**: FastAPI, Python 3.11
- **Database**: **MongoDB Atlas (Persistente)**
- **AI**: OpenAI GPT-5.2, Gemini 2.5 Flash (OCR) via Emergent LLM Key
- **Auth**: JWT con bcrypt
- **PDF Processing**: pdfplumber, PyPDF2

---

## API Endpoints Principales

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/auth/login | Autenticación |
| POST | /api/auth/register | Registro |
| GET | /api/auth/me | Usuario actual |

### Ingresos y Flujo de Caja (FASE 2)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /api/expected-income | Lista de ingresos previstos |
| POST | /api/expected-income | Crear ingreso previsto |
| PUT | /api/expected-income/{id} | Editar ingreso previsto |
| PUT | /api/expected-income/{id}/mark-received | Marcar como recibido |
| DELETE | /api/expected-income/{id} | Eliminar ingreso previsto |
| GET | /api/accounts-receivable | Lista de cuentas por cobrar |
| POST | /api/accounts-receivable | Crear cuenta por cobrar |
| PUT | /api/accounts-receivable/{id}/payment | Registrar pago |
| DELETE | /api/accounts-receivable/{id} | Eliminar cuenta |
| GET | /api/cashflow/projection | Proyección a 30 días |

### Metas de Viaje (FASE 3)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /api/travel-goals | Lista de metas de viaje |
| POST | /api/travel-goals | Crear meta |
| PUT | /api/travel-goals/{id} | Editar meta |
| PUT | /api/travel-goals/{id}/add-savings | Agregar ahorro |
| DELETE | /api/travel-goals/{id} | Eliminar meta |

### Otros
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/chatbot | Chatbot OpenAI |
| POST | /api/process/bank-statement | Procesar estado de cuenta PDF |
| POST | /api/process/receipt | Procesar recibo/factura |
| GET | /api/dashboard/stats | Estadísticas dashboard |
| GET | /api/reminders | Recordatorios inteligentes |

---

## Issues Conocidos

### Resueltos ✅
- [x] FAB bloqueado por badge de Emergent (movido a bottom-20)

### Pendientes (P1-P2)
1. **P1**: Backend devuelve 403 en lugar de 401 en fallos de autenticación
2. **P1**: Problema de visibilidad en dropdown de categorías
3. **P2**: Advertencias de react-hooks/exhaustive-deps en varios componentes

---

## Testing
- **Última iteración**: iteration_8.json
- **Backend**: 100% pass rate (19/19)
- **Frontend**: 95% (issue de FAB resuelto)
- **Credenciales de prueba**:
  - Admin: earauzt@gmail.com / Realmadrid2011
  - Familiar: karlapolit@gmail.com / Emilio87
  - Contadora: cmmgcontador@outlook.com / Arauz2025

---

## Cambios Recientes (Enero 2026)

### 28 Enero 2026 - Fases 1-3 Completadas ✅
1. **Fase 1 - FAB Corregido**: 
   - Reposicionado a bottom-20 para evitar overlap con badge de Emergent
   - Opciones de Tomar Foto, Subir Imagen, Gasto Rápido funcionando

2. **Fase 2 - Ingresos Mejorados**:
   - Página Ingresos con 3 pestañas (Ingresos, Previstos, Por Cobrar)
   - Backend endpoints funcionales para expected-income y accounts-receivable
   - Widget de Flujo Proyectado en Dashboard

3. **Fase 3 - Metas de Viaje**:
   - Nueva página /metas-viaje con CRUD completo
   - Destinos preset y cálculo de ahorro mensual
   - Widget en Dashboard mostrando metas activas

### Cambios Anteriores
- ✅ Integración con MongoDB Atlas (base de datos persistente)
- ✅ Script de seeding de datos (usuarios, tarjetas, diferidos)
- ✅ Procesamiento de PDF mejorado con pdfplumber + Gemini OCR
- ✅ Vista simplificada para rol "Familiar"
- ✅ Botón X en recordatorios del Dashboard

### 29 Enero 2026 - Fondo de Viajes Completado ✅
1. **Fondo de Viajes (Travel Fund)**:
   - Widget en /metas-viaje con nueva lógica de ahorro:
     - **Meta Anual**: Cuánto planeas destinar a viajes
     - **Ya Ahorrado**: Dinero que has apartado físicamente
     - **Gastado**: Transacciones de categoría "viajes_entretenimiento"
     - **Disponible para Gastar**: Ya Ahorrado - Gastado
     - **Progreso de Ahorro**: Barra visual del % ahorrado vs meta
   - Conexión automática: Los gastos de "Viajes y Entretenimiento" se descuentan del fondo
   - Backend endpoints: GET /api/travel-fund, POST /api/travel-fund/deposit, PUT /api/travel-fund/settings

2. **Corrección de Issues**:
   - JWT 401 vs 403: Ahora devuelve 401 con header WWW-Authenticate para tokens inválidos
   - Dropdowns de categorías: z-index aumentado a 250 para visibilidad en diálogos
   - Usuario Demo: Contraseña corregida a "demopass"

---

## Backlog / Próximas Tareas

### P0 (Crítica)
- [x] ~~Implementar Fases 1-3~~ ✅ COMPLETADO
- [x] ~~Implementar Fondo de Viajes~~ ✅ COMPLETADO

### P1 (Alta Prioridad)
- [x] ~~Corregir 403 -> 401 en autenticación fallida~~ ✅ COMPLETADO
- [x] ~~Corregir visibilidad dropdown de categorías~~ ✅ COMPLETADO
- [ ] Implementar Banner de Notificaciones Inteligentes (advertencias de flujo de caja, límites SRI)

### P2 (Media Prioridad)
- [ ] Mejoras de densidad en Dashboard
- [ ] Widget de "Próximas Acciones" en Dashboard
- [ ] Notificaciones push al acercarse a límites SRI (80%)
- [ ] Corregir advertencias exhaustive-deps en React hooks

### P3 (Baja Prioridad)
- [ ] Investigar integración directa con Apple Card
- [ ] Exportación de reportes a Excel/PDF mejorada
- [ ] Gráficos comparativos mes a mes
- [ ] Modo oscuro completo
