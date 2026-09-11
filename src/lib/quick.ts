/**
 * Lily's quick thinking.
 *
 * Small, honest helpers that read the real plan, the real stock and the real
 * logs, and answer the questions someone actually has while standing in their
 * kitchen: I've only got 20 minutes, I'm exhausted, what do I do with the
 * leftovers, what should I take out of the freezer tonight.
 */

import type { FoodLog, GroceryItem, PlanEntry, PrepBatch, Recipe } from "./db";
import { isCompleteMeal } from "./lily-brain";
import { sameIngredient, type PantryItem } from "./pantry";
import { parseAmount } from "./portions";
import { SLOTS, SLOT_MEAL_TYPE } from "./nutrition";
import { finishedWeight, formatGrams } from "./dish";

export const totalMinutes = (r: Recipe) => r.prep_minutes + r.cook_minutes;

/** The eating moment we're most likely standing in right now. */
export function slotNow(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < 10) return "breakfast";
  if (h < 11.5) return "snack_am";
  if (h < 15) return "lunch";
  if (h < 17.5) return "snack_pm";
  return "dinner";
}

export const TIME_CHOICES = [
  { minutes: 10, label: "10 minutes" },
  { minutes: 20, label: "20 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 999, label: "Plenty of time" },
] as const;

/* ------------------------------------------------------------------ *
 * "I only have 20 minutes"
 * ------------------------------------------------------------------ */

export type Suggestion = { recipe: Recipe; slot: string; why: string; fromPlan: boolean };

/**
 * First choice is always something already in today's plan that fits the time.
 * Only when nothing does, Lily offers a replacement from her book.
 */
export function mealsInTime({
  minutes,
  entries,
  recipes,
  slot,
  max = 4,
}: {
  minutes: number;
  entries: PlanEntry[];
  recipes: Recipe[];
  slot: string;
  max?: number;
}): Suggestion[] {
  const planned = entries
    .filter((e) => e.recipes && totalMinutes(e.recipes) <= minutes)
    .map((e) => ({
      recipe: e.recipes!,
      slot: e.slot,
      why: `already your ${e.slot === slot ? "plan for now" : "plan today"} — ${totalMinutes(e.recipes!)} min`,
      fromPlan: true,
    }));

  const mealType = SLOT_MEAL_TYPE[slot] ?? "dinner";
  const swapIn = recipes
    .filter((r) => r.meal_types.includes(mealType) && totalMinutes(r) <= minutes)
    .filter((r) => (slot === "lunch" || slot === "dinner" ? isCompleteMeal(r) : true))
    .filter((r) => !planned.some((p) => p.recipe.id === r.id))
    .sort((a, b) => totalMinutes(a) - totalMinutes(b) || b.protein - a.protein)
    .map((r) => ({
      recipe: r,
      slot,
      why: `on the table in ${totalMinutes(r)} min`,
      fromPlan: false,
    }));

  return [...planned, ...swapIn].slice(0, max);
}

/* ------------------------------------------------------------------ *
 * "I'm exhausted"
 * ------------------------------------------------------------------ */

/** Lower is easier: fewer things to chop, fewer pans, less time. */
export function easeScore(r: Recipe) {
  const hay = r.steps.join(" ").toLowerCase();
  const pans = (hay.match(/pan|pot|tray|oven|skillet/g) ?? []).length;
  const chopping = (hay.match(/chop|dice|slice|grate|mince/g) ?? []).length;
  return (
    totalMinutes(r) +
    r.ingredients.length * 2 +
    r.steps.length * 3 +
    pans * 4 +
    chopping * 3 -
    (r.prep_friendly ? 8 : 0) -
    (r.difficulty === "easy" ? 8 : 0)
  );
}

export function easiestMeals({
  entries,
  recipes,
  slot,
  prep = [],
  max = 4,
}: {
  entries: PlanEntry[];
  recipes: Recipe[];
  slot: string;
  prep?: PrepBatch[];
  max?: number;
}): Suggestion[] {
  const ready = prep.filter((b) => b.portions_left > 0);
  const readyIds = new Set(ready.map((b) => b.recipe_id).filter(Boolean) as string[]);

  const mealType = SLOT_MEAL_TYPE[slot] ?? "dinner";
  const pool = [
    ...entries.filter((e) => e.recipes).map((e) => ({ recipe: e.recipes!, fromPlan: true, slot: e.slot })),
    ...recipes
      .filter((r) => r.meal_types.includes(mealType))
      .filter((r) => (slot === "lunch" || slot === "dinner" ? isCompleteMeal(r) : true))
      .map((r) => ({ recipe: r, fromPlan: false, slot })),
  ];

  const seen = new Set<string>();
  return pool
    .filter((p) => (seen.has(p.recipe.id) ? false : seen.add(p.recipe.id)))
    .sort(
      (a, b) =>
        Number(readyIds.has(b.recipe.id)) - Number(readyIds.has(a.recipe.id)) ||
        easeScore(a.recipe) - easeScore(b.recipe),
    )
    .slice(0, max)
    .map((p) => ({
      recipe: p.recipe,
      slot: p.slot,
      fromPlan: p.fromPlan,
      why: readyIds.has(p.recipe.id)
        ? "already cooked and waiting in the fridge — just warm it"
        : `${totalMinutes(p.recipe)} min, ${p.recipe.ingredients.length} things, ${p.recipe.steps.length} steps`,
    }));
}

/* ------------------------------------------------------------------ *
 * Restaurant food, at home
 * ------------------------------------------------------------------ */

export const RESTAURANT_CRAVINGS: { label: string; words: string[] }[] = [
  { label: "Burger", words: ["burger", "bun", "patty", "slaw"] },
  { label: "Shawarma", words: ["shawarma", "gyros", "wrap", "pitta", "garlic sauce"] },
  { label: "Tacos", words: ["taco", "tortilla", "fajita", "salsa"] },
  { label: "Pizza", words: ["pizza", "mozzarella", "dough", "tomato sauce"] },
  { label: "Pasta", words: ["pasta", "pesto", "spaghetti", "noodle"] },
  { label: "Moroccan restaurant", words: ["tagine", "couscous", "kefta", "harira", "pastilla", "zaalouk"] },
  { label: "Café breakfast", words: ["msemen", "omelette", "harcha", "shakshuka", "avocado", "honey"] },
  { label: "Comfort food", words: ["traybake", "chilli", "stew", "meatball", "gratin", "rice"] },
];

/** A genuinely indulgent-feeling homemade version of what they're craving. */
export function restaurantIdeas(recipes: Recipe[], craving: string, max = 4) {
  const needle = craving.trim().toLowerCase();
  if (needle.length < 2) return [];
  const preset = RESTAURANT_CRAVINGS.find(
    (c) => c.label.toLowerCase().includes(needle) || needle.includes(c.label.toLowerCase()),
  );
  const words = preset ? preset.words : needle.split(/[^a-z]+/).filter((w) => w.length > 2);
  if (!words.length) return [];

  return recipes
    .map((r) => {
      const hay = [r.title, r.tagline, r.cuisine, ...r.tags, ...r.ingredients.map((i) => i.name)]
        .join(" ")
        .toLowerCase();
      const score = words.filter((w) => hay.includes(w)).length;
      return { recipe: r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.recipe.calories - a.recipe.calories)
    .slice(0, max)
    .map((x) => x.recipe);
}

/* ------------------------------------------------------------------ *
 * Take it out tonight
 * ------------------------------------------------------------------ */

export type DefrostItem = { name: string; amount: string; slot: string; meal: string };

/** Everything frozen, soaked or marinated that tomorrow's meals need in advance. */
export function defrostList(tomorrow: PlanEntry[], people: number = 2): DefrostItem[] {
  const out: DefrostItem[] = [];
  tomorrow.forEach((entry) => {
    const recipe = entry.recipes;
    if (!recipe) return;
    const wanted = Object.values(entry.portions ?? {}).reduce((a, b) => a + b, 0) || people;
    const batches = Math.max(1, Math.round((wanted / Math.max(1, recipe.base_servings)) * 4) / 4);
    recipe.ingredients.forEach((ing) => {
      const needsThawing = ing.category === "Meat" || ing.category === "Fish";
      const needsSoaking = /dried|chickpea|fava|bean|lentil/.test(ing.name.toLowerCase());
      if (!needsThawing && !needsSoaking) return;
      const parsed = parseAmount(ing.amount);
      const amount = parsed
        ? parsed.unit === "pc"
          ? `${Math.ceil(parsed.value * batches)} pieces`
          : formatGrams(Math.round((parsed.value * batches) / 10) * 10)
        : ing.amount;
      out.push({ name: ing.name, amount, slot: entry.slot, meal: recipe.title });
    });
  });
  const seen = new Set<string>();
  return out.filter((i) => (seen.has(i.name.toLowerCase()) ? false : seen.add(i.name.toLowerCase()))).slice(0, 4);
}

/* ------------------------------------------------------------------ *
 * Use what you already opened
 * ------------------------------------------------------------------ */

export type OpenedItem = {
  item: PantryItem;
  daysOpen: number | null;
  daysLeft: number | null;
  urgent: boolean;
  usedIn: { date: string; slot: string; title: string } | null;
  ideas: Recipe[];
};

function daysBetween(fromIso: string, toIso: string) {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const b = new Date(`${toIso}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Opened jars and packets that deserve to be used before anything else. */
export function openedToUse({
  pantry,
  entries,
  recipes,
  today,
}: {
  pantry: PantryItem[];
  entries: PlanEntry[];
  recipes: Recipe[];
  today: string;
}): OpenedItem[] {
  return pantry
    .filter((p) => p.quantity > 0)
    .map((item) => {
      const opened = (item as PantryItem & { opened_on?: string | null }).opened_on ?? null;
      const expires = (item as PantryItem & { expires_on?: string | null }).expires_on ?? null;
      const daysOpen = opened ? daysBetween(opened, today) : null;
      const daysLeft = expires ? daysBetween(today, expires) : null;
      const urgent = (daysLeft !== null && daysLeft <= 3) || (daysOpen !== null && daysOpen >= 3);
      const planned = entries
        .filter((e) => e.recipes?.ingredients.some((i) => sameIngredient(i.name, item.name)))
        .sort((a, b) => a.plan_date.localeCompare(b.plan_date))[0];
      const ideas = recipes
        .filter((r) => r.ingredients.some((i) => sameIngredient(i.name, item.name)))
        .sort((a, b) => totalMinutes(a) - totalMinutes(b))
        .slice(0, 3);
      return {
        item,
        daysOpen,
        daysLeft,
        urgent,
        usedIn: planned?.recipes
          ? { date: planned.plan_date, slot: planned.slot, title: planned.recipes.title }
          : null,
        ideas,
      };
    })
    .filter((x) => x.daysOpen !== null || x.daysLeft !== null)
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.daysLeft ?? 99) - (b.daysLeft ?? 99));
}

/** Words that let Lily rank a recipe as "uses what's already open". */
export function opennessBoost(recipe: Recipe, opened: PantryItem[]) {
  return opened.filter((o) => recipe.ingredients.some((i) => sameIngredient(i.name, o.name))).length;
}

/* ------------------------------------------------------------------ *
 * Leftovers, turned into something else
 * ------------------------------------------------------------------ */

const PROTEIN_WORDS = ["chicken", "turkey", "kefta", "mince", "beef", "lamb", "fish", "tuna", "sardine", "chickpea", "lentil"];

export type LeftoverIdea = {
  from: Recipe;
  cookedOn: string;
  protein: string;
  grams: number;
  ideas: Recipe[];
};

/** Yesterday's dish, tomorrow's different meal — same cooked protein, new format. */
export function leftoverIdeas({
  recent,
  recipes,
  people = 2,
  max = 2,
}: {
  recent: PlanEntry[];
  recipes: Recipe[];
  people?: number;
  max?: number;
}): LeftoverIdea[] {
  const cooked = recent.filter((e) => e.cooked && e.recipes);
  const out: LeftoverIdea[] = [];

  for (const entry of cooked) {
    const recipe = entry.recipes!;
    const wanted = Object.values(entry.portions ?? {}).reduce((a, b) => a + b, 0) || people;
    const batches = Math.max(1, Math.round((wanted / Math.max(1, recipe.base_servings)) * 4) / 4);
    const total = finishedWeight(recipe) * batches;
    const eaten = (finishedWeight(recipe) / Math.max(1, recipe.base_servings)) * wanted;
    const leftover = Math.round((total - eaten) / 10) * 10;
    if (leftover < 120) continue;

    const hay = [recipe.title, ...recipe.ingredients.map((i) => i.name)].join(" ").toLowerCase();
    const protein = PROTEIN_WORDS.find((w) => hay.includes(w));
    if (!protein) continue;

    const ideas = recipes
      .filter((r) => r.id !== recipe.id)
      .filter((r) => [r.title, ...r.ingredients.map((i) => i.name)].join(" ").toLowerCase().includes(protein))
      .filter((r) => totalMinutes(r) <= 25)
      .filter((r) => r.cuisine !== recipe.cuisine || !r.title.toLowerCase().includes(recipe.title.split(" ")[0]!.toLowerCase()))
      .sort((a, b) => totalMinutes(a) - totalMinutes(b))
      .slice(0, 3);
    if (!ideas.length) continue;

    out.push({ from: recipe, cookedOn: entry.plan_date, protein, grams: leftover, ideas });
    if (out.length >= max) break;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Lily notices repetition before you complain
 * ------------------------------------------------------------------ */

function signature(r: Recipe) {
  const hay = [r.title, ...r.ingredients.map((i) => i.name)].join(" ").toLowerCase();
  const protein = PROTEIN_WORDS.find((w) => hay.includes(w)) ?? "veg";
  const format = ["wrap", "tortilla", "pitta", "bun", "sandwich", "pasta", "noodle", "rice", "couscous", "tagine", "bowl", "salad", "soup"].find(
    (w) => hay.includes(w),
  ) ?? "plate";
  return `${protein}+${format}`;
}

export type RepetitionIssue = {
  entryId: string;
  date: string;
  slot: string;
  current: Recipe;
  times: number;
  replacement: Recipe;
  note: string;
};

/**
 * Looks across the plan and finds the meals that have quietly become "again?".
 * Returns a concrete, ready-to-apply replacement for each.
 */
export function repetitionIssues({
  entries,
  recipes,
  today,
  favouriteRecipeIds = [],
  max = 2,
}: {
  entries: PlanEntry[];
  recipes: Recipe[];
  today: string;
  favouriteRecipeIds?: string[];
  max?: number;
}): RepetitionIssue[] {
  const sorted = [...entries].filter((e) => e.recipes).sort((a, b) => a.plan_date.localeCompare(b.plan_date));
  const counts = new Map<string, number>();
  sorted.forEach((e) => {
    const key = signature(e.recipes!);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const seen = new Map<string, number>();
  const issues: RepetitionIssue[] = [];
  const usedReplacements = new Set<string>();

  for (const entry of sorted) {
    if (entry.plan_date <= today) {
      const key = signature(entry.recipes!);
      seen.set(key, (seen.get(key) ?? 0) + 1);
      continue;
    }
    const key = signature(entry.recipes!);
    const soFar = (seen.get(key) ?? 0) + 1;
    seen.set(key, soFar);
    if (soFar < 4) continue;

    const mealType = SLOT_MEAL_TYPE[entry.slot] ?? "dinner";
    const replacement = recipes
      .filter((r) => r.meal_types.includes(mealType))
      .filter((r) => (entry.slot === "lunch" || entry.slot === "dinner" ? isCompleteMeal(r) : true))
      .filter((r) => signature(r) !== key && !usedReplacements.has(r.id))
      .sort(
        (a, b) =>
          (counts.get(signature(a)) ?? 0) - (counts.get(signature(b)) ?? 0) ||
          Number(favouriteRecipeIds.includes(b.id)) - Number(favouriteRecipeIds.includes(a.id)),
      )[0];
    if (!replacement) continue;
    usedReplacements.add(replacement.id);

    issues.push({
      entryId: entry.id,
      date: entry.plan_date,
      slot: entry.slot,
      current: entry.recipes!,
      times: soFar,
      replacement,
      note: `You've had something like ${entry.recipes!.title.toLowerCase()} ${soFar} times this month — shall I make it ${replacement.title.toLowerCase()} instead?`,
    });
    if (issues.length >= max) break;
  }
  return issues;
}

/* ------------------------------------------------------------------ *
 * Lily's weekly surprise
 * ------------------------------------------------------------------ */

/** One special dish a week, chosen from everything she knows they like. */
export function weeklySurprise({
  recipes,
  favouriteRecipeIds = [],
  weekStart,
  entries = [],
}: {
  recipes: Recipe[];
  favouriteRecipeIds?: string[];
  weekStart: string;
  entries?: PlanEntry[];
}): Recipe | null {
  const planned = new Set(entries.map((e) => e.recipe_id).filter(Boolean) as string[]);
  const favSignatures = new Set(
    recipes.filter((r) => favouriteRecipeIds.includes(r.id)).map((r) => signature(r)),
  );
  const pool = recipes
    .filter((r) => isCompleteMeal(r) && (r.meal_types.includes("dinner") || r.meal_types.includes("lunch")))
    .filter((r) => !planned.has(r.id))
    .sort(
      (a, b) =>
        Number(favSignatures.has(signature(b))) - Number(favSignatures.has(signature(a))) ||
        b.protein - a.protein,
    );
  if (!pool.length) return null;
  const seed = [...weekStart].reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[seed % Math.min(pool.length, 8)] ?? pool[0]!;
}

/* ------------------------------------------------------------------ *
 * Shopping mission
 * ------------------------------------------------------------------ */

export type ShoppingGroup = { heading: string; hint: string; rows: GroceryItem[] };

const FRESH_AISLES = ["Produce", "Meat", "Fish", "Dairy", "Bakery"];

/**
 * Turns one long list into a short mission: what to buy now, what's already at
 * home, and what can honestly wait until next week.
 */
export function shoppingMission({
  items,
  pantry,
}: {
  items: GroceryItem[];
  pantry: PantryItem[];
}): { groups: ShoppingGroup[]; toBuy: number } {
  const inStock = pantry.filter((p) => p.quantity > p.low_threshold);
  const have: GroceryItem[] = [];
  const fresh: GroceryItem[] = [];
  const cupboard: GroceryItem[] = [];
  const later: GroceryItem[] = [];

  items.forEach((item) => {
    if (item.checked) return;
    if (inStock.some((s) => sameIngredient(s.name, item.name))) have.push(item);
    else if (FRESH_AISLES.includes(item.category)) fresh.push(item);
    else if (item.category === "Spices") later.push(item);
    else cupboard.push(item);
  });

  const groups: ShoppingGroup[] = [
    { heading: "🥬 Buy fresh today", hint: "These are for the meals coming up first.", rows: fresh },
    { heading: "🥫 While you're there", hint: "Keeps for weeks — grab it in one go.", rows: cupboard },
    { heading: "🌿 Can wait", hint: "Only if you're passing; nothing depends on it.", rows: later },
    { heading: "✅ Already at home", hint: "You have enough of these — don't buy them again.", rows: have },
  ].filter((g) => g.rows.length);

  return { groups, toBuy: fresh.length + cupboard.length };
}

/* ------------------------------------------------------------------ *
 * "You saved this much" — the month, in kind numbers
 * ------------------------------------------------------------------ */

export type MonthSummary = {
  mealsPlanned: number;
  mealsCooked: number;
  mealsLogged: number;
  prepBatches: number;
  prepPortionsUsed: number;
  usedBeforeExpiry: number;
  wasteAvoidedGrams: number;
  groceryTicked: number;
  savedByLeftovers: number;
  savedBySwaps: number;
};

export function monthSummary({
  entries,
  logs,
  prep,
  grocery,
  pantry,
  perMealCost = 35,
}: {
  entries: PlanEntry[];
  logs: FoodLog[];
  prep: PrepBatch[];
  grocery: GroceryItem[];
  pantry: PantryItem[];
  /** Rough cost of one home-cooked serving, used only for the "saved" line. */
  perMealCost?: number;
}): MonthSummary {
  const cooked = entries.filter((e) => e.cooked);
  const prepPortionsUsed = prep.reduce((a, b) => a + Math.max(0, b.portions_total - b.portions_left), 0);
  const leftoverGrams = entries
    .filter((e) => e.cooked && e.recipes)
    .reduce((a, e) => {
      const recipe = e.recipes!;
      const wanted = Object.values(e.portions ?? {}).reduce((x, y) => x + y, 0) || 2;
      const perServing = finishedWeight(recipe) / Math.max(1, recipe.base_servings);
      const batches = Math.max(1, Math.round((wanted / Math.max(1, recipe.base_servings)) * 4) / 4);
      return a + Math.max(0, finishedWeight(recipe) * batches - perServing * wanted);
    }, 0);
  const swaps = entries.reduce((a, e) => a + Object.keys(e.swaps ?? {}).length, 0);

  return {
    mealsPlanned: entries.length,
    mealsCooked: cooked.length,
    mealsLogged: logs.length,
    prepBatches: prep.length,
    prepPortionsUsed: Math.round(prepPortionsUsed * 10) / 10,
    usedBeforeExpiry: pantry.filter((p) => p.quantity === 0).length,
    wasteAvoidedGrams: Math.round(leftoverGrams / 10) * 10,
    groceryTicked: grocery.filter((g) => g.checked).length,
    savedByLeftovers: Math.round((prepPortionsUsed + leftoverGrams / 350) * perMealCost),
    savedBySwaps: swaps * 8,
  };
}

export const ALL_SLOTS = SLOTS;
