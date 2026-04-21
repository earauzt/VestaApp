// Vesta Design System
// Central source of truth for colors, typography, and component styles.
// Import these constants across pages to keep the app consistent.

export const colors = {
  primary: '#0F766E',
  primaryHover: '#0D6B63',
  background: '#FFFFFF',
  backgroundSecondary: '#F8FAFC',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
};

export const typography = {
  pageTitle: 'text-2xl font-semibold text-slate-800',
  pageSubtitle: 'text-sm text-slate-500',
  sectionTitle: 'text-sm font-semibold text-slate-500 uppercase tracking-wide',
  cardTitle: 'text-base font-medium text-slate-800',
  metric: 'text-3xl font-bold',
  label: 'text-xs text-slate-400',
  body: 'text-sm text-slate-700',
  muted: 'text-xs text-slate-400',
};

export const components = {
  card: 'bg-white border border-slate-200 rounded-lg p-6 shadow-sm',
  cardCompact: 'bg-white border border-slate-200 rounded-lg p-4 shadow-sm',
  buttonPrimary: 'bg-[#0F766E] text-white hover:bg-[#0D6B63] rounded-md px-4 py-2 text-sm font-medium transition-colors',
  buttonSecondary: 'border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md px-4 py-2 text-sm transition-colors',
  buttonGhost: 'text-slate-400 hover:text-slate-700 p-1 rounded transition-colors',
  input: 'border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent',
  badge: 'text-xs font-medium px-2 py-0.5 rounded-full',
  badgeDanger: 'text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600',
  badgeWarning: 'text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600',
  badgeSuccess: 'text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600',
  badgeNeutral: 'text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600',
  divider: 'border-b border-slate-100',
  accentBorder: 'border-l-4 border-l-[#0F766E]',
};

export default { colors, typography, components };
