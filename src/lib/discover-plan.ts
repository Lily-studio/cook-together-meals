/**
 * Pure planning rules for putting Discover recipes into the plan.
 *
 * No database access here — the server executor feeds in rows and applies
 * whatever this returns, and the tests exercise it directly.
 */

import type { Profile, Recipe } from "./db";
import { candidatesFor, portionsFor, restrictionsFor } from "./planner";
import { SLOTS, SLOT_SHARE } from "./nutrition";
import { methodOf, methodScore } from "./cooking-method";

export type PlanRow = {
  plan_date: string;
  slot: string;
  recipe_id: string | null;
  cooked?: boolean;
};

export type PlannedChange = {
  plan_date: string;
  slot: string;
  recipe: Recipe;
  portions: Record<string, number>;
  previous: PlanRow | null;
};

const norm = (s: string) => s.trim().toLowerCase();

/** Look a Discover recipe up by slug or (fuzzy) title. */
export function findCatalogRecipe(recipes: Recipe[], ref: string): Recipe | null {
  const n = norm(ref);
  if (!n) return null;
  return (
    recipes.find((r) => r.slug === n || norm(r.title) === n) ??
    recipes.find((r) => norm(r.title).includes(n) || n.includes(norm(r.title))) ??
    null
  );
}

/** Why this recipe can't go in this slot for this household, or null when it fits. */
export function unsuitableReason(recipe: Recipe, slot: string, people: Profile[]): string | null {
  if (!SLOTS.includes(slot as never)) return `"${slot}" isn't a meal slot`;
  const rules = restrictionsFor(people);
  const allowed = candidatesFor([recipe], slot, rules);
  if (!allowed.length) {
    return `${recipe.title} clashes with an allergy, an avoid or a house rule`;
  }
  // candidatesFor falls back to any allowed recipe; make sure it really suits the slot.
  const strict = candidatesFor([recipe, ...placeholderPeers(slot)], slot, rules);
  if (!strict.some((r) => r.id === recipe.id)) {
    return `${recipe.title} doesn't suit ${slot.replace("_", " ")} under the house rules`;
  }
  const share = SLOT_SHARE[slot] ?? 0.3;
  for (const p of people) {
    if (recipe.calories <= 0) continue;
    const need = (p.calorie_target * share) / recipe.calories;
    if (need < 0.3 || need > 2.6) {
      return `${recipe.title} can't be portioned to fit ${p.display_name}'s ${p.calorie_target} kcal day`;
    }
  }
  return null;
}

/**
 * A neutral dummy peer so candidatesFor's "use fallback when the pool is
 * empty" rule can't sneak an off-slot recipe through.
 */
function placeholderPeers(slot: string): Recipe[] {
  const mealType = slot === "snack_am" || slot === "snack_pm" ? "snack" : slot;
  return [
    {
      id: "__peer__",
      slug: "__peer__",
      title: "__peer__",
      tagline: "",
      cuisine: "",
      meal_types: [mealType],
      emoji: "",
      base_servings: 2,
      prep_minutes: 0,
      cook_minutes: 0,
      difficulty: "easy",
      ingredients: [{ name: "chicken", amount: "100 g" }] as Recipe["ingredients"],
      steps: [],
      calories: 500,
      protein: 30,
      carbs: 0,
      fat: 0,
      fiber: 0,
      tags: slot === "snack_am" ? ["coffee", "complete-meal", "main"] : ["complete-meal", "main"],
      prep_friendly: false,
      lily_note: "",
    },
  ];
}

/** One specific recipe into one slot. Returns an error string or the change. */
export function planSpecific(args: {
  recipe: Recipe;
  date: string;
  slot: string;
  people: Profile[];
  existing: PlanRow[];
}): { change: PlannedChange } | { error: string } {
  const { recipe, date, slot, people, existing } = args;
  const reason = unsuitableReason(recipe, slot, people);
  if (reason) return { error: reason };
  const current = existing.find((e) => e.plan_date === date && e.slot === slot) ?? null;
  if (current?.recipe_id === recipe.id) return { error: `${recipe.title} is already there` };
  if (existing.some((e) => e.plan_date === date && e.slot !== slot && e.recipe_id === recipe.id)) {
    return { error: `${recipe.title} is already on ${date} — I won't double it up` };
  }
  if (current?.cooked) return { error: `that ${slot} on ${date} is already cooked` };
  return {
    change: { plan_date: date, slot, recipe, portions: portionsFor(people, slot, recipe), previous: current },
  };
}

function datesBetween(from: string, to: string) {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end && out.length < 62) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Rotate every suitable Discover recipe through future slots: each one is
 * used once before any repeats, never twice in three days, never on top of
 * a cooked meal, and slots outside the chosen ones are left untouched.
 */
export function planRotation(args: {
  recipes: Recipe[];
  people: Profile[];
  existing: PlanRow[];
  from: string;
  to: string;
  slots: string[];
  onlyEmpty?: boolean;
  tag?: string | null;
}): PlannedChange[] {
  const { recipes, people, existing, from, to, onlyEmpty } = args;
  const slots = args.slots.filter((s) => SLOTS.includes(s as never));
  const method = methodOf(people[0]);
  const changes: PlannedChange[] = [];
  const lastUsed = new Map<string, string>();
  existing.forEach((e) => e.recipe_id && lastUsed.set(e.recipe_id, e.plan_date));

  for (const slot of slots) {
    let pool = recipes.filter((r) => !unsuitableReason(r, slot, people));
    if (args.tag) {
      const t = norm(args.tag);
      const tagged = pool.filter((r) => r.tags.some((x) => norm(x) === t) || norm(r.cuisine) === t);
      pool = tagged;
    }
    if (!pool.length) continue;
    // Better equipment fit first, then protein density; stable by slug.
    pool.sort(
      (a, b) =>
        methodScore(a, method) - methodScore(b, method) ||
        b.protein / Math.max(1, b.calories) - a.protein / Math.max(1, a.calories) ||
        a.slug.localeCompare(b.slug),
    );
    const usedThisRun = new Set<string>();
    let cursor = 0;
    for (const date of datesBetween(from, to)) {
      const current = existing.find((e) => e.plan_date === date && e.slot === slot) ?? null;
      if (current?.cooked) continue;
      if (onlyEmpty && current?.recipe_id) continue;
      const dayIds = new Set(
        [...existing.filter((e) => e.plan_date === date), ...changes.filter((c) => c.plan_date === date)]
          .map((e) => ("recipe" in e ? e.recipe.id : e.recipe_id))
          .filter(Boolean) as string[],
      );
      let picked: Recipe | null = null;
      for (let k = 0; k < pool.length; k++) {
        const r = pool[(cursor + k) % pool.length]!;
        if (dayIds.has(r.id)) continue;
        if (usedThisRun.has(r.id) && usedThisRun.size < pool.length) continue;
        const last = lastUsed.get(r.id);
        if (last && last !== date && Math.abs(Date.parse(last) - Date.parse(date)) < 3 * 86_400_000) continue;
        picked = r;
        cursor = (cursor + k + 1) % pool.length;
        break;
      }
      if (!picked) continue;
      if (usedThisRun.size >= pool.length) usedThisRun.clear();
      usedThisRun.add(picked.id);
      lastUsed.set(picked.id, date);
      if (current?.recipe_id === picked.id) continue;
      changes.push({
        plan_date: date,
        slot,
        recipe: picked,
        portions: portionsFor(people, slot, picked),
        previous: current,
      });
    }
  }
  return changes;
}

/* ---------- generic household records ---------- */

export const RECORD_TABLES = {
  pantry_items: ["name", "category", "quantity", "unit", "low_threshold", "staple", "opened_on", "expires_on"],
  grocery_items: ["name", "amount", "category", "checked", "manual", "week_start"],
  household_events: ["event_date", "slot", "kind", "guests", "note"],
  household_notes: ["from_name", "message", "handled"],
  prep_batches: ["title", "portions_total", "portions_left", "prepared_on", "best_before", "note", "recipe_id"],
  favorites: ["recipe_id"],
  food_logs: ["log_date", "slot", "description", "calories", "protein", "carbs", "fat"],
  meal_feedback: ["recipe_id", "plan_date", "slot", "rating", "note"],
  meal_plan_entries: ["plan_date", "slot", "recipe_id", "custom_title", "cooked"],
  ingredient_prices: ["name", "unit", "pack_size", "price", "currency"],
} as const;

export type RecordTable = keyof typeof RECORD_TABLES;

/** Keep only columns Lily may touch; strips ids, household ids and anything unknown. */
export function cleanValues(table: RecordTable, values: Record<string, unknown>) {
  const allowed = RECORD_TABLES[table] as readonly string[];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values ?? {})) {
    if (!allowed.includes(k)) continue;
    if (v !== null && typeof v === "object") continue;
    if (typeof v === "string" && v.length > 500) continue;
    out[k] = v;
  }
  return out;
}

/** Which Lily action kinds need a "yes, do it" first. */
export function needsConfirmation(action: { kind: string; to?: string; from?: string; slots?: string[] }) {
  if (action.kind === "record_delete" || action.kind === "rotate_discover") return true;
  return false;
}
