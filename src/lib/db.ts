import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isoDate, startOfWeek } from "./nutrition";

export type Ingredient = { name: string; amount: string; category: string };

export type Recipe = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  cuisine: string;
  meal_types: string[];
  emoji: string;
  base_servings: number;
  prep_minutes: number;
  cook_minutes: number;
  difficulty: string;
  ingredients: Ingredient[];
  steps: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  tags: string[];
  prep_friendly: boolean;
  lily_note: string;
};

export type Profile = {
  id: string;
  household_id: string;
  display_name: string;
  accent: string;
  is_owner: boolean;
  goal: string;
  activity_level: string;
  sex: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal_weight_kg: number | null;
  calorie_target: number;
  protein_target: number;
  carb_target: number;
  fat_target: number;
  diet_prefs: string[];
  allergies: string[];
  disliked: string[];
  ingredient_rules: Record<string, string>;
  /** "regular" | "monsieur_cuisine" | "thermomix" | "custom" */
  cooking_method: string;
  cooking_method_note: string;
  /** Foods Lily should lean on more often, remembered from conversations. */
  prefer_more: string[];
  /** Lasting instructions Lily has been told to remember. */
  lily_notes: string[];
  onboarding_complete: boolean;
};

export type PlanEntry = {
  id: string;
  household_id: string;
  plan_date: string;
  slot: string;
  recipe_id: string | null;
  custom_title: string | null;
  portions: Record<string, number>;
  swaps: Record<string, { name: string; amount: string }>;
  cooked: boolean;
  recipes: Recipe | null;
};

export type FoodLog = {
  id: string;
  profile_id: string;
  log_date: string;
  slot: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
};

export type GroceryItem = {
  id: string;
  week_start: string;
  name: string;
  amount: string;
  category: string;
  checked: boolean;
  manual: boolean;
};

const db = supabase as unknown as {
  from: (table: string) => any;
};

/* ---------------- profiles / household ---------------- */

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useHouseholdProfiles(householdId: string | undefined) {
  return useQuery({
    queryKey: ["household-profiles", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await db
        .from("profiles")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<Profile> }) => {
      const { error } = await db.from("profiles").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["household-profiles"] });
    },
  });
}

export function useAddPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Profile> & { household_id: string }) => {
      const id = crypto.randomUUID();
      const { error } = await db
        .from("profiles")
        .insert([{ ...values, id, is_owner: false, onboarding_complete: true }]);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["household-profiles"] }),
  });
}

export function useRemovePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["household-profiles"] }),
  });
}

/* ---------------- recipes ---------------- */

export function useRecipes() {
  return useQuery({
    queryKey: ["recipes"],
    queryFn: async (): Promise<Recipe[]> => {
      const { data, error } = await db.from("recipes").select("*").order("title");
      if (error) throw error;
      return (data ?? []) as Recipe[];
    },
  });
}

export function useRecipe(slug: string) {
  return useQuery({
    queryKey: ["recipe", slug],
    queryFn: async (): Promise<Recipe | null> => {
      const { data, error } = await db.from("recipes").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as Recipe | null;
    },
  });
}

/* ---------------- meal plan ---------------- */

export function usePlan(householdId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["plan", householdId, from, to],
    enabled: !!householdId,
    queryFn: async (): Promise<PlanEntry[]> => {
      const { data, error } = await db
        .from("meal_plan_entries")
        .select("*, recipes(*)")
        .eq("household_id", householdId)
        .gte("plan_date", from)
        .lte("plan_date", to)
        .order("plan_date");
      if (error) throw error;
      return (data ?? []) as PlanEntry[];
    },
  });
}

export function useSetPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      household_id: string;
      plan_date: string;
      slot: string;
      recipe_id: string | null;
      portions: Record<string, number>;
    }) => {
      const { error } = await db
        .from("meal_plan_entries")
        .upsert([entry], { onConflict: "household_id,plan_date,slot" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan"] }),
  });
}

export function useUpdatePlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await db.from("meal_plan_entries").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan"] }),
  });
}

export function useDeletePlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("meal_plan_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan"] }),
  });
}

/* ---------------- food logs ---------------- */

export function useLogs(householdId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["logs", householdId, from, to],
    enabled: !!householdId,
    queryFn: async (): Promise<FoodLog[]> => {
      const { data, error } = await db
        .from("food_logs")
        .select("*")
        .gte("log_date", from)
        .lte("log_date", to)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FoodLog[];
    },
  });
}

export function useAddLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: {
      profile_id: string;
      household_id: string;
      log_date: string;
      slot: string;
      description: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      source?: string;
    }) => {
      const { error } = await db.from("food_logs").insert([log]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs"] }),
  });
}

export function useDeleteLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("food_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs"] }),
  });
}

/* ---------------- favorites ---------------- */

export function useFavorites(householdId: string | undefined) {
  return useQuery({
    queryKey: ["favorites", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await db.from("favorites").select("*, recipes(*)");
      if (error) throw error;
      return (data ?? []) as { id: string; profile_id: string; recipe_id: string; recipes: Recipe }[];
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileId,
      householdId,
      recipeId,
      existingId,
    }: {
      profileId: string;
      householdId: string;
      recipeId: string;
      existingId?: string;
    }) => {
      if (existingId) {
        const { error } = await db.from("favorites").delete().eq("id", existingId);
        if (error) throw error;
        return;
      }
      const { error } = await db
        .from("favorites")
        .insert([{ profile_id: profileId, household_id: householdId, recipe_id: recipeId }]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });
}

/* ---------------- grocery ---------------- */

export function useGrocery(householdId: string | undefined, weekStart: string) {
  return useQuery({
    queryKey: ["grocery", householdId, weekStart],
    enabled: !!householdId,
    queryFn: async (): Promise<GroceryItem[]> => {
      const { data, error } = await db
        .from("grocery_items")
        .select("*")
        .eq("household_id", householdId)
        .eq("week_start", weekStart)
        .order("category");
      if (error) throw error;
      return (data ?? []) as GroceryItem[];
    },
  });
}

export function useGroceryMutations(householdId: string | undefined, weekStart: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["grocery", householdId, weekStart] });

  const add = useMutation({
    mutationFn: async (items: { name: string; amount: string; category: string; manual?: boolean }[]) => {
      const { error } = await db
        .from("grocery_items")
        .insert(items.map((i) => ({ ...i, household_id: householdId, week_start: weekStart })));
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggle = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await db.from("grocery_items").update({ checked }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("grocery_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await db
        .from("grocery_items")
        .delete()
        .eq("household_id", householdId)
        .eq("week_start", weekStart);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, toggle, remove, clear };
}

export const thisWeekStart = () => isoDate(startOfWeek(new Date()));

/* ---------------- Lily plans the month ---------------- */

/**
 * Generates and SAVES a full four-week plan (28 days × 5 eating moments)
 * plus a shopping list for each of those weeks. This is the one action
 * behind "Plan my month with Lily" — nothing here is a mock-up.
 */
export function usePlanMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      people,
      recipes,
      favouriteRecipeIds = [],
      start,
      seed = 0,
      pantry = [],
      avoidRecipeIds = [],
      lovedRecipeIds = [],
      skip = [],
      quick = [],
      guests = {},
    }: {
      householdId: string;
      people: Profile[];
      recipes: Recipe[];
      favouriteRecipeIds?: string[];
      start?: Date;
      seed?: number;
      pantry?: { name: string }[];
      /** Meals rated "never again". */
      avoidRecipeIds?: string[];
      /** Meals rated "loved it". */
      lovedRecipeIds?: string[];
      /** "date|slot" keys nobody's home for. */
      skip?: string[];
      /** "date|slot" keys that must be quick. */
      quick?: string[];
      /** Extra plates per "date|slot" key. */
      guests?: Record<string, number>;
    }) => {
      const { generateMonth, monthDates } = await import("./month-plan");
      const { buildGroceryList } = await import("./planner");

      const first = startOfWeek(start ?? new Date());
      const dates = monthDates(first);
      const generated = generateMonth({
        start: first,
        recipes,
        people,
        favouriteRecipeIds,
        seed,
        avoidRecipeIds,
        lovedRecipeIds,
        skip,
        quick,
        guests,
      });
      if (!generated.length) throw new Error("Lily needs a few recipes before she can plan");

      const from = isoDate(dates[0]!);
      const to = isoDate(dates[27]!);

      const wipe = await db
        .from("meal_plan_entries")
        .delete()
        .eq("household_id", householdId)
        .gte("plan_date", from)
        .lte("plan_date", to);
      if (wipe.error) throw wipe.error;

      const rows = generated.map((e) => ({ ...e, household_id: householdId }));
      for (let i = 0; i < rows.length; i += 60) {
        const { error } = await db.from("meal_plan_entries").insert(rows.slice(i, i + 60));
        if (error) throw error;
      }

      // Shopping list per week, built from the exact recipes and portions.
      const byId = new Map(recipes.map((r) => [r.id, r]));
      const haveAtHome = new Set(pantry.map((p) => p.name.trim().toLowerCase()));
      for (let w = 0; w < 4; w++) {
        const weekFrom = isoDate(dates[w * 7]!);
        const weekTo = isoDate(dates[w * 7 + 6]!);
        const weekStart = weekFrom;

        const cleared = await db
          .from("grocery_items")
          .delete()
          .eq("household_id", householdId)
          .eq("week_start", weekStart)
          .eq("manual", false);
        if (cleared.error) throw cleared.error;

        const weekEntries = generated
          .filter((e) => e.plan_date >= weekFrom && e.plan_date <= weekTo)
          .map((e) => ({ recipes: byId.get(e.recipe_id) ?? null, portions: e.portions }));
        const list = buildGroceryList(weekEntries).filter(
          (item) => !haveAtHome.has(item.name.trim().toLowerCase()),
        );
        if (list.length) {
          const { error } = await db
            .from("grocery_items")
            .insert(list.map((i) => ({ ...i, household_id: householdId, week_start: weekStart })));
          if (error) throw error;
        }
      }

      return { days: 28, meals: generated.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
    },
  });
}

/* ---------------- meal prep batches ---------------- */

export type PrepBatch = {
  id: string;
  household_id: string;
  recipe_id: string | null;
  title: string;
  portions_total: number;
  portions_left: number;
  prepared_on: string;
  best_before: string | null;
  note: string;
};

export function usePrepBatches(householdId: string | undefined) {
  return useQuery({
    queryKey: ["prep-batches", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<PrepBatch[]> => {
      const { data, error } = await db
        .from("prep_batches")
        .select("*")
        .eq("household_id", householdId)
        .order("prepared_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PrepBatch[];
    },
  });
}

export function usePrepMutations(householdId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["prep-batches", householdId] });

  const add = useMutation({
    mutationFn: async (batch: {
      recipe_id: string | null;
      title: string;
      portions_total: number;
      best_before?: string | null;
      note?: string;
    }) => {
      const { error } = await db.from("prep_batches").insert([
        {
          household_id: householdId,
          recipe_id: batch.recipe_id,
          title: batch.title,
          portions_total: batch.portions_total,
          portions_left: batch.portions_total,
          best_before: batch.best_before ?? null,
          note: batch.note ?? "",
        },
      ]);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const takePortion = useMutation({
    mutationFn: async ({ id, left }: { id: string; left: number }) => {
      const next = Math.max(0, Math.round((left - 1) * 10) / 10);
      const { error } = await db.from("prep_batches").update({ portions_left: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("prep_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, takePortion, remove };
}
