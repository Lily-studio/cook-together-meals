/**
 * Replacing exactly ONE meal.
 *
 * Nothing else in the day or the month moves: Lily finds another complete,
 * allowed dish for that single slot and keeps the calories, price, time or
 * effort where the cook asked for them.
 */

import type { PantryItem } from "./pantry";
import type { Profile, Recipe } from "./db";
import { isPlannable } from "./month-plan";
import { candidatesFor, restrictionsFor } from "./planner";
import { lunchRuleRelaxed } from "./lily-brain";
import { methodOf, methodScore } from "./cooking-method";
import { priceOf } from "./lily-brain";
import { sameIngredient } from "./pantry";
import { easeScore, totalMinutes } from "./quick";

export type ReplaceMode = "same_calories" | "cheaper" | "faster" | "easier" | "pantry" | "different";

export const REPLACE_MODES: { value: ReplaceMode; emoji: string; label: string }[] = [
  { value: "same_calories", emoji: "⚖️", label: "Same calories" },
  { value: "cheaper", emoji: "🐖", label: "Cheaper" },
  { value: "faster", emoji: "⏱️", label: "Faster" },
  { value: "easier", emoji: "😮‍💨", label: "Easier" },
  { value: "pantry", emoji: "🧊", label: "Use what I have" },
  { value: "different", emoji: "✨", label: "Something completely different" },
];

function roughPrice(recipe: Recipe) {
  return recipe.ingredients.reduce((sum, ing) => sum + priceOf(ing.name), 0);
}

function pantryHits(recipe: Recipe, pantry: PantryItem[]) {
  if (!pantry.length) return 0;
  return recipe.ingredients.filter((ing) =>
    pantry.some((p) => p.quantity > 0 && sameIngredient(p.name, ing.name)),
  ).length;
}

/**
 * Best replacement for one slot, or null when the library has nothing else
 * that respects the household's rules.
 */
export function pickReplacement({
  recipes,
  people,
  slot,
  current,
  mode = "different",
  pantry = [],
  avoidIds = [],
  seed = 0,
}: {
  recipes: Recipe[];
  people: Profile[];
  slot: string;
  current?: Recipe | null;
  mode?: ReplaceMode;
  pantry?: PantryItem[];
  avoidIds?: string[];
  seed?: number;
}): Recipe | null {
  if (!recipes.length || !people.length) return null;
  const restrictions = restrictionsFor(people);
  const method = methodOf(people[0]);
  const skip = new Set([...(current ? [current.id] : []), ...avoidIds]);

  const pool = candidatesFor(recipes.filter(isPlannable), slot, restrictions, {
    relaxLunchRule: lunchRuleRelaxed(people),
  }).filter((r) => !skip.has(r.id));
  if (!pool.length) return null;

  const targetCalories = current?.calories ?? 0;
  const prefer = people
    .flatMap((p) => p.prefer_more ?? [])
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);

  const preferBoost = (r: Recipe) => {
    if (!prefer.length) return 0;
    const hay = [r.title, ...r.ingredients.map((i) => i.name)].join(" ").toLowerCase();
    return prefer.some((w) => w.length > 2 && hay.includes(w)) ? -3 : 0;
  };

  const score = (r: Recipe) => {
    const base = preferBoost(r) + methodScore(r, method);
    switch (mode) {
      case "same_calories":
        return base + (targetCalories ? Math.abs(r.calories - targetCalories) / 25 : 0);
      case "cheaper":
        return base + roughPrice(r) / 4;
      case "faster":
        return base + totalMinutes(r) / 4;
      case "easier":
        return base + easeScore(r) / 8;
      case "pantry":
        return base - pantryHits(r, pantry) * 3;
      default:
        // Something else entirely: a different cuisine, in a stable but shuffled order.
        return base + ((r.id.charCodeAt(0) + seed) % 7) + (current && r.cuisine === current.cuisine ? 4 : 0);
    }
  };

  return [...pool].sort((a, b) => score(a) - score(b))[0] ?? null;
}

export function replacementNote(mode: ReplaceMode, current: Recipe | null, next: Recipe) {
  const minutes = totalMinutes(next);
  switch (mode) {
    case "same_calories":
      return `${next.calories} kcal a serving${current ? ` — near enough to the ${current.calories} you had` : ""}.`;
    case "cheaper":
      return "Cheaper shopping for the same kind of meal.";
    case "faster":
      return `On the table in ${minutes} min.`;
    case "easier":
      return `${next.ingredients.length} things, ${next.steps.length} steps — an easy one.`;
    case "pantry":
      return "Mostly things you already have in.";
    default:
      return next.tagline || "Something completely different.";
  }
}
