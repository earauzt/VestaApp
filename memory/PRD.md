# FamilyFinance Ecuador - PRD

## Problema Original
App de gestión financiera personal para uso familiar (usuario, esposa, contadora) basada en leyes tributarias de Ecuador. Inspirada en QuickBooks con funciones de categorización automática, división de transacciones, adjuntar documentos y exportar reportes.

## User Personas
1. **Admin (Usuario principal)**: ARAUZ TRIVIÑO EMILIO JOSE - RUC: 0912514890001
2. **Esposa**: Visión general, puede ingresar datos y ver gastos
3. **Contadora**: Vista tributaria enfocada en deducciones SRI y reconciliación

## Datos del Contribuyente (desde RUC)
- RUC: 0912514890001
- Nombre: ARAUZ TRIVIÑO EMILIO JOSE
- Tipo: PERSONA NATURAL
- Régimen: GENERAL
- Obligado a contabilidad: NO
- Actividad: SERVICIOS DE MARKETING Y PUBLICIDAD
- Jurisdicción: ZONA 8 / GUAYAS / SAMBORONDON
- Cargas Familiares: 3 (esposa + 2 hijos menores)

## Lo Implementado

### Iteración 1 - MVP Base (Completado)
- ✅ Auth JWT con 3 roles (admin, spouse, accountant)
- ✅ Dashboard con gráficos de gastos e ingresos
- ✅ Transacciones CRUD completo
- ✅ Procesamiento de emails/OCR/Excel
- ✅ Categorías SRI Ecuador

### Iteración 2 - Gastos Internacionales (Completado)
- ✅ Subida múltiple de archivos
- ✅ Detección de gastos internacionales con popup de confirmación
- ✅ Página de Gastos Exterior separada
- ✅ Sugerencias de ajuste de budget basado en historial

### Iteración 3 - Límites SRI Ecuador (Completado)
- ✅ **Página Límites SRI** con info del RUC del usuario
- ✅ **Límites 2025 actualizados**:
  - Canasta Básica Familiar: $798.31
  - Fracción Básica Exenta: $11,902.00
  - Límite global por cargas familiares (7-17 CBF)
  - Rebaja IR: 18% de gastos deducibles
- ✅ **Categorías con límites específicos**:
  - Alimentación: $3,868.15 (0.325 × FBE)
  - Salud: $15,472.60 (1.3 × FBE) - enfermedades catastróficas
  - Educación: $3,868.15
  - Vivienda: $3,868.15
  - Vestimenta: $3,868.15
  - Turismo Nacional: $3,868.15
- ✅ **NO Deducibles identificados**:
  - Viajes internacionales
  - Pagos con tarjeta extranjera
  - Transporte
  - Entretenimiento
- ✅ **Alertas automáticas** cuando se acerca al límite (80%) o lo excede

### Iteración 4 - Funciones QuickBooks (Completado - 26 Enero 2026)
- ✅ **División de Transacciones (Split)**
  - Modal para dividir una transacción en múltiples categorías
  - Validación de balance (suma = monto original)
  - Botón de auto-balanceo
  - Indicador visual de estado (balanceado/falta asignar)
  
- ✅ **Adjuntar Documentos (Attachments)**
  - Subir recibos, facturas u otros documentos
  - Drag & drop con preview de imágenes
  - Tipos: Recibo, Factura, Otro documento
  - Visualización de adjuntos en lista de transacciones

- ✅ **Reglas de Categorización Automática**
  - Reglas predeterminadas para comercios Ecuador (Supermaxi, Fybeca, CNEL, etc.)
  - Crear reglas personalizadas por palabras clave
  - Probar categorización antes de crear regla
  - Auto-categorización al crear transacciones

- ✅ **Exportar Reportes**
  - Excel (.xlsx) con todas las transacciones y resumen SRI
  - PDF Reporte SRI con gastos deducibles por categoría
  - Cálculo de rebaja de impuesto a la renta

- ✅ **Integración OpenAI con Emergent LLM Key**
  - Predicciones de gastos por categoría
  - Consejos de optimización financiera
  - Tips para maximizar deducciones SRI

## Arquitectura Técnica

### Stack
- **Backend**: FastAPI + Python 3.11
- **Frontend**: React.js + Tailwind CSS + shadcn/ui
- **Database**: MongoDB
- **AI**: OpenAI GPT-5.2 (Emergent LLM Key)
- **Auth**: JWT con RBAC

### Estructura de Archivos
```
/app/
├── backend/
│   ├── server.py          # API principal con todos los endpoints
│   ├── uploads/           # Archivos adjuntos
│   └── tests/             # Tests pytest
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SplitTransactionModal.js
│   │   │   ├── AttachmentUploader.js
│   │   │   ├── ExportButtons.js
│   │   │   ├── CategoryRulesManager.js
│   │   │   ├── Layout.js
│   │   │   └── ui/        # shadcn components
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   ├── Transactions.js
│   │   │   ├── Budget.js
│   │   │   ├── Predictions.js
│   │   │   ├── SRILimits.js
│   │   │   ├── Reconciliation.js
│   │   │   └── ...
│   │   └── context/
│   │       └── AuthContext.js
└── memory/
    └── PRD.md
```

### Endpoints Principales
- `/api/auth/*` - Autenticación
- `/api/transactions/*` - CRUD transacciones
- `/api/transactions/split` - Dividir transacciones
- `/api/transactions/{id}/attachments` - Adjuntar documentos
- `/api/categorization-rules/*` - Reglas de categorización
- `/api/export/transactions/excel` - Exportar Excel
- `/api/export/sri/pdf` - Exportar PDF SRI
- `/api/predictions` - Predicciones AI
- `/api/sri/deduction-limits` - Límites SRI

## Próximas Tareas

### P1 - Alta Prioridad
1. **Popup gastos USA**: Implementar completamente la detección y confirmación de gastos en Estados Unidos
2. **Notificaciones push**: Alertar cuando una categoría llegue al 80% del límite SRI

### P2 - Media Prioridad
1. **Sistema de sugerencias de budget**: Análisis histórico para recomendar ajustes
2. **Integración facturas electrónicas SRI**: Conectar con el sistema de facturas del SRI

## Credenciales de Prueba
- **Email**: emilio@test.com
- **Password**: test1234
- **Role**: admin

## Resultados de Testing
- Backend: 100% (21/21 tests passed)
- Frontend: 100% (todas las funciones QuickBooks funcionando)
- Último test: 26 Enero 2026
