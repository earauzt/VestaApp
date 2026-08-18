// Shared category → subcategory mapping. SINGLE SOURCE OF TRUTH.
// Mirrors models.py BUDGET_CATEGORIES. Any change here must be reflected in
// /app/backend/models.py BUDGET_CATEGORIES.
import { ForkKnife, Heartbeat, GraduationCap, House, TShirt, TreePalm, Car, Airplane } from "@phosphor-icons/react";

// "group"/"groupName": metadata de presentacion (jerarquia grupo->categoria,
// YNAB/Monarch-style). No cambian las `key` de categoria reales. Los nombres
// de subcategoria que eran datos personales (nombres del personal domestico,
// iniciales de los conyuges) se generizaron — la identidad real vive ahora en
// la etiqueta de entidad, no en el nombre de la subcategoria.
export const PERSONAL_CATEGORIES = {
  servicios_basicos: {
    name: "Servicios Básicos",
    group: "vivienda_servicios", groupName: "Vivienda y servicios",
    subcategories: ["Alícuota B", "Alícuota GT", "Luz", "Gas", "Celular", "Agua", "Clubes", "Internet"],
  },
  suscripciones: {
    name: "Suscripciones",
    group: "suscripciones", groupName: "Suscripciones",
    subcategories: ["Netflix", "Spotify", "Amazon Prime", "Disney+", "YouTube Premium", "iCloud", "Otras"],
  },
  empleados: {
    name: "Personal Doméstico",
    group: "personal_domestico", groupName: "Personal doméstico",
    subcategories: ["Personal doméstico 1", "Personal doméstico 2", "Aportes IESS"],
  },
  colegio_actividades: {
    name: "Colegio y Actividades",
    group: "salud_educacion_familia", groupName: "Salud, educación y familia",
    subcategories: ["Menor", "Fútbol", "Telas Aros"],
  },
  seguros: {
    name: "Seguros",
    group: "salud_educacion_familia", groupName: "Salud, educación y familia",
    subcategories: ["Salud", "Carros"],
  },
  comida: {
    name: "Comida",
    group: "alimentacion", groupName: "Alimentación",
    subcategories: ["Supermaxi", "Mercado"],
  },
  restaurantes: {
    name: "Restaurantes",
    group: "alimentacion", groupName: "Alimentación",
    subcategories: ["Comida afuera", "Delivery"],
  },
  carros: {
    name: "Carros",
    group: "transporte", groupName: "Transporte",
    subcategories: ["Gasolina 1", "Gasolina 2", "Mantenimiento"],
  },
  usa: {
    name: "USA",
    group: "internacional_otros", groupName: "Internacional y otros",
    subcategories: ["Remesas familiares", "TMobile", "Universidad"],
  },
  viajes_entretenimiento: {
    name: "Viajes y Entretenimiento",
    group: "ocio_viajes_personal", groupName: "Ocio, viajes y personal",
    subcategories: ["Hoteles", "Pasajes", "Comida", "Entretenimiento", "Ropa", "Tech", "Transporte", "Tours", "Otros"],
  },
  gastos_libres: {
    name: "Gastos Personales",
    group: "ocio_viajes_personal", groupName: "Ocio, viajes y personal",
    subcategories: ["Gasto personal 1", "Gasto personal 2", "Otros"],
  },
  otros: {
    name: "Otros",
    group: "internacional_otros", groupName: "Internacional y otros",
    subcategories: ["General"],
  },
};

export function getSubcategories(categoryKey) {
  return PERSONAL_CATEGORIES[categoryKey]?.subcategories || [];
}

// SRI categories for Ecuador tax deductions. Limits stored as DECIMAL FRACTIONS
// (e.g. 0.325 = 32.5%, 1.3 = 130%). Mirrors models.py SRI_CATEGORIES.
export const SRI_CATEGORIES = {
  alimentacion: {
    name: "Alimentación",
    deductible: true,
    limit_fraction: 0.325,
    subcategories: ["Comida", "Restaurantes", "Supermercado", "Mercado", "Delivery"],
    Icon: ForkKnife,
  },
  salud: {
    name: "Salud",
    deductible: true,
    limit_fraction: 1.3,
    subcategories: ["Seguros médicos", "Medicina", "Consultas", "Hospitalización", "Laboratorio", "Odontología"],
    Icon: Heartbeat,
  },
  educacion: {
    name: "Educación",
    deductible: true,
    limit_fraction: 0.325,
    subcategories: ["Colegio", "Universidad", "Maestría", "Cursos", "Materiales", "Uniformes", "Transporte escolar"],
    Icon: GraduationCap,
  },
  vivienda: {
    name: "Vivienda",
    deductible: true,
    limit_fraction: 0.325,
    subcategories: ["Arriendo", "Intereses hipoteca", "Servicios básicos", "Mantenimiento"],
    Icon: House,
  },
  vestimenta: {
    name: "Vestimenta",
    deductible: true,
    limit_fraction: 0.325,
    subcategories: ["Ropa", "Calzado", "Accesorios"],
    Icon: TShirt,
  },
  turismo: {
    name: "Turismo Nacional",
    deductible: true,
    limit_fraction: 0.325,
    subcategories: ["Hoteles Ecuador", "Tours locales", "Transporte turístico"],
    Icon: TreePalm,
  },
  transporte: {
    name: "Transporte (no deducible)",
    deductible: false,
    limit_fraction: 0,
    subcategories: ["Carros", "Combustible", "Mantenimiento vehicular", "Taxi", "Bus"],
    Icon: Car,
  },
  viajes_internacionales: {
    name: "Viajes Internacionales (no deducible)",
    deductible: false,
    limit_fraction: 0,
    subcategories: ["USA", "Europa", "Otros países"],
    Icon: Airplane,
  },
};

export const INCOME_SOURCES = ["Personal", "APX", "USA"];

// Etiqueta de entidad/dueno — ortogonal a PERSONAL_CATEGORIES. Espejo estatico
// de backend ENTITY_TAGS / la tabla vesta_entity_tags (ver
// migrations/013_vesta_entity_tags.sql). Los componentes que ya llaman a
// GET /api/entity-tags usan la respuesta real; este array es el fallback
// cuando no hay red o la migracion aun no corrio.
export const ENTITY_TAGS = [
  { key: "personal", name: "Personal" },
  { key: "pareja", name: "Pareja" },
  { key: "hogar", name: "Hogar / compartido" },
  { key: "domestico", name: "Personal doméstico" },
  { key: "internacional", name: "Internacional / familia" },
  { key: "negocio", name: "Negocio" },
];
