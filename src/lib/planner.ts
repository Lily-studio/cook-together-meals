import type { Profile, Recipe } from "./db";
import { hasLunchProtein, isCompleteMeal, lunchRuleRelaxed } from "./lily-brain";
import { SLOTS, SLOT_MEAL_TYPE, SLOT_SHARE, isoDate, suggestedPortion } from "./nutrition";
import { formatStock, parseAmount } from "./portions";

export type Restrictions = {
  avoidWords: string[];
  needVegetarian: boolean;
  needVegan: boolean;
  budgetFirst: boolean;
  /** Ingredients marked "sometimes" or "too pricey" — allowed, but ranked lower. */
  demoteWords: string[];
};

export function restrictionsFor(people: Profile[]): Restrictions {
  const avoidWords = people
    .flatMap((p) => [...(p.allergies ?? []), ...(p.disliked ?? [])])
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  const prefs = people.flatMap((p) => p.diet_prefs ?? []);
  const rules = people.flatMap((p) => Object.entries(p.ingredient_rules ?? {}));
  const never = rules
    .filter(([, v]) => v === "never")
    .map(([k]) => k.trim().toLowerCase())
    .filter(Boolean);
  const demoteWords = rules
    .filter(([, v]) => v === "sometimes" || v === "pricey")
    .map(([k]) => k.trim().toLowerCase())
    .filter(Boolean);
  return {
    avoidWords: [...avoidWords, ...never],
    demoteWords,
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

export function candidatesFor(
  recipes: Recipe[],
  slot: string,
  r: Restrictions,
  options: { relaxLunchRule?: boolean } = {},
) {
  const mealType = SLOT_MEAL_TYPE[slot] ?? "dinner";
  const pool = recipes.filter((rec) => rec.meal_types.includes(mealType) && recipeAllowed(rec, r));
  const fallback = recipes.filter((rec) => recipeAllowed(rec, r));
  let list = pool.length ? pool : fallback;
  // Lunch and dinner are always proper main meals — never a side or a nibble.
  if (slot === "lunch" || slot === "dinner") {
    const mains = list.filter(isCompleteMeal);
    if (mains.length) list = mains;
  }
  // The permanent house rule: lunch is chicken, minced meat or turkey.
  if (slot === "lunch" && !options.relaxLunchRule) {
    const withProtein = list.filter(hasLunchProtein);
    if (withProtein.length) list = withProtein;
  }

  const demoted = (rec: Recipe) => {
    if (!r.demoteWords.length) return 0;
    const hay = [rec.title, ...rec.ingredients.map((i) => i.name)].join(" ").toLowerCase();
    return r.demoteWords.some((w) => w.length > 2 && hay.includes(w)) ? 1 : 0;
  };
  return [...list].sort(
    (a, b) =>
      demoted(a) - demoted(b) ||
      (r.budgetFirst ? Number(b.tags.includes("budget")) - Number(a.tags.includes("budget")) : 0),
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
  const relaxLunchRule = lunchRuleRelaxed(people);
  const recent: string[] = [];
  const entries: {
    plan_date: string;
    slot: string;
    recipe_id: string;
    portions: Record<string, number>;
  }[] = [];

  dates.forEach((date, dayIndex) => {
    SLOTS.forEach((slot, slotIndex) => {
      const pool = candidatesFor(recipes, slot, r, { relaxLunchRule });
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

/** When a recipe forgot to say which aisle an ingredient belongs to. */
const AISLE_WORDS: { word: string; aisle: string }[] = [
  { word: "chicken", aisle: "Meat" },
  { word: "turkey", aisle: "Meat" },
  { word: "beef", aisle: "Meat" },
  { word: "lamb", aisle: "Meat" },
  { word: "mince", aisle: "Meat" },
  { word: "kefta", aisle: "Meat" },
  { word: "sardine", aisle: "Fish" },
  { word: "tuna", aisle: "Fish" },
  { word: "fish", aisle: "Fish" },
  { word: "prawn", aisle: "Fish" },
  { word: "egg", aisle: "Dairy" },
  { word: "yoghurt", aisle: "Dairy" },
  { word: "milk", aisle: "Dairy" },
  { word: "cheese", aisle: "Dairy" },
  { word: "butter", aisle: "Dairy" },
  { word: "labneh", aisle: "Dairy" },
  { word: "khobz", aisle: "Bakery" },
  { word: "batbout", aisle: "Bakery" },
  { word: "msemen", aisle: "Bakery" },
  { word: "harcha", aisle: "Bakery" },
  { word: "bread", aisle: "Bakery" },
  { word: "baguette", aisle: "Bakery" },
  { word: "pitta", aisle: "Bakery" },
  { word: "couscous", aisle: "Bakery" },
  { word: "semolina", aisle: "Bakery" },
  { word: "flour", aisle: "Pantry" },
  { word: "cumin", aisle: "Spices" },
  { word: "paprika", aisle: "Spices" },
  { word: "cinnamon", aisle: "Spices" },
  { word: "turmeric", aisle: "Spices" },
  { word: "ras el hanout", aisle: "Spices" },
  { word: "saffron", aisle: "Spices" },
  { word: "ginger", aisle: "Spices" },
  { word: "fenugreek", aisle: "Spices" },
  { word: "pepper", aisle: "Produce" },
  { word: "tomato", aisle: "Produce" },
  { word: "onion", aisle: "Produce" },
  { word: "garlic", aisle: "Produce" },
  { word: "carrot", aisle: "Produce" },
  { word: "courgette", aisle: "Produce" },
  { word: "cucumber", aisle: "Produce" },
  { word: "potato", aisle: "Produce" },
  { word: "parsley", aisle: "Produce" },
  { word: "coriander", aisle: "Produce" },
  { word: "mint", aisle: "Produce" },
  { word: "lemon", aisle: "Produce" },
  { word: "orange", aisle: "Produce" },
  { word: "banana", aisle: "Produce" },
  { word: "apple", aisle: "Produce" },
  { word: "aubergine", aisle: "Produce" },
  { word: "pumpkin", aisle: "Produce" },
  { word: "celery", aisle: "Produce" },
  { word: "date", aisle: "Produce" },
];

export function aisleFor(name: string, given: string) {
  if (GROCERY_ORDER.includes(given) && given !== "Other") return given;
  const needle = name.trim().toLowerCase();
  return AISLE_WORDS.find((a) => needle.includes(a.word))?.aisle ?? "Pantry";
}

type Line = {
  name: string;
  category: string;
  grams: number;
  ml: number;
  pieces: number;
  vague: { text: string; times: number } | null;
};

/** Things nobody buys by the gram: tap water, salt, seasoning "to taste". */
const NOT_SHOPPING = ["water", "salt", "ice", "to taste"];

/** Spoons and pinches become millilitres and grams so totals add up properly. */
function spoonsToMetric(amount: string) {
  const raw = (amount ?? "").toLowerCase();
  const match = raw.match(/^\s*([\d.,/]+)\s*(tbsp|tablespoon|tsp|teaspoon|pinch|clove|cloves)/);
  if (!match) return amount;
  const [whole, part] = match[1]!.replace(",", ".").split("/");
  const value = part ? Number(whole) / Number(part) : Number(whole);
  if (!Number.isFinite(value)) return amount;
  const unit = match[2]!;
  if (unit.startsWith("tb") || unit === "tablespoon") return `${value * 15} ml`;
  if (unit.startsWith("ts") || unit === "teaspoon") return `${value * 5} g`;
  if (unit === "pinch") return `${value} g`;
  return `${value} pc`;
}

/**
 * The real shopping list: every ingredient the plan needs, added up into one
 * honest quantity per item (400 g + 250 g = 650 g, not "400 g × 2").
 */
export function buildGroceryList(
  entries: { recipes: Recipe | null; portions: Record<string, number> }[],
) {
  const map = new Map<string, Line>();

  entries.forEach((entry) => {
    const recipe = entry.recipes;
    if (!recipe) return;
    const totalPortions = Object.values(entry.portions ?? {}).reduce((a, b) => a + b, 0) || 1;
    const batches = Math.max(0.5, Math.round((totalPortions / Math.max(1, recipe.base_servings)) * 20) / 20);

    recipe.ingredients.forEach((ing) => {
      const key = ing.name.trim().toLowerCase();
      if (NOT_SHOPPING.some((w) => key === w || key.startsWith(`${w} `) || key.endsWith(` ${w}`)))
        return;
      const line =
        map.get(key) ??
        ({
          name: ing.name,
          category: aisleFor(ing.name, ing.category),
          grams: 0,
          ml: 0,
          pieces: 0,
          vague: null,
        } satisfies Line);

      const parsed = parseAmount(spoonsToMetric(ing.amount));
      if (!parsed) {
        line.vague = { text: ing.amount, times: (line.vague?.times ?? 0) + batches };
      } else if (parsed.unit === "g") line.grams += parsed.value * batches;
      else if (parsed.unit === "ml") line.ml += parsed.value * batches;
      else line.pieces += parsed.value * batches;

      map.set(key, line);
    });
  });

  return [...map.values()]
    .map((line) => {
      const parts: string[] = [];
      // A millilitre of anything you cook with weighs about a gram, so keep one number.
      const grams = line.grams > 0 && line.ml > 0 ? line.grams + line.ml : line.grams;
      const ml = line.grams > 0 ? 0 : line.ml;
      if (grams > 0) parts.push(formatStock(Math.ceil(grams / 10) * 10, "g"));
      if (ml > 0) parts.push(formatStock(Math.ceil(ml / 10) * 10, "ml"));
      if (line.pieces > 0) parts.push(countPhrase(line.name, Math.ceil(line.pieces)));
      if (!parts.length && line.vague) parts.push(vaguePhrase(line.vague.text, line.vague.times));
      return { name: line.name, category: line.category, amount: parts.join(" + ") };
    })
    .sort(
      (a, b) =>
        GROCERY_ORDER.indexOf(a.category) - GROCERY_ORDER.indexOf(b.category) ||
        a.name.localeCompare(b.name),
    );
}

/** "9 carrots", "6 cloves garlic", "4 eggs" — never "3 × 3". */
function countPhrase(name: string, count: number) {
  const needle = name.trim().toLowerCase();
  const plural = (word: string) => (count === 1 ? word : word.endsWith("s") ? word : `${word}s`);
  if (needle.includes("garlic")) return `${count} ${plural("clove")} garlic`;
  const known = [
    "egg",
    "onion",
    "carrot",
    "tomato",
    "lemon",
    "orange",
    "banana",
    "apple",
    "potato",
    "courgette",
    "pepper",
    "cucumber",
    "aubergine",
    "date",
    "khobz",
    "batbout",
    "msemen",
    "harcha",
  ].find((w) => needle.includes(w));
  if (known) {
    const noun = known === "potato" || known === "tomato" ? `${known}es` : plural(known);
    return `${count} ${count === 1 ? known : noun}`;
  }
  return `${count} ${plural("piece")}`;
}

/** Amounts with no number at all ("a handful", "a bunch") become a real count. */
function vaguePhrase(text: string, times: number) {
  const count = Math.max(1, Math.round(times));
  const label = text.trim().replace(/^(a|an|some)\s+/i, "");
  if (!label) return `${count} pieces`;
  if (count === 1) return label;
  const plural = /s$/i.test(label) ? label : `${label}s`;
  return `${count} ${plural}`;
}

