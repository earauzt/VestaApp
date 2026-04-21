// Shared category → subcategory mapping.
// Mirrors the runtime `categories` state loaded from GET /api/budget/categories
// in Transactions.js (transformedCats), used as fallback when backend data
// is unavailable and as the canonical list of subcategories for each category.
import { Utensils, HeartPulse, GraduationCap, Home, Shirt, Palmtree, XCircle } from "lucide-react";

export const PERSONAL_CATEGORIES = {
  servicios_basicos: {
    name: "Servicios Básicos",
    subcategories: ["Alícuota B", "Alícuota GT", "Luz", "Gas", "Celular", "Agua", "Clubes", "Internet", "Suscripciones"],
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
  gastos_libres: { name: "Gastos Libres", subcategories: ["Varios"] },
  otros: { name: "Otros", subcategories: ["General"] },
};

export function getSubcategories(categoryKey) {
  return PERSONAL_CATEGORIES[categoryKey]?.subcategories || [];
}

// Categorías del SRI para deducciones fiscales en Ecuador (fuente única)
export const SRI_CATEGORIES = {
  alimentacion: {
    name: "Alimentación",
    deductible: true,
    limit_percent: 32.5,
    subcategories: ["Comida", "Restaurantes", "Supermercado", "Mercado", "Delivery"],
    Icon: Utensils,
  },
  salud: {
    name: "Salud",
    deductible: true,
    limit_percent: 200,
    subcategories: ["Seguros médicos", "Medicina", "Consultas", "Hospitalización", "Laboratorio", "Odontología"],
    Icon: HeartPulse,
  },
  educacion: {
    name: "Educación",
    deductible: true,
    limit_percent: 32.5,
    subcategories: ["Colegio", "Universidad", "Cursos", "Materiales", "Uniformes", "Transporte escolar"],
    Icon: GraduationCap,
  },
  vivienda: {
    name: "Vivienda",
    deductible: true,
    limit_percent: 32.5,
    subcategories: ["Arriendo", "Intereses hipoteca", "Servicios básicos", "Mantenimiento"],
    Icon: Home,
  },
  vestimenta: {
    name: "Vestimenta",
    deductible: true,
    limit_percent: 32.5,
    subcategories: ["Ropa", "Calzado", "Accesorios"],
    Icon: Shirt,
  },
  turismo: {
    name: "Turismo Nacional",
    deductible: true,
    limit_percent: 32.5,
    subcategories: ["Hoteles Ecuador", "Tours locales", "Transporte turístico"],
    Icon: Palmtree,
  },
  no_deducible: {
    name: "No Deducible",
    deductible: false,
    limit_percent: 0,
    subcategories: ["Viajes internacionales", "Entretenimiento", "Otros"],
    Icon: XCircle,
  },
};

export const INCOME_SOURCES = ["Personal", "APX", "USA"];
