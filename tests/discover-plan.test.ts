import { describe, expect, test } from "bun:test";
import type { Profile, Recipe } from "../src/lib/db";
import { cleanValues, findCatalogRecipe, needsConfirmation, planRotation, planSpecific } from "../src/lib/discover-plan";

const recipe = (over: Partial<Recipe>): Recipe => ({
  id: over.slug ?? "x",
  slug: "x",
  title: "X",
  tagline: "",
  cuisine: "Moroccan",
  meal_types: ["lunch", "dinner"],
  emoji: "",
  base_servings: 2,
  prep_minutes: 10,
  cook_minutes: 20,
  difficulty: "easy",
  ingredients: [{ name: "chicken breast", amount: "300 g", category: "Meat" }],
  steps: [],
  calories: 600,
  protein: 40,
  carbs: 50,
  fat: 20,
  fiber: 5,
  tags: ["main"],
  prep_friendly: false,
  lily_note: "",
  ...over,
});

const person = (over: Partial<Profile>): Profile =>
  ({
    id: "p1",
    household_id: "h",
    display_name: "Lina",
    calorie_target: 1800,
    protein_target: 120,
    allergies: [],
    disliked: [],
    diet_prefs: [],
    ingredient_rules: {},
    cooking_method: "regular",
    ...over,
  }) as unknown as Profile;

const shawarma = recipe({ slug: "chicken-shawarma", title: "Chicken Shawarma Rice Bowl", ingredients: [{ name: "chicken thighs", amount: "400 g", category: "Meat" }, { name: "rice", amount: "150 g", category: "Grains" }] });
const kefta = recipe({ slug: "kefta-tagine", title: "Kefta Tagine with Rice", ingredients: [{ name: "minced beef", amount: "400 g", category: "Meat" }, { name: "rice", amount: "150 g", category: "Grains" }] });
const peanut = recipe({ slug: "peanut-chicken", title: "Peanut Chicken Noodles", ingredients: [{ name: "chicken", amount: "300 g", category: "Meat" }, { name: "peanut butter", amount: "40 g", category: "Pantry" }, { name: "noodles", amount: "150 g", category: "Grains" }] });
const cake = recipe({ slug: "orange-cake", title: "Orange Cake", meal_types: ["snack"], calories: 250, protein: 5, ingredients: [{ name: "flour", amount: "100 g", category: "Baking" }] });

const people = [person({ id: "a" }), person({ id: "b", display_name: "Nabil", calorie_target: 2600 })];

describe("findCatalogRecipe", () => {
  test("matches slug and fuzzy title", () => {
    expect(findCatalogRecipe([shawarma, kefta], "kefta-tagine")?.slug).toBe("kefta-tagine");
    expect(findCatalogRecipe([shawarma, kefta], "shawarma rice bowl")?.slug).toBe("chicken-shawarma");
    expect(findCatalogRecipe([shawarma], "sushi")).toBeNull();
  });
});

describe("planSpecific", () => {
  test("inserts with a portion for every person", () => {
    const r = planSpecific({ recipe: shawarma, date: "2026-10-01", slot: "lunch", people, existing: [] });
    expect("change" in r).toBe(true);
    if ("change" in r) {
      expect(Object.keys(r.change.portions).sort()).toEqual(["a", "b"]);
      expect(r.change.portions["b"]!).toBeGreaterThan(r.change.portions["a"]!);
    }
  });
  test("refuses allergens", () => {
    const allergic = [person({ id: "a", allergies: ["peanut"] })];
    const r = planSpecific({ recipe: peanut, date: "2026-10-01", slot: "dinner", people: allergic, existing: [] });
    expect("error" in r).toBe(true);
  });
  test("refuses a snack as lunch", () => {
    const r = planSpecific({ recipe: cake, date: "2026-10-01", slot: "lunch", people, existing: [] });
    expect("error" in r).toBe(true);
  });
  test("prevents same-day duplicates and cooked overwrite", () => {
    const dup = planSpecific({
      recipe: shawarma,
      date: "2026-10-01",
      slot: "dinner",
      people,
      existing: [{ plan_date: "2026-10-01", slot: "lunch", recipe_id: shawarma.id }],
    });
    expect("error" in dup).toBe(true);
    const cooked = planSpecific({
      recipe: kefta,
      date: "2026-10-01",
      slot: "dinner",
      people,
      existing: [{ plan_date: "2026-10-01", slot: "dinner", recipe_id: shawarma.id, cooked: true }],
    });
    expect("error" in cooked).toBe(true);
  });
});

describe("planRotation", () => {
  test("rotates every suitable recipe, keeps other slots and cooked meals", () => {
    const existing = [
      { plan_date: "2026-10-02", slot: "dinner", recipe_id: "old", cooked: true },
      { plan_date: "2026-10-02", slot: "breakfast", recipe_id: "bf" },
    ];
    const changes = planRotation({
      recipes: [shawarma, kefta, peanut, cake],
      people,
      existing,
      from: "2026-10-01",
      to: "2026-10-06",
      slots: ["dinner"],
    });
    expect(changes.every((c) => c.slot === "dinner")).toBe(true);
    expect(changes.find((c) => c.plan_date === "2026-10-02")).toBeUndefined();
    expect(changes.some((c) => c.recipe.slug === "orange-cake")).toBe(false);
    expect(new Set(changes.map((c) => c.recipe.slug)).size).toBe(3);
    // never the same recipe within 3 days
    for (const c of changes) {
      const clash = changes.find(
        (d) => d !== c && d.recipe.id === c.recipe.id && Math.abs(Date.parse(d.plan_date) - Date.parse(c.plan_date)) < 3 * 86_400_000,
      );
      expect(clash).toBeUndefined();
    }
  });
  test("only_empty leaves planned meals alone", () => {
    const changes = planRotation({
      recipes: [shawarma, kefta],
      people,
      existing: [{ plan_date: "2026-10-01", slot: "lunch", recipe_id: "keep" }],
      from: "2026-10-01",
      to: "2026-10-02",
      slots: ["lunch"],
      onlyEmpty: true,
    });
    expect(changes.map((c) => c.plan_date)).toEqual(["2026-10-02"]);
  });
});

describe("records & confirmation", () => {
  test("strips unknown and protected columns", () => {
    expect(cleanValues("pantry_items", { name: "Eggs", household_id: "evil", id: "x", quantity: 6 })).toEqual({
      name: "Eggs",
      quantity: 6,
    });
  });
  test("deletes and rotations need confirmation", () => {
    expect(needsConfirmation({ kind: "record_delete" })).toBe(true);
    expect(needsConfirmation({ kind: "rotate_discover" })).toBe(true);
    expect(needsConfirmation({ kind: "plan_recipe" })).toBe(false);
  });
});

import { activeRecipes, applyRecipeEdit, findOwnRecipe, needsConfirmation as nc2 } from "../src/lib/discover-plan";

describe("Discover recipe actions", () => {
  const mine = { id: "m1", slug: "my-turkey-bowl", title: "My Chicken Bowl", household_id: "h1", archived_at: null };
  const other = { id: "o1", slug: "their-bowl", title: "Their Bowl", household_id: "h2", archived_at: null };
  const shared = { id: "s1", slug: "shared-tagine", title: "Shared Tagine", household_id: null, archived_at: null };
  const gone = { id: "g1", slug: "gone", title: "Gone Dish", household_id: "h1", archived_at: "2026-01-01" };
  const all = [mine, other, shared, gone];

  test("finds own recipe to edit", () => {
    expect(findOwnRecipe(all, "h1", "my chicken bowl")).toEqual({ recipe: mine });
  });
  test("refuses shared and other households' recipes", () => {
    expect("error" in findOwnRecipe(all, "h1", "Shared Tagine")).toBe(true);
    expect("error" in findOwnRecipe(all, "h1", "Their Bowl")).toBe(true);
  });
  test("deleted recipes leave planning and can't be edited", () => {
    expect(activeRecipes(all).map((r) => r.id)).not.toContain("g1");
    expect("error" in findOwnRecipe(all, "h1", "Gone Dish")).toBe(true);
  });
  test("replace chicken with turkey edits ingredients and steps", () => {
    const out = applyRecipeEdit(
      { ingredients: [{ name: "Chicken breast", amount: "300 g" }] as never, steps: ["Sear the chicken"] as never, tags: [] },
      { replace_ingredient: { from: "chicken", to: "turkey" }, calories: 512.6 },
    );
    expect((out["ingredients"] as { name: string }[])[0]!.name).toBe("turkey breast");
    expect(out["steps"]).toEqual(["Sear the turkey"]);
    expect(out["calories"]).toBe(513);
  });
  test("equipment edit tags the recipe", () => {
    const out = applyRecipeEdit({ ingredients: [], steps: [], tags: ["main"] } as never, { equipment: ["Monsieur Cuisine"] });
    expect(out["tags"]).toEqual(["main", "monsieur cuisine"]);
  });
  test("recipe delete needs confirmation", () => {
    expect(nc2({ kind: "recipe_delete" })).toBe(true);
  });
});
