/**
 * Cook once, then split the finished dish.
 *
 * Instead of telling each person how many grams of chicken and how many grams
 * of potatoes to cook, we work out roughly what the *finished* dish weighs and
 * then say: you eat this many grams of it, he eats that many.
 */

import type { Recipe } from "./db";
import { parseAmount } from "./portions";
import { scaleMacros } from "./nutrition";

/** A piece of something (an egg, a msemen, a tomato) if we only have a count. */
const PIECE_GRAMS = 60;

/** Water and oil mostly stay in the pot; a little steams away while cooking. */
const COOKING_LOSS = 0.9;

export type Swaps = Record<string, { name: string; amount: string }>;

/** Roughly what the whole recipe weighs once it's cooked, in grams. */
export function finishedWeight(recipe: Recipe, swaps: Swaps = {}): number {
  let total = 0;
  for (const ing of recipe.ingredients) {
    const amount = swaps[ing.name]?.amount ?? ing.amount;
    const parsed = parseAmount(amount);
    if (!parsed) continue;
    total += parsed.unit === "pc" ? parsed.value * PIECE_GRAMS : parsed.value;
  }
  return Math.max(0, Math.round((total * COOKING_LOSS) / 10) * 10);
}

/** Nicely rounded grams. */
export function roundGrams(value: number) {
  if (value <= 0) return 0;
  return value >= 100 ? Math.round(value / 10) * 10 : Math.round(value / 5) * 5;
}

/** Grams of the finished dish for one person, from their portion multiplier. */
export function portionGrams(recipe: Recipe, multiplier: number, swaps: Swaps = {}) {
  const perServing = finishedWeight(recipe, swaps) / Math.max(1, recipe.base_servings);
  return roundGrams(perServing * Math.max(0, multiplier));
}

export type DishSplit = {
  total: number;
  /** How much of the recipe to make: 1 = as written, 1.5 = half again. */
  batches: number;
  shares: { id: string; name: string; grams: number; calories: number; protein: number }[];
  leftover: number;
};

/** Everything a card or recipe page needs to show the split. */
export function splitDish(
  recipe: Recipe,
  people: { id: string; display_name: string }[],
  portions: Record<string, number>,
  swaps: Swaps = {},
): DishSplit {
  const wanted = people.reduce((a, p) => a + Math.max(0, portions[p.id] ?? 1), 0);
  const batches = Math.max(1, Math.round((wanted / Math.max(1, recipe.base_servings)) * 4) / 4);
  const total = roundGrams(finishedWeight(recipe, swaps) * batches);
  const shares = people.map((p) => {
    const mult = portions[p.id] ?? 1;
    const macros = scaleMacros(recipe, mult);
    return {
      id: p.id,
      name: p.display_name,
      grams: portionGrams(recipe, mult, swaps),
      calories: macros.calories,
      protein: macros.protein,
    };
  });
  const eaten = shares.reduce((a, s) => a + s.grams, 0);
  return { total, batches, shares, leftover: Math.max(0, roundGrams(total - eaten)) };
}

/** How many extra servings the leftovers are worth. */
export function leftoverPortions(split: DishSplit, recipe: Recipe) {
  const perServing = split.total / Math.max(1, recipe.base_servings);
  if (perServing <= 0) return 0;
  return Math.round((split.leftover / perServing) * 2) / 2;
}

export function formatGrams(grams: number) {
  if (grams >= 1000) return `${(Math.round(grams / 100) / 10).toFixed(1)} kg`;
  return `${grams} g`;
}
