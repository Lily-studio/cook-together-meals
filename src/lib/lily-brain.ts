/**
 * Lily's little brain.
 *
 * The rules and reasons behind her choices live here so that the plan, the
 * recipes, the shopping list and the pantry all obey the same thinking.
 */

import type { Profile, Recipe } from "./db";
import { sameIngredient, type PantryItem } from "./pantry";
import { gramsIn, suggestSwaps } from "./portions";

/* ------------------------------------------------------------------ *
 * The permanent lunch rule
 * ------------------------------------------------------------------ */

/** Lunch is always chicken, minced meat or turkey — unless the household says otherwise. */
export const LUNCH_PROTEIN_WORDS = [
  "chicken",
  "poulet",
  "minced",
  "mince",
  "kefta",
  "turkey",
  "dinde",
];

export function hasLunchProtein(recipe: Recipe) {
  const hay = [recipe.title, ...recipe.ingredients.map((i) => i.name)].join(" ").toLowerCase();
  return LUNCH_PROTEIN_WORDS.some((w) => hay.includes(w));
}

/** True when someone in the household has switched the lunch rule off. */
export function lunchRuleRelaxed(people: Profile[]) {
  return people.some(
    (p) =>
      (p.ingredient_rules ?? {})["lunch_protein"] === "off" ||
      (p.diet_prefs ?? []).includes("vegetarian") ||
      (p.diet_prefs ?? []).includes("vegan"),
  );
}

/* ------------------------------------------------------------------ *
 * Why Lily chose this
 * ------------------------------------------------------------------ */

export function whyThisMeal({
  recipe,
  slot,
  pantry = [],
  favouriteRecipeIds = [],
}: {
  recipe: Recipe;
  slot: string;
  pantry?: PantryItem[];
  favouriteRecipeIds?: string[];
}): string {
  const reasons: string[] = [];
  if (favouriteRecipeIds.includes(recipe.id)) reasons.push("it's one of your favourites");
  if (slot === "lunch" && hasLunchProtein(recipe))
    reasons.push("lunch is always chicken, mince or turkey for you");
  const athome = pantry.filter((p) => recipe.ingredients.some((i) => sameIngredient(p.name, i.name)));
  if (athome.length >= 2) reasons.push(`you already have ${athome.length} of the ingredients`);
  if (recipe.protein >= 35) reasons.push(`${recipe.protein}g protein a serving`);
  if (recipe.prep_minutes + recipe.cook_minutes <= 25) reasons.push("it's on the table in under 25 minutes");
  if (recipe.tags.includes("budget")) reasons.push("it's one of the cheap ones");
  if (recipe.prep_friendly) reasons.push("it keeps well, so leftovers become another meal");
  if (!reasons.length) reasons.push("it fits your day and keeps the week varied");
  return reasons.slice(0, 2).join(", and ");
}

/* ------------------------------------------------------------------ *
 * Make it cheaper
 * ------------------------------------------------------------------ */

/** Very rough price per 100 g / per piece, only used to rank swaps. */
const PRICE_PER_100: { word: string; price: number }[] = [
  { word: "lamb", price: 14 },
  { word: "beef", price: 11 },
  { word: "mince", price: 9 },
  { word: "chicken breast", price: 8 },
  { word: "turkey", price: 8 },
  { word: "chicken", price: 6 },
  { word: "prawn", price: 15 },
  { word: "fish", price: 8 },
  { word: "sardine", price: 4 },
  { word: "tuna", price: 7 },
  { word: "almond", price: 12 },
  { word: "walnut", price: 13 },
  { word: "butter", price: 8 },
  { word: "olive oil", price: 5 },
  { word: "cheese", price: 9 },
  { word: "yoghurt", price: 2 },
  { word: "egg", price: 2 },
  { word: "chickpea", price: 1.4 },
  { word: "lentil", price: 1.2 },
  { word: "bean", price: 1.2 },
  { word: "rice", price: 1.2 },
  { word: "pasta", price: 1.2 },
  { word: "couscous", price: 1.3 },
  { word: "bulgur", price: 1.4 },
  { word: "potato", price: 0.6 },
  { word: "carrot", price: 0.5 },
  { word: "courgette", price: 0.6 },
  { word: "tomato", price: 0.8 },
  { word: "onion", price: 0.4 },
];

export function priceOf(name: string) {
  const needle = name.trim().toLowerCase();
  const hit = PRICE_PER_100.find((p) => needle.includes(p.word));
  return hit?.price ?? 2;
}

export type CheaperIdea = { from: string; to: { name: string; amount: string }; note: string };

/**
 * The single change that saves the most money on a dish while keeping the
 * calories close. Returns null when the dish is already cheap.
 */
export function cheaperIdea(
  recipe: Recipe,
  swaps: Record<string, { name: string; amount: string }> = {},
): CheaperIdea | null {
  const ranked = recipe.ingredients
    .filter((ing) => !swaps[ing.name])
    .map((ing) => {
      const grams = gramsIn(ing.amount) ?? 100;
      return { ing, cost: (priceOf(ing.name) * grams) / 100 };
    })
    .sort((a, b) => b.cost - a.cost);

  for (const candidate of ranked) {
    const options = suggestSwaps(candidate.ing.name, candidate.ing.amount, 6)
      .map((s) => ({ s, price: priceOf(s.name) }))
      .filter((o) => o.price < priceOf(candidate.ing.name) * 0.85)
      .sort((a, b) => a.price - b.price);
    const best = options[0];
    if (best)
      return {
        from: candidate.ing.name,
        to: { name: best.s.name, amount: best.s.amount },
        note: `${best.s.name} instead of ${candidate.ing.name.toLowerCase()} — ${best.s.note}`,
      };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * What's in my fridge?
 * ------------------------------------------------------------------ */

export type FridgeMatch = { recipe: Recipe; have: number; total: number; missing: string[] };

/** Recipes you could almost make right now, best match first. */
export function cookFromFridge(recipes: Recipe[], pantry: PantryItem[], max = 6): FridgeMatch[] {
  if (!pantry.length) return [];
  const stocked = pantry.filter((p) => p.quantity > 0);
  return recipes
    .map((recipe) => {
      const missing = recipe.ingredients
        .filter((i) => !stocked.some((p) => sameIngredient(p.name, i.name)))
        .map((i) => i.name);
      return {
        recipe,
        have: recipe.ingredients.length - missing.length,
        total: recipe.ingredients.length,
        missing,
      };
    })
    .filter((m) => m.have >= 2 && m.missing.length <= 3)
    .sort((a, b) => b.have / b.total - a.have / a.total || a.missing.length - b.missing.length)
    .slice(0, max);
}

/* ------------------------------------------------------------------ *
 * Cravings and treats
 * ------------------------------------------------------------------ */

const CRAVING_WORDS: Record<string, string[]> = {
  sweet: ["date", "honey", "banana", "fruit", "orange", "cinnamon", "raisin", "yoghurt"],
  salty: ["olive", "cheese", "sardine", "tuna", "harissa", "khobz"],
  chocolate: ["chocolate", "cocoa", "date", "peanut"],
  bread: ["khobz", "msemen", "batbout", "baguette", "pitta", "harcha"],
  creamy: ["yoghurt", "labneh", "fromage", "milk", "avocado"],
  crunchy: ["almond", "walnut", "carrot", "cucumber", "nut"],
  warm: ["soup", "harira", "bessara", "tea", "tagine"],
  fried: ["msemen", "omelette", "kefta", "batbout"],
};

export type Treat = { recipe: Recipe; fits: boolean };

/**
 * Something that scratches the itch. `kcalLeft` is what's left of the day —
 * anything over it is still offered, just marked as a proper treat.
 */
export function treatsFor(recipes: Recipe[], craving: string, kcalLeft: number, max = 4): Treat[] {
  const words = craving.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
  const expanded = new Set<string>(words);
  Object.entries(CRAVING_WORDS).forEach(([key, list]) => {
    if (words.some((w) => key.includes(w) || w.includes(key))) list.forEach((l) => expanded.add(l));
  });
  const needles = [...expanded];
  if (!needles.length) return [];

  return recipes
    .map((recipe) => {
      const hay = [recipe.title, recipe.tagline, ...recipe.tags, ...recipe.ingredients.map((i) => i.name)]
        .join(" ")
        .toLowerCase();
      const score = needles.filter((n) => hay.includes(n)).length;
      const snack = recipe.meal_types.includes("snack");
      return { recipe, score: score + (snack ? 0.5 : 0) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.recipe.calories - b.recipe.calories)
    .slice(0, max)
    .map(({ recipe }) => ({ recipe, fits: recipe.calories <= Math.max(0, kcalLeft) }));
}

/** A kind line for a day that went sideways. */
export function reassure(over: number) {
  if (over <= 0) return "Nothing to fix — you're right where you should be 🌼";
  if (over < 300) return "That's a rounding error, honestly. Same plan tomorrow, no changes needed.";
  if (over < 700) return "One bigger day changes nothing. I'll keep tomorrow light and protein-rich for you.";
  return "It happens in every kitchen, mine included. Tomorrow starts fresh — nothing to make up for.";
}
