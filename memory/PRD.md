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
- Categorías SRI Ecuador: Alimentación, Salud, Educación, Vivienda, Vestimenta
- Subcategorías personalizadas: Servicios básicos, Empleados, Colegio y actividades, Seguros, Comida, Restaurantes, Carros, Viajes y Entretenimiento
- Fuentes de ingreso: Personal, APX, USA
- Moneda: USD

## Lo Implementado (25 Enero 2026)
### Backend
- ✅ API FastAPI con MongoDB
- ✅ Auth JWT con 3 roles (admin, spouse, accountant)
- ✅ CRUD transacciones con categorías SRI
- ✅ Dashboard stats: balance, ingresos, gastos diarios/semanales/mensuales
- ✅ Procesamiento de emails de tarjeta
- ✅ OCR de recibos con Gemini Vision
- ✅ Importación de Excel de planificación
- ✅ Predicciones AI con OpenAI GPT-5.2
- ✅ Vista contadora con resumen tributario

### Frontend
- ✅ Login/Registro con roles
- ✅ Dashboard con gráficos (Area, Pie, Bar)
- ✅ Gestión de transacciones (CRUD)
- ✅ Cargar datos (Email, Recibo, Excel)
- ✅ Vista Presupuesto vs Real
- ✅ Predicciones AI
- ✅ Vista Contadora

## Backlog Priorizado
### P0 (Crítico)
- N/A (MVP funcional)

### P1 (Alta prioridad)
- [ ] Integración real con email forwarding
- [ ] Exportación a PDF para contadora
- [ ] Notificaciones de exceso de presupuesto

### P2 (Media prioridad)
- [ ] Sincronización con bancos ecuatorianos
- [ ] Multi-moneda (convertir a USD)
- [ ] Historial de cambios de transacciones

### P3 (Baja prioridad)
- [ ] App móvil
- [ ] Modo offline
- [ ] Temas personalizados

## Próximas Tareas
1. Mejorar OCR para facturas ecuatorianas (Aleph)
2. Agregar límites de deducciones SRI por rubro
3. Dashboard comparativo año anterior
