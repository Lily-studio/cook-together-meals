import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Recipe } from "./db";
import { parseAmount } from "./portions";

export type PantryItem = {
  id: string;
  household_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  low_threshold: number;
  staple: boolean;
};

const db = supabase as unknown as { from: (table: string) => any };

export function usePantry(householdId: string | undefined) {
  return useQuery({
    queryKey: ["pantry", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<PantryItem[]> => {
      const { data, error } = await db
        .from("pantry_items")
        .select("*")
        .eq("household_id", householdId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PantryItem[];
    },
  });
}

export function usePantryMutations(householdId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pantry", householdId] });

  const add = useMutation({
    mutationFn: async (item: {
      name: string;
      quantity: number;
      unit: string;
      category?: string;
      low_threshold?: number;
    }) => {
      const { error } = await db.from("pantry_items").upsert(
        [
          {
            household_id: householdId,
            name: item.name.trim(),
            quantity: item.quantity,
            unit: item.unit,
            category: item.category ?? "Pantry",
            low_threshold: item.low_threshold ?? defaultThreshold(item.unit),
          },
        ],
        { onConflict: "household_id,name" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<PantryItem> }) => {
      const { error } = await db.from("pantry_items").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("pantry_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Take exactly what a cooked portion used out of the stock. */
  const consume = useMutation({
    mutationFn: async (used: { name: string; quantity: number; unit: string }[]) => {
      const { data, error } = await db
        .from("pantry_items")
        .select("*")
        .eq("household_id", householdId);
      if (error) throw error;
      const stock = (data ?? []) as PantryItem[];
      const touched: { id: string; quantity: number }[] = [];
      used.forEach((u) => {
        const match = stock.find(
          (s) => s.unit === u.unit && sameIngredient(s.name, u.name),
        );
        if (!match) return;
        const next = Math.max(0, Math.round((match.quantity - u.quantity) * 100) / 100);
        match.quantity = next;
        touched.push({ id: match.id, quantity: next });
      });
      for (const t of touched) {
        await db.from("pantry_items").update({ quantity: t.quantity }).eq("id", t.id);
      }
      return touched.length;
    },
    onSuccess: invalidate,
  });

  return { add, update, remove, consume };
}

export function defaultThreshold(unit: string) {
  if (unit === "g") return 200;
  if (unit === "ml") return 200;
  return 2;
}

export function sameIngredient(a: string, b: string) {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || x.includes(y) || y.includes(x);
}

/** What a recipe portion actually uses, in stock units. */
export function ingredientsUsed(
  recipe: Recipe,
  multiplier: number,
  swaps: Record<string, { name: string; amount: string }> = {},
) {
  const factor = multiplier / Math.max(1, recipe.base_servings);
  return recipe.ingredients
    .map((ing) => {
      const swapped = swaps[ing.name];
      const name = swapped?.name ?? ing.name;
      const parsed = parseAmount(swapped?.amount ?? ing.amount);
      if (!parsed) return null;
      return {
        name,
        category: ing.category || "Other",
        unit: parsed.unit,
        quantity: Math.round(parsed.value * factor * 100) / 100,
      };
    })
    .filter((x): x is { name: string; category: string; unit: string; quantity: number } => !!x && x.quantity > 0);
}

export function lowStock(items: PantryItem[]) {
  return items.filter((i) => i.quantity <= i.low_threshold);
}
