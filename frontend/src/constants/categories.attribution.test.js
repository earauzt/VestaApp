import {
  DEFAULT_ENTITY_TAG,
  familyAttributionLabel,
  mergeFamilyAttributionTags,
} from "./categories";

describe("family attribution", () => {
  test("new expenses default to Emilio (titular), not unassigned", () => {
    expect(DEFAULT_ENTITY_TAG).toBe("titular");
    expect(familyAttributionLabel(DEFAULT_ENTITY_TAG)).toBe("Emilio");
  });

  test("KP is a first-class household label", () => {
    expect(familyAttributionLabel("adicional_kp")).toBe("KP");
  });

  test("does not invent a label for historical rows without a tag", () => {
    expect(familyAttributionLabel("")).toBe("");
    expect(familyAttributionLabel(undefined)).toBe("");
  });

  test("stale API tags still expose Emilio and KP", () => {
    const merged = mergeFamilyAttributionTags([
      { key: "personal", name: "Personal", sort_order: 3 },
    ]);
    const keys = merged.map((t) => t.key);
    expect(keys).toContain("titular");
    expect(keys).toContain("adicional_kp");
    expect(merged.find((t) => t.key === "titular").name).toBe("Emilio");
    expect(merged.find((t) => t.key === "adicional_kp").name).toBe("KP");
  });
});
