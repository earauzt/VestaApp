// Shared category → subcategory mapping. SINGLE SOURCE OF TRUTH.
// Mirrors models.py BUDGET_CATEGORIES. Any change here must be reflected in
// /app/backend/models.py BUDGET_CATEGORIES.
import { Utensils, HeartPulse, GraduationCap, Home, Shirt, Palmtree, Plane, Car } from "lucide-react";

export const PERSONAL_CATEGORIES = {
  servicios_basicos: {
    name: "Servicios Básicos",
    subcategories: ["Alícuota B", "Alícuota GT", "Luz", "Gas", "Celular", "Agua", "Clubes", "Internet"],
  },
  suscripciones: {
    name: "Suscripciones",
    subcategories: ["Netflix", "Spotify", "Amazon Prime", "Disney+", "YouTube Premium", "iCloud", "Otras"],
  },
  empleados: { name: "Empleados", subcategories: ["Ramona", "Angélica", "IESS"] },
  colegio_actividades: { name: "Colegio y Actividades", subcategories: ["Menor", "Fútbol", "Telas Aros"] },
  seguros: { name: "Seguros", subcategories: ["Salud", "Carros"] },
  comida: { name: "Comida", subcategories: ["Supermaxi", "Mercado"] },
  restaurantes: { name: "Restaurantes", subcategories: ["Comida afuera", "Delivery"] },
  carros: { name: "Carros", subcategories: ["Gasolina 1", "Gasolina 2", "Mantenimiento"] },
  usa: { name: "USA", subcategories: ["Mamá (Venmo)", "TMobile", "Universidad"] },
  viajes_entretenimiento: {
    name: "Viajes y Entretenimiento",
    subcategories: ["Hoteles", "Pasajes", "Comida", "Entretenimiento", "Ropa", "Tech", "Transporte", "Tours", "Otros"],
  },
  gastos_libres: { name: "Gastos Libres", subcategories: ["EA (Emilio)", "KP (Esposa)", "Otros"] },
  otros: { name: "Otros", subcategories: ["General"] },
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
    Icon: Utensils,
  },
  salud: {
    name: "Salud",
    deductible: true,
    limit_fraction: 1.3,
    subcategories: ["Seguros médicos", "Medicina", "Consultas", "Hospitalización", "Laboratorio", "Odontología"],
    Icon: HeartPulse,
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
    Icon: Home,
  },
  vestimenta: {
    name: "Vestimenta",
    deductible: true,
    limit_fraction: 0.325,
    subcategories: ["Ropa", "Calzado", "Accesorios"],
    Icon: Shirt,
  },
  turismo: {
    name: "Turismo Nacional",
    deductible: true,
    limit_fraction: 0.325,
    subcategories: ["Hoteles Ecuador", "Tours locales", "Transporte turístico"],
    Icon: Palmtree,
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
    Icon: Plane,
  },
};

export const INCOME_SOURCES = ["Personal", "APX", "USA"];
