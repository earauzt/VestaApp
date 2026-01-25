# FamilyFinance Ecuador - PRD

## Problema Original
App de gestión financiera personal para uso familiar (usuario, esposa, contadora) basada en leyes tributarias de Ecuador. Permite:
- Reenviar emails de consumo de tarjeta de crédito y clasificarlos
- Subir fotos de recibos y clasificarlos con OCR AI
- Subir estados de cuenta y clasificarlos
- Subir Excel de planificación financiera para estructurar budget
- Dashboard con gastos diarios, semanales, proyección
- Predicciones AI y consejos de optimización

## User Personas
1. **Admin (Usuario principal)**: Acceso completo a todos los módulos
2. **Esposa**: Visión general, puede ingresar datos y ver gastos
3. **Contadora**: Vista tributaria enfocada en deducciones SRI

## Requisitos Core
- Categorías SRI Ecuador: Alimentación, Salud, Educación, Vivienda, Vestimenta (deducibles)
- Categorías NO deducibles: Transporte, Viajes Internacionales, Otros
- Subcategorías: Servicios básicos, Empleados, Colegio y actividades, Seguros, Comida, Restaurantes, Carros, Viajes
- Fuentes de ingreso: Personal, APX, USA
- Moneda: USD

## Lo Implementado

### Iteración 1 (25 Enero 2026)
- ✅ API FastAPI con MongoDB
- ✅ Auth JWT con 3 roles (admin, spouse, accountant)
- ✅ CRUD transacciones con categorías SRI
- ✅ Dashboard stats: balance, ingresos, gastos diarios/semanales/mensuales
- ✅ Procesamiento de emails de tarjeta PacifiCard
- ✅ OCR de recibos con Gemini Vision
- ✅ Importación de Excel de planificación
- ✅ Predicciones AI con OpenAI GPT-5.2
- ✅ Vista contadora con resumen tributario

### Iteración 2 (25 Enero 2026)
- ✅ **Subida múltiple de archivos/imágenes** (drag & drop)
- ✅ **Popup de confirmación para gastos internacionales** (detecta USA, Miami, Amazon.com, etc.)
- ✅ **Página de Gastos Internacionales** separada
- ✅ **Filtro por tipo de tarjeta** (local vs extranjera)
- ✅ **Sugerencias de ajuste de budget** basadas en historial (últimos 6 meses)
- ✅ **Categoría Viajes Internacionales** marcada como NO deducible
- ✅ Campo payment_source en transacciones (local/internacional)

## Backlog Priorizado
### P0 (Crítico)
- N/A

### P1 (Alta prioridad)
- [ ] Mejorar dropdown de categorías en modal (UX)
- [ ] Exportación a PDF para contadora
- [ ] Límites de deducciones SRI por rubro (% canasta básica)

### P2 (Media prioridad)
- [ ] Notificaciones de exceso de presupuesto
- [ ] Sincronización con bancos ecuatorianos
- [ ] Multi-moneda

### P3 (Baja prioridad)
- [ ] App móvil
- [ ] Modo offline

## Próximas Tareas
1. Implementar límites específicos SRI según RUC del usuario
2. Mejorar detección de países en OCR
3. Dashboard comparativo con año anterior
