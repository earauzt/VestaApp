# FamilyFinance Ecuador - PRD

## Problema Original
App de gestión financiera personal para uso familiar (usuario, esposa, contadora) basada en leyes tributarias de Ecuador. Inspirada en QuickBooks con funciones de categorización automática, división de transacciones, adjuntar documentos y exportar reportes.

## User Personas
1. **Admin (Usuario principal)**: ARAUZ TRIVIÑO EMILIO JOSE - RUC: 0912514890001
2. **Esposa (KP)**: Visión general, puede ingresar datos, gastos libres $800/mes
3. **Contadora**: Vista tributaria enfocada en deducciones SRI y conciliación

## Datos del Contribuyente
- RUC: 0912514890001
- Nombre: ARAUZ TRIVIÑO EMILIO JOSE
- Cargas Familiares: 3 (esposa + 2 hijos menores)

## Estructura de Ingresos (Distribución para Impuestos)
- **Personal**: $7,250/mes = $87,000/año
- **APX**: $2,500/mes = $30,000/año
- **USA**: $1,595/mes = $19,140/año
- **Total**: ~$136,140/año

## Categorías Presupuesto Personal (desde Excel)
| Categoría | Subcategorías | Tipo | Recurrente |
|-----------|--------------|------|------------|
| Servicios Básicos | Alícuota B, Alícuota GT, Luz, Gas, Celular, Agua, Clubes, Internet | Fijo | Sí |
| Empleados | Ramona, Angélica, IESS | Fijo | Sí |
| Colegio y Actividades | Menor, Fútbol, Telas, Aros | Fijo | Sí |
| Seguros | Salud, Carros | Fijo | Sí |
| Comida | Supermaxi, Mercado | Variable | No |
| Restaurantes | Comida afuera, Delivery | Variable | No |
| Carros | Gasolina 1, Gasolina 2, Mantenimiento | Variable | No |
| USA | Transfer Mamá (Venmo), Universidad bebés, TMobile | Fijo | Sí |
| Viajes | Pasajes, Navidad, Marzo, Junio | Variable | No |
| Gastos Libres | KP ($800/mes), EA ($500/mes) | Discrecional | Sí |

## Metas Financieras
- Gastos Fijos: 55-65% del total
- Ahorro: 10%
- Inversión: 15%
- Gastos Libres: máx $30,000/año

## Lo Implementado

### Iteración 1-3 - Base Completada
- ✅ Auth JWT con 3 roles
- ✅ Dashboard con gráficos
- ✅ Transacciones CRUD
- ✅ OCR de recibos
- ✅ Categorías SRI Ecuador
- ✅ Límites SRI 2025
- ✅ Funciones QuickBooks (split, attachments, rules, export)

### Iteración 4 - Mejoras Solicitadas (26 Enero 2026)

#### ✅ Nueva Página de Ingresos
- Registro manual de ingresos con distribución (Personal/APX/USA)
- Campos: Monto, Fecha, Distribución, Concepto, Descripción, Recurrente, Método de pago
- Resumen por distribución (cards con totales)
- Lista de ingresos con edición y eliminación

#### ✅ Categorías de Presupuesto Personal
- Separado de categorías SRI
- Importado desde Excel del usuario
- Incluye: servicios_basicos, empleados, colegio_actividades, seguros, comida, restaurantes, carros, usa, viajes, gastos_libres
- Límites mensuales para gastos libres (KP $800, EA $500)

#### ✅ Método de Pago Auto-detectado
- Opciones: Transferencia, Tarjeta, Efectivo, Venmo, Apple Card
- Detección automática por keywords

#### ✅ Conciliación Mejorada
- Vista de detalle al hacer click (botón ojo)
- Contadora puede editar todos los campos
- Establecimiento mostrado primero
- Notas de revisión editables
- Aprobar/Rechazar desde vista de detalle

#### ✅ Dashboard con Metas Financieras
- Gastos Fijos (meta: 55-65%) con barra de progreso
- Gastos Libres (máx. $30k/año) con disponible
- Categorías del presupuesto personal (no SRI)

#### ✅ Diseño Responsive
- Mobile (390x844): Header con hamburger menu, slide-out navigation
- Tablet (1024x768): Sidebar colapsable, layout adaptativo
- Cards en grid 2x2 en móvil

#### ✅ Upload Simplificado
- Removido tab de "Email" (usuario usa screenshots)
- Solo 2 tabs: Screenshots/Recibos y Excel

#### ✅ Navegación Actualizada
- Nuevo item: "Ingresos" para admin/spouse
- Límites SRI: Solo visible para admin/accountant
- Conciliación: Solo admin/accountant
- Orden lógico de menú

## Arquitectura Técnica

### Stack
- **Backend**: FastAPI + Python 3.11
- **Frontend**: React.js + Tailwind CSS + shadcn/ui
- **Database**: MongoDB
- **Auth**: JWT con RBAC

### Endpoints Principales
```
/api/auth/*                     - Autenticación
/api/transactions/*             - CRUD transacciones
/api/transactions/split         - Dividir transacciones
/api/transactions/grouped       - Vista agrupada por establecimiento
/api/income/*                   - CRUD ingresos (NUEVO)
/api/income/summary             - Resumen por distribución (NUEVO)
/api/budget/categories          - Categorías presupuesto personal (NUEVO)
/api/budget/personal            - Presupuesto con metas (NUEVO)
/api/categorization-rules/*     - Reglas auto-categorización
/api/export/transactions/excel  - Exportar Excel
/api/export/sri/pdf             - Exportar PDF SRI
/api/reconciliation/*           - Conciliación para contadora
/api/sri/deduction-limits       - Límites SRI
```

## Próximas Tareas

### P1 - Alta Prioridad
1. **Vista acordeón de transacciones**: Agrupar por establecimiento+fecha (ej: "Supermaxi - 26 Ene" → expandir items)
2. **Popup gastos USA**: Confirmar si gasto es viaje internacional

### P2 - Media Prioridad
1. **Notificaciones**: Alertar cuando categoría llegue al 80% del límite
2. **Sincronización Apple Card**: Importar CSV/exportar desde Apple Wallet

## Credenciales de Prueba
- **Email**: emilio@test.com
- **Password**: test1234
- **Role**: admin

## Resultados de Testing (Iteración 4)
- Backend: 100% (17/17 tests passed)
- Frontend: 100% (todas las features verificadas)
- Responsive: Verificado en móvil (390x844) y tablet (1024x768)
