// Vesta Design System — Forest palette
// Central source of truth for colors, typography, and component styles.

export const colors = {
  primary: '#0D9E82',
  primaryHover: '#0B8A70',
  background: '#F8FAF9',
  backgroundSecondary: '#F8FAF9',
  text: '#0F1D1A',
  textSecondary: '#5C7A74',
  textMuted: '#6B8F87',
  border: '#E2EAE8',
  sidebarBg: '#0F1D1A',
  sidebarText: '#6B8F87',
  sidebarActiveBg: '#1A3330',
  sidebarActiveText: '#FFFFFF',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
};

export const typography = {
  pageTitle: 'text-2xl font-semibold text-[#0F1D1A]',
  pageSubtitle: 'text-sm text-[#5C7A74]',
  sectionTitle: 'text-sm font-semibold text-[#5C7A74] uppercase tracking-wide',
  cardTitle: 'text-base font-medium text-[#0F1D1A]',
  metric: 'text-3xl font-bold',
  label: 'text-xs text-[#6B8F87]',
  body: 'text-sm text-[#0F1D1A]',
  muted: 'text-xs text-[#6B8F87]',
};

export const components = {
  card: 'bg-white border border-[#E2EAE8] rounded-lg p-6 shadow-sm',
  cardCompact: 'bg-white border border-[#E2EAE8] rounded-lg p-4 shadow-sm',
  buttonPrimary: 'bg-[#0D9E82] text-white hover:bg-[#0B8A70] rounded-md px-4 py-2 text-sm font-medium transition-colors',
  buttonSecondary: 'border border-[#E2EAE8] text-[#0F1D1A] hover:bg-[#F8FAF9] rounded-md px-4 py-2 text-sm transition-colors',
  buttonGhost: 'text-[#6B8F87] hover:text-[#0F1D1A] p-1 rounded transition-colors',
  input: 'border border-[#E2EAE8] rounded-md px-3 py-2 text-sm text-[#0F1D1A] focus:outline-none focus:ring-2 focus:ring-[#0D9E82] focus:border-transparent',
  badge: 'text-xs font-medium px-2 py-0.5 rounded-full',
  badgeDanger: 'text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600',
  badgeWarning: 'text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600',
  badgeSuccess: 'text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600',
  badgeNeutral: 'text-xs font-medium px-2 py-0.5 rounded-full bg-[#F8FAF9] text-[#5C7A74]',
  divider: 'border-b border-[#E2EAE8]',
  accentBorder: 'border-l-4 border-l-[#0D9E82]',
};

export default { colors, typography, components };

// Semantic colors for consistent UI across all pages.
// Use these instead of inline Tailwind for amounts/states/buttons/badges.
export const semanticColors = {
  // Montos
  income: 'text-emerald-600',
  expense: 'text-red-600',
  neutral: 'text-slate-800',
  // Estados
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-600 border border-red-200',
  info: 'bg-slate-100 text-slate-600 border border-slate-200',
  // Botones
  btnPrimary: 'bg-[#0D9E82] hover:bg-[#0B8A70] text-white rounded-md px-4 py-2 text-sm font-medium',
  btnSecondary: 'border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md px-4 py-2 text-sm',
  btnDanger: 'text-red-600 hover:text-red-700 text-sm',
  // Badges
  badgeDefault: 'text-xs px-2 py-0.5 rounded-full border',
};
