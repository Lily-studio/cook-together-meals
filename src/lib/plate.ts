import { z } from "zod";

export const nutrientsSchema = z.object({
  calories: z.number().finite().min(0).max(2000), protein: z.number().finite().min(0).max(200),
  carbs: z.number().finite().min(0).max(200), fat: z.number().finite().min(0).max(200),
  fiber: z.number().finite().min(0).max(100).nullable(),
});
export const plateSchema = z.object({
  name: z.string().min(2).max(120), portion: z.string().max(200),
  method: z.string().max(200), uncertainty: z.string().min(1).max(1200),
  questions: z.array(z.string().max(240)).max(6),
  components: z.array(z.object({ name: z.string().min(1).max(120), grams: z.number().finite().min(0).max(3000), per100g: nutrientsSchema })).min(1).max(30),
  steps: z.array(z.string().min(1).max(600)).min(1).max(20),
});
export type Plate = z.infer<typeof plateSchema>;
export type Nutrients = z.infer<typeof nutrientsSchema>;
export function plateTotals(components: Plate["components"]): Nutrients {
  const sum = (key: keyof Nutrients) => Math.round(components.reduce((n, c) => n + (c.per100g[key] ?? 0) * c.grams / 100, 0) * 10) / 10;
  return { calories: sum("calories"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat"), fiber: components.some(c => c.per100g.fiber === null) ? null : sum("fiber") };
}
export function diaryNeedsConfirmation(actions: { kind: string; table?: string }[]) {
  return actions.some(a => a.kind === "log_food" || (a.kind === "record_create" && a.table === "food_logs"));
}

export const diaryValuesSchema = z.object({
  description: z.string().trim().min(1).max(500), slot: z.enum(["breakfast", "lunch", "dinner", "snack_am", "snack_pm"]),
  calories: z.number().finite().min(0).max(20000), protein: z.number().finite().min(0).max(2000),
  carbs: z.number().finite().min(0).max(3000), fat: z.number().finite().min(0).max(2000),
});
export const diaryRequestSchema = z.object({ id: z.string().uuid(), confirmed: z.literal(true), values: diaryValuesSchema });
export type DiaryRow = z.infer<typeof diaryValuesSchema> & { id: string; profile_id: string; household_id: string; log_date: string; source: string };
export type DiaryStore = { find: (id: string) => Promise<{ id: string; profile_id: string } | null>; insertOnce: (row: DiaryRow) => Promise<boolean> };
/** The adapter's insert uses the existing primary key to serialize concurrent retries. */
export async function persistConfirmedDiary(store: DiaryStore, input: unknown, owner: { userId: string; householdId: string }, date: string) {
  const request = diaryRequestSchema.parse(input);
  const previous = await store.find(request.id);
  if (previous) {
    if (previous.profile_id !== owner.userId) throw new Error("This diary entry isn't yours.");
    return { id: previous.id, alreadySaved: true };
  }
  const inserted = await store.insertOnce({ ...request.values, id: request.id, profile_id: owner.userId, household_id: owner.householdId, log_date: date, source: "plate_scan" });
  if (!inserted) {
    const actual = await store.find(request.id);
    if (!actual || actual.profile_id !== owner.userId) throw new Error("The diary entry could not be confirmed.");
  }
  return { id: request.id, alreadySaved: !inserted };
}