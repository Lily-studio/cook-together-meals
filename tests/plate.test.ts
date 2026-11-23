import { describe, expect, test } from "bun:test";
import { diaryNeedsConfirmation, plateSchema, plateTotals } from "../src/lib/plate";
const component = { name: "Chicken", grams: 150, per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 } };
describe("plate estimates", () => {
  test("whole plate totals include separate components without extra servings", () => {
    expect(plateTotals([component, { name: "Rice", grams: 200, per100g: { calories: 130, protein: 2.7, carbs: 28, fat: .3, fiber: .4 } }])).toEqual({ calories: 507.5, protein: 51.9, carbs: 56, fat: 6, fiber: .8 });
  });
  test("corrected quantities recalculate every macro", () => {
    expect(plateTotals([{ ...component, grams: 100 }])).toEqual({ calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 });
  });
  test("unknown fiber is not presented as zero", () => { expect(plateTotals([{ ...component, per100g: { ...component.per100g, fiber: null } }]).fiber).toBeNull(); });
  test("rejects negative portions", () => { expect(plateSchema.safeParse({ name: "Plate", portion: "one", method: "grilled", uncertainty: "Oil unknown", questions: [], steps: ["Cook"], components: [{ ...component, grams: -1 }] }).success).toBe(false); });
  test("Lily cannot add food without a review confirmation", () => { expect(diaryNeedsConfirmation([{ kind: "log_food" }])).toBe(true); expect(diaryNeedsConfirmation([{ kind: "record_create", table: "food_logs" }])).toBe(true); expect(diaryNeedsConfirmation([{ kind: "record_create", table: "pantry_items" }])).toBe(false); });
});