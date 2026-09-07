/**
 * Lily's month planner.
 *
 * The user never builds a plan by hand: this file takes the household's
 * profiles, the recipe library and a start date, and returns 28 days ×
 * 5 eating moments with exact per-person portions.
 */

import type { Profile, Recipe } from "./db";
import { SLOTS, isoDate } from "./nutrition";
import { candidatesFor, portionsFor, restrictionsFor } from "./planner";

/** Words we never plan with: the household dislikes oats and owns no blender. */
const BANNED_INGREDIENT_WORDS = ["oat", "oats", "oatmeal", "porridge oats", "granola"];
const BANNED_EQUIPMENT_WORDS = ["blender", "blend ", "food processor", "processor", "electric mixer", "mixer"];

export function isPlannable(recipe: Recipe) {
  const ingredients = [recipe.title, ...recipe.ingredients.map((i) => i.name)].join(" ").toLowerCase();
  if (BANNED_INGREDIENT_WORDS.some((w) => ingredients.includes(w))) return false;
  const steps = recipe.steps.join(" ").toLowerCase();
  if (BANNED_EQUIPMENT_WORDS.some((w) => steps.includes(w))) return false;
  return true;
}

export type GeneratedEntry = {
  plan_date: string;
  slot: string;
  recipe_id: string;
  portions: Record<string, number>;
};

/** 28 days starting at `start` (a Monday). */
export function monthDates(start: Date) {
  return Array.from({ length: 28 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

/** Deterministic little shuffle so each generation feels different but repeatable. */
function rotate<T>(list: T[], by: number) {
  if (!list.length) return list;
  const n = ((by % list.length) + list.length) % list.length;
  return [...list.slice(n), ...list.slice(0, n)];
}

export function generateMonth({
  start,
  recipes,
  people,
  favouriteRecipeIds = [],
  seed = 0,
}: {
  start: Date;
  recipes: Recipe[];
  people: Profile[];
  favouriteRecipeIds?: string[];
  seed?: number;
}): GeneratedEntry[] {
  const usable = recipes.filter(isPlannable);
  if (!usable.length || !people.length) return [];

  const restrictions = restrictionsFor(people);
  const dates = monthDates(start);
  const entries: GeneratedEntry[] = [];

  // Pool per slot, with favourites nudged to the front and protein-rich
  // dishes preferred for the main meals.
  const pools: Record<string, Recipe[]> = {};
  SLOTS.forEach((slot, slotIndex) => {
    const base = candidatesFor(usable, slot, restrictions).filter(isPlannable);
    const scored = [...base].sort((a, b) => {
      const fav = Number(favouriteRecipeIds.includes(b.id)) - Number(favouriteRecipeIds.includes(a.id));
      if (fav) return fav;
      if (slot === "lunch" || slot === "dinner") return b.protein - a.protein;
      return 0;
    });
    pools[slot] = rotate(scored, seed * 3 + slotIndex);
  });

  const lastUsedOn = new Map<string, number>();

  dates.forEach((date, dayIndex) => {
    const usedToday = new Set<string>();
    SLOTS.forEach((slot, slotIndex) => {
      const pool = pools[slot] ?? [];
      if (!pool.length) return;
      const gapWanted = pool.length > 5 ? 5 : pool.length > 3 ? 3 : 1;
      const offset = dayIndex * 2 + slotIndex * 3 + seed;

      let pick: Recipe | undefined;
      for (let attempt = 0; attempt < pool.length; attempt++) {
        const candidate = pool[(offset + attempt) % pool.length]!;
        if (usedToday.has(candidate.id)) continue;
        const last = lastUsedOn.get(candidate.id);
        if (last !== undefined && dayIndex - last < gapWanted) continue;
        pick = candidate;
        break;
      }
      if (!pick) pick = pool[offset % pool.length]!;

      usedToday.add(pick.id);
      lastUsedOn.set(pick.id, dayIndex);
      entries.push({
        plan_date: isoDate(date),
        slot,
        recipe_id: pick.id,
        portions: portionsFor(people, slot, pick),
      });
    });
  });

  return entries;
}
