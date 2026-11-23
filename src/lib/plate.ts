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