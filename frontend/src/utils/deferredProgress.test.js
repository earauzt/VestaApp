import { deferredInstallmentProgress, isBudgetSaveEnabled } from "./deferredProgress";

describe("deferredInstallmentProgress", () => {
  test("13 remaining of 15 is 2 paid = 13.3%", () => {
    const r = deferredInstallmentProgress(15, 13);
    expect(r.paid).toBe(2);
    expect(r.remaining).toBe(13);
    expect(r.percentPaid).toBeCloseTo((2 / 15) * 100, 5);
    expect(Math.round(r.percentPaid)).toBe(13);
  });

  test("13 remaining of 21 is 8 paid ≈ 38%", () => {
    const r = deferredInstallmentProgress(21, 13);
    expect(r.paid).toBe(8);
    expect(Math.round(r.percentPaid)).toBe(38);
  });

  test("does not treat remaining count as the percent", () => {
    const r = deferredInstallmentProgress(15, 13);
    expect(r.percentPaid).not.toBe(13);
    expect(r.percentPaid).not.toBeCloseTo((13 / 15) * 100);
  });

  test("zero total is safe", () => {
    const r = deferredInstallmentProgress(0, 0);
    expect(r.percentPaid).toBe(0);
    expect(r.paid).toBe(0);
  });
});

describe("isBudgetSaveEnabled", () => {
  test("starts disabled when clean", () => {
    expect(isBudgetSaveEnabled(false, false)).toBe(false);
  });

  test("enabled only when dirty and not saving", () => {
    expect(isBudgetSaveEnabled(true, false)).toBe(true);
    expect(isBudgetSaveEnabled(true, true)).toBe(false);
  });
});
