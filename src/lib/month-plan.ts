/**
 * Lily's month planner.
 *
 * The user never builds a plan by hand: this file takes the household's
 * profiles, the recipe library and a start date, and returns 28 days ×
 * 5 eating moments with exact per-person portions.
 */

import type { Profile, Recipe } from "./db";
import { methodOf, methodScore } from "./cooking-method";
import { lunchRuleRelaxed } from "./lily-brain";
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
  avoidRecipeIds = [],
  lovedRecipeIds = [],
  skip = [],
  quick = [],
  guests = {},
}: {
  start: Date;
  recipes: Recipe[];
  people: Profile[];
  favouriteRecipeIds?: string[];
  seed?: number;
  /** Rated "never again" — never planned. */
  avoidRecipeIds?: string[];
  /** Rated "loved it" — planned more often. */
  lovedRecipeIds?: string[];
  /** "2026-09-25|dinner" keys nobody's eating at home for. */
  skip?: string[];
  /** Keys that must be as fast as possible (home late). */
  quick?: string[];
  /** Extra plates per "date|slot" key, from guests. */
  guests?: Record<string, number>;
}): GeneratedEntry[] {
  const usable = recipes.filter(isPlannable).filter((r) => !avoidRecipeIds.includes(r.id));
  if (!usable.length || !people.length) return [];

  const restrictions = restrictionsFor(people);
  const relaxLunchRule = lunchRuleRelaxed(people);
  const dates = monthDates(start);
  const entries: GeneratedEntry[] = [];
  const skipKeys = new Set(skip);
  const quickKeys = new Set(quick);

  // Pool per slot, with favourites nudged to the front and protein-rich
  // dishes preferred for the main meals.
  const pools: Record<string, Recipe[]> = {};
  const method = methodOf(people[0]);
  const prefer = people
    .flatMap((p) => p.prefer_more ?? [])
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 2);
  const preferred = (r: Recipe) => {
    if (!prefer.length) return false;
    const hay = [r.title, ...r.ingredients.map((i) => i.name)].join(" ").toLowerCase();
    return prefer.some((w) => hay.includes(w));
  };
  const wanted = (r: Recipe) => favouriteRecipeIds.includes(r.id) || lovedRecipeIds.includes(r.id);

  SLOTS.forEach((slot, slotIndex) => {
    const base = candidatesFor(usable, slot, restrictions, { relaxLunchRule }).filter(isPlannable);
    const scored = [...base].sort((a, b) => {
      const fav = Number(wanted(b)) - Number(wanted(a));
      if (fav) return fav;
      const liked = Number(preferred(b)) - Number(preferred(a));
      if (liked) return liked;
      const machine = methodScore(a, method) - methodScore(b, method);
      if (machine) return machine;
      if (slot === "lunch" || slot === "dinner") return b.protein - a.protein;
      return 0;
    });
    pools[slot] = rotate(scored, seed * 3 + slotIndex);
  });

  const lastUsedOn = new Map<string, number>();
  // Variety memory: keep cuisines and starches from repeating day after day.
  const lastStyleOn = new Map<string, number>();

  const styleOf = (recipe: Recipe) => {
    const hay = [recipe.title, ...recipe.ingredients.map((i) => i.name)].join(" ").toLowerCase();
    const starch = ["rice", "pasta", "noodle", "couscous", "bulgur", "potato", "wrap", "tortilla", "pitta", "bun", "bread"].find(
      (w) => hay.includes(w),
    );
    return `${recipe.cuisine.toLowerCase()}|${starch ?? "none"}`;
  };

  const isFast = (recipe: Recipe) => recipe.prep_minutes + recipe.cook_minutes <= 25;

  dates.forEach((date, dayIndex) => {
    const usedToday = new Set<string>();
    const iso = isoDate(date);
    SLOTS.forEach((slot, slotIndex) => {
      const key = `${iso}|${slot}`;
      // Real life: nobody's eating at home for this one, so Lily leaves it free.
      if (skipKeys.has(key)) return;
      const wantFast = quickKeys.has(key);
      const full = pools[slot] ?? [];
      const pool = wantFast && full.some(isFast) ? full.filter(isFast) : full;
      if (!pool.length) return;
      const gapWanted = pool.length > 5 ? 5 : pool.length > 3 ? 3 : 1;
      const offset = dayIndex * 2 + slotIndex * 3 + seed;
      const variedSlot = slot === "lunch" || slot === "dinner" || slot === "breakfast";

      let pick: Recipe | undefined;
      // First pass: fresh recipe AND a different cuisine/starch from the last days.
      for (let pass = 0; pass < 2 && !pick; pass++) {
        for (let attempt = 0; attempt < pool.length; attempt++) {
          const candidate = pool[(offset + attempt) % pool.length]!;
          if (usedToday.has(candidate.id)) continue;
          const last = lastUsedOn.get(candidate.id);
          if (last !== undefined && dayIndex - last < gapWanted) continue;
          if (pass === 0 && variedSlot) {
            const styleLast = lastStyleOn.get(styleOf(candidate));
            if (styleLast !== undefined && dayIndex - styleLast < 3) continue;
          }
          pick = candidate;
          break;
        }
      }
      if (!pick) pick = pool[offset % pool.length]!;

      usedToday.add(pick.id);
      lastUsedOn.set(pick.id, dayIndex);
      lastStyleOn.set(styleOf(pick), dayIndex);

      const extraPlates = guests[key] ?? guests[`${iso}|all`] ?? 0;
      const portions = portionsFor(people, slot, pick);
      if (extraPlates > 0) portions["guests"] = extraPlates;

      entries.push({ plan_date: iso, slot, recipe_id: pick.id, portions });
    });
  });

  return entries;
}
