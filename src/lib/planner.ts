import type { Profile, Recipe } from "./db";
import { SLOTS, SLOT_MEAL_TYPE, SLOT_SHARE, isoDate, suggestedPortion } from "./nutrition";

export type Restrictions = {
  avoidWords: string[];
  needVegetarian: boolean;
  needVegan: boolean;
  budgetFirst: boolean;
};

export function restrictionsFor(people: Profile[]): Restrictions {
  const avoidWords = people
    .flatMap((p) => [...(p.allergies ?? []), ...(p.disliked ?? [])])
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  const prefs = people.flatMap((p) => p.diet_prefs ?? []);
  return {
    avoidWords,
    needVegetarian: prefs.includes("vegetarian"),
    needVegan: prefs.includes("vegan"),
    budgetFirst: prefs.includes("budget"),
  };
}

export function recipeAllowed(recipe: Recipe, r: Restrictions) {
  if (r.needVegan && !recipe.tags.includes("vegan")) return false;
  if (r.needVegetarian && !recipe.tags.includes("vegan") && !recipe.tags.includes("vegetarian"))
    return false;
  if (r.avoidWords.length) {
    const haystack = [
      recipe.title,
      ...recipe.ingredients.map((i) => i.name),
    ]
      .join(" ")
      .toLowerCase();
    if (r.avoidWords.some((w) => w.length > 2 && haystack.includes(w))) return false;
  }
  return true;
}

export function candidatesFor(recipes: Recipe[], slot: string, r: Restrictions) {
  const mealType = SLOT_MEAL_TYPE[slot] ?? "dinner";
  const pool = recipes.filter((rec) => rec.meal_types.includes(mealType) && recipeAllowed(rec, r));
  const fallback = recipes.filter((rec) => recipeAllowed(rec, r));
  const list = pool.length ? pool : fallback;
  if (!r.budgetFirst) return list;
  return [...list].sort(
    (a, b) => Number(b.tags.includes("budget")) - Number(a.tags.includes("budget")),
  );
}

export function portionsFor(people: Profile[], slot: string, recipe: Recipe) {
  const portions: Record<string, number> = {};
  const targets = people.map((p) => p.calorie_target);
  const share = SLOT_SHARE[slot] ?? 0.3;
  people.forEach((p) => {
    const wanted = p.calorie_target * share;
    const others = targets.filter((_, i) => people[i]!.id !== p.id);
    const balance = suggestedPortion(p.calorie_target, others);
    const byCalories = recipe.calories > 0 ? wanted / recipe.calories : 1;
    const blended = (byCalories * 2 + balance) / 3;
    portions[p.id] = Math.round(Math.min(2.2, Math.max(0.4, blended)) * 20) / 20;
  });
  return portions;
}

/** Build a full week: 3 meals + 2 snacks each day, avoiding recent repeats. */
export function buildWeekPlan(
  dates: Date[],
  recipes: Recipe[],
  people: Profile[],
  seed = 0,
) {
  const r = restrictionsFor(people);
  const recent: string[] = [];
  const entries: {
    plan_date: string;
    slot: string;
    recipe_id: string;
    portions: Record<string, number>;
  }[] = [];

  dates.forEach((date, dayIndex) => {
    SLOTS.forEach((slot, slotIndex) => {
      const pool = candidatesFor(recipes, slot, r);
      if (!pool.length) return;
      const fresh = pool.filter((rec) => !recent.includes(rec.id));
      const usable = fresh.length ? fresh : pool;
      const pick = usable[(dayIndex * 7 + slotIndex * 3 + seed) % usable.length]!;
      recent.push(pick.id);
      if (recent.length > 6) recent.shift();
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

export const GROCERY_ORDER = [
  "Produce",
  "Meat",
  "Fish",
  "Dairy",
  "Bakery",
  "Pantry",
  "Spices",
  "Other",
];

export function buildGroceryList(
  entries: { recipes: Recipe | null; portions: Record<string, number> }[],
) {
  const map = new Map<string, { name: string; category: string; amounts: string[]; times: number }>();
  entries.forEach((entry) => {
    const recipe = entry.recipes;
    if (!recipe) return;
    const totalPortions = Object.values(entry.portions ?? {}).reduce((a, b) => a + b, 0) || 1;
    const batches = Math.max(1, Math.round(totalPortions / Math.max(1, recipe.base_servings) * 10) / 10);
    recipe.ingredients.forEach((ing) => {
      const key = ing.name.trim().toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.times += batches;
        if (!existing.amounts.includes(ing.amount)) existing.amounts.push(ing.amount);
      } else {
        map.set(key, {
          name: ing.name,
          category: ing.category || "Other",
          amounts: [ing.amount],
          times: batches,
        });
      }
    });
  });

  return [...map.values()]
    .map((item) => ({
      name: item.name,
      category: GROCERY_ORDER.includes(item.category) ? item.category : "Other",
      amount:
        item.times > 1.4
          ? `${item.amounts[0]} × ${Math.round(item.times * 10) / 10}`
          : (item.amounts[0] ?? ""),
    }))
    .sort(
      (a, b) =>
        GROCERY_ORDER.indexOf(a.category) - GROCERY_ORDER.indexOf(b.category) ||
        a.name.localeCompare(b.name),
    );
}
