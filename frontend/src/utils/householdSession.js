/**
 * Vesta is a single-household app. GET /auth/me always returns Emilio.
 * The lock is the Vercel URL / Deployment Protection, not a clave.
 * There is no POST /auth/login or /auth/register.
 */

export const AUTH_ME_PATH = "/auth/me";
export const HOUSEHOLD_DASHBOARD_PATH = "/dashboard";

export function shouldRedirect401ToLogin() {
  return false;
}

export function householdAuthHeaders() {
  return {};
}

export function isHouseholdSessionPayload(data) {
  return Boolean(data && data.id && data.role);
}
