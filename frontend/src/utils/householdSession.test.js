import {
  AUTH_ME_PATH,
  HOUSEHOLD_DASHBOARD_PATH,
  householdAuthHeaders,
  isHouseholdSessionPayload,
  shouldRedirect401ToLogin,
} from "./householdSession";

describe("household session (no app password)", () => {
  test("session endpoint is GET /auth/me, not /auth/login", () => {
    expect(AUTH_ME_PATH).toBe("/auth/me");
    expect(AUTH_ME_PATH).not.toContain("login");
    expect(HOUSEHOLD_DASHBOARD_PATH).toBe("/dashboard");
  });

  test("a 401 never sends Emilio to /login", () => {
    expect(shouldRedirect401ToLogin()).toBe(false);
  });

  test("requests do not send a Bearer token or clave", () => {
    expect(householdAuthHeaders()).toEqual({});
  });

  test("GET /auth/me payload is the session", () => {
    expect(
      isHouseholdSessionPayload({
        id: "emilio",
        email: "earauzt@gmail.com",
        name: "Emilio Arauz",
        role: "admin",
      })
    ).toBe(true);
    expect(isHouseholdSessionPayload(null)).toBe(false);
    expect(isHouseholdSessionPayload({})).toBe(false);
  });
});
