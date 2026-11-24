import { describe, expect, test } from "bun:test";
import { diaryNeedsConfirmation, diaryRequestSchema, plateSchema, plateTotals, persistConfirmedDiary, type DiaryRow } from "../src/lib/plate";
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
describe("confirmed diary persistence", () => {
  const id = "559f28ef-5e8f-41f7-98f2-c57c41674f9c";
  const request = { id, confirmed: true, values: { description: "Chicken and rice", slot: "lunch", calories: 507.5, protein: 51.9, carbs: 56, fat: 6 } };
  const owner = { userId: "signed-in-user", householdId: "their-household" };
  const createStore = () => {
    const rows = new Map<string, DiaryRow>();
    return { rows, find: async (key: string) => rows.get(key) ?? null, insertOnce: async (row: DiaryRow) => { if (rows.has(row.id)) return false; rows.set(row.id, row); return true; } };
  };
  test("nothing is written before explicit confirmation", async () => {
    const store = createStore();
    await expect(persistConfirmedDiary(store, { ...request, confirmed: false }, owner, "2026-11-24")).rejects.toThrow();
    expect(store.rows.size).toBe(0);
  });
  test("concurrent double tap and later retry create one diary entry", async () => {
    const store = createStore();
    await Promise.all([persistConfirmedDiary(store, request, owner, "2026-11-24"), persistConfirmedDiary(store, request, owner, "2026-11-24")]);
    expect(store.rows.size).toBe(1);
    expect(await persistConfirmedDiary(store, request, owner, "2026-11-24")).toEqual({ id, alreadySaved: true });
  });
  test("ownership comes only from authenticated context", async () => {
    const store = createStore();
    await persistConfirmedDiary(store, { ...request, profile_id: "someone-else", household_id: "wrong" }, owner, "2026-11-24");
    expect(store.rows.get(id)?.profile_id).toBe("signed-in-user");
    expect(store.rows.get(id)?.household_id).toBe("their-household");
    await expect(persistConfirmedDiary(store, request, { ...owner, userId: "intruder" }, "2026-11-24")).rejects.toThrow("isn't yours");
  });
  test("invalid calories and meal category cannot be saved", () => {
    expect(diaryRequestSchema.safeParse({ ...request, values: { ...request.values, calories: -1 } }).success).toBe(false);
    expect(diaryRequestSchema.safeParse({ ...request, values: { ...request.values, slot: "unknown" } }).success).toBe(false);
  });
});