import { displayName, sanitizeDescription } from "./displayName";

describe("sanitizeDescription", () => {
  test("strips literal ? from Consumo Bolivariano lines", () => {
    expect(sanitizeDescription("Consumo Bolivariano: ? $9.14")).toBe("Consumo Bolivariano: $9.14");
  });

  test("does not dump a raw Diners notification body", () => {
    const body = "Estimado cliente Diners Club le informa un consumo. Si usted no reconoce esta transaccion no solicite su clave. Este correo es informativo www.dinersclub.com.ec anti-phishing boilerplate ".repeat(8);
    const cleaned = sanitizeDescription(body);
    expect(cleaned.length).toBeLessThanOrEqual(45);
    expect(cleaned.toLowerCase()).not.toContain("phishing");
    expect(cleaned.toLowerCase()).not.toContain("www.");
  });

  test("keeps a short merchant name", () => {
    expect(sanitizeDescription("SUPERMAXI SAMBORONDON")).toBe("SUPERMAXI SAMBORONDON");
  });
});

describe("displayName", () => {
  test("prefers comercio over a long description", () => {
    expect(displayName({ comercio: "FYBECA", description: "x".repeat(400) })).toBe("FYBECA");
  });

  test("falls back when comercio is only ?", () => {
    expect(displayName({ comercio: "?", descripcion_corta: "Consumo Bolivariano $9.14" })).toBe("Consumo Bolivariano $9.14");
  });
});
