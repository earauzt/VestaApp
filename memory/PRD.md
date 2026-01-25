# FamilyFinance Ecuador - PRD

## Problema Original
App de gestión financiera personal para uso familiar (usuario, esposa, contadora) basada en leyes tributarias de Ecuador.

## User Personas
1. **Admin (Usuario principal)**: ARAUZ TRIVIÑO EMILIO JOSE - RUC: 0912514890001
2. **Esposa**: Visión general, puede ingresar datos y ver gastos
3. **Contadora**: Vista tributaria enfocada en deducciones SRI

## Lo Implementado

### Iteración 1 - MVP Base
- Auth JWT con 3 roles
- Dashboard con gráficos
- Transacciones CRUD
- Procesamiento de emails/OCR/Excel
- Predicciones AI

### Iteración 2 - Gastos Internacionales
- Subida múltiple de archivos
- Detección de gastos internacionales con popup
- Página de Gastos Exterior separada
- Sugerencias de ajuste de budget

### Iteración 3 - Límites SRI Ecuador (ACTUAL)
- ✅ **Nueva página Límites SRI** con info del RUC del usuario
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
- ✅ **Selector de cargas familiares** para calcular límite correcto

## Datos del Contribuyente (desde RUC)
- RUC: 0912514890001
- Nombre: ARAUZ TRIVIÑO EMILIO JOSE
- Tipo: PERSONA NATURAL
- Régimen: GENERAL
- Obligado a contabilidad: NO
- Actividad: SERVICIOS DE MARKETING Y PUBLICIDAD
- Jurisdicción: ZONA 8 / GUAYAS / SAMBORONDON

## Próximas Tareas
1. Agregar más cargas familiares específicas (hijos, dependientes)
2. Exportar resumen tributario a PDF para Anexo Gastos Personales
3. Notificaciones cuando se acerque al límite de un rubro
4. Integración con facturas electrónicas del SRI
