import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { useFavorites, usePlanMonth, useRecipes } from "@/lib/db";
import { usePantry } from "@/lib/pantry";
import { cn } from "@/lib/utils";

/**
 * The one button that matters: Lily generates and saves four full weeks,
 * with per-person portions and the shopping list for every week.
 */
export function PlanMonthButton({
  label = "✨ Plan my month with Lily",
  className,
  size = "default",
  reshuffle = false,
}: {
  label?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  /** Pass true for a "give me a different month" action. */
  reshuffle?: boolean;
}) {
  const { householdId, people } = useApp();
  const { data: recipes = [] } = useRecipes();
  const favorites = useFavorites(householdId);
  const pantry = usePantry(householdId);
  const planMonth = usePlanMonth();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!householdId || !people.length) return;
    if (!recipes.length) {
      toast.error("Lily's recipe book is still loading — one moment.");
      return;
    }
    setBusy(true);
    try {
      const result = await planMonth.mutateAsync({
        householdId,
        people,
        recipes,
        favouriteRecipeIds: (favorites.data ?? []).map((f) => f.recipe_id),
        pantry: pantry.data ?? [],
        seed: reshuffle ? Math.floor(Math.random() * 97) + 1 : 0,
      });
      toast.success(`Four weeks planned — ${result.meals} meals and your shopping list 🌼`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lily couldn't finish the plan. Try again?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size={size} onClick={run} disabled={busy} className={cn("rounded-full", className)}>
      <Sparkles className="size-4" />
      {busy ? "Lily is planning…" : label}
    </Button>
  );
}
