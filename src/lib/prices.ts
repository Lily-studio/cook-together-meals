/**
 * What things cost.
 *
 * The household can tell Lily roughly what an ingredient costs. Anything she
 * hasn't been told falls back to a rough built-in price, and is clearly marked
 * as a guess so the numbers are never pretended to be exact.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Recipe } from "./db";
import { priceOf } from "./lily-brain";
import { parseAmount } from "./portions";

export type IngredientPrice = {
  id: string;
  household_id: string;
  name: string;
  unit: string;
  pack_size: number;
  price: number;
  currency: string;
};

const db = supabase as unknown as { from: (table: string) => any };

export function usePrices(householdId: string | undefined) {
  return useQuery({
    queryKey: ["prices", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<IngredientPrice[]> => {
      const { data, error } = await db
        .from("ingredient_prices")
        .select("*")
        .eq("household_id", householdId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as IngredientPrice[];
    },
  });
}

export function usePriceMutations(householdId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["prices", householdId] });

  const save = useMutation({
    mutationFn: async (item: { name: string; price: number; pack_size?: number; unit?: string }) => {
      const { error } = await db.from("ingredient_prices").upsert(
        [
          {
            household_id: householdId,
            name: item.name.trim(),
            price: item.price,
            pack_size: item.pack_size ?? 100,
            unit: item.unit ?? "g",
          },
        ],
        { onConflict: "household_id,name" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("ingredient_prices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}

export type PriceBook = {
  currency: string;
  /** Price for 100 g / 100 ml / one piece, plus whether the household told us. */
  rate: (name: string) => { per100: number; perPiece: number; known: boolean };
};

export function buildPriceBook(list: IngredientPrice[] = []): PriceBook {
  const currency = list[0]?.currency ?? "MAD";
  return {
    currency,
    rate: (name: string) => {
      const needle = name.trim().toLowerCase();
      const hit =
        list.find((p) => p.name.trim().toLowerCase() === needle) ??
        list.find((p) => needle.includes(p.name.trim().toLowerCase()));
      if (hit && hit.pack_size > 0) {
        const unitPrice = hit.price / hit.pack_size;
        return {
          per100: hit.unit === "pc" ? unitPrice * 100 : unitPrice * 100,
          perPiece: hit.unit === "pc" ? unitPrice : unitPrice * 60,
          known: true,
        };
      }
      const guess = priceOf(name);
      return { per100: guess, perPiece: (guess * 60) / 100, known: false };
    },
  };
}

/** What one written amount of an ingredient costs. */
export function costOfAmount(name: string, amount: string, book: PriceBook) {
  const parsed = parseAmount(amount);
  const rate = book.rate(name);
  if (!parsed) return { cost: rate.per100 * 0.3, known: false };
  if (parsed.unit === "pc") return { cost: rate.perPiece * parsed.value, known: rate.known };
  return { cost: (rate.per100 * parsed.value) / 100, known: rate.known };
}

export type CostLine = { name: string; amount: string; cost: number; known: boolean };

export type MealCost = {
  lines: CostLine[];
  total: number;
  perServing: number;
  currency: string;
  guessed: number;
};

/** The cost of actually cooking this dish, at the size it's being cooked. */
export function mealCost(
  recipe: Recipe,
  book: PriceBook,
  options: { batches?: number; servings?: number; swaps?: Record<string, { name: string; amount: string }> } = {},
): MealCost {
  const batches = options.batches ?? 1;
  const servings = Math.max(1, options.servings ?? recipe.base_servings);
  const swaps = options.swaps ?? {};
  const lines = recipe.ingredients.map((ing) => {
    const name = swaps[ing.name]?.name ?? ing.name;
    const amount = swaps[ing.name]?.amount ?? ing.amount;
    const { cost, known } = costOfAmount(name, amount, book);
    return { name, amount, cost: Math.round(cost * batches * 100) / 100, known };
  });
  const total = Math.round(lines.reduce((a, l) => a + l.cost, 0) * 10) / 10;
  return {
    lines: lines.sort((a, b) => b.cost - a.cost),
    total,
    perServing: Math.round((total / servings) * 10) / 10,
    currency: book.currency,
    guessed: lines.filter((l) => !l.known).length,
  };
}

export function money(value: number, currency = "MAD") {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} ${currency}`;
}
