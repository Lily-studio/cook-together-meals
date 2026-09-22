import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { useFavorites, usePlanMonth, useRecipes } from "@/lib/db";
import { usePantry } from "@/lib/pantry";
import { feedbackSplit, planRules, useEvents, useFeedback } from "@/lib/household";
import { SLOTS, isoDate, startOfWeek } from "@/lib/nutrition";
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

  // Real life for the four weeks Lily is about to plan.
  const range = useMemo(() => {
    const first = startOfWeek(new Date());
    const last = new Date(first);
    last.setDate(last.getDate() + 27);
    return { from: isoDate(first), to: isoDate(last) };
  }, []);
  const events = useEvents(householdId, range.from, range.to);
  const feedback = useFeedback(householdId);

  const run = async () => {
    if (!householdId || !people.length) return;
    if (!recipes.length) {
      toast.error("Lily's recipe book is still loading — one moment.");
      return;
    }
    setBusy(true);
    try {
      const rules = planRules(events.data ?? [], SLOTS);
      const liked = feedbackSplit(feedback.data ?? []);
      const result = await planMonth.mutateAsync({
        householdId,
        people,
        recipes,
        favouriteRecipeIds: (favorites.data ?? []).map((f) => f.recipe_id),
        pantry: pantry.data ?? [],
        seed: reshuffle ? Math.floor(Math.random() * 97) + 1 : 0,
        avoidRecipeIds: liked.never,
        lovedRecipeIds: liked.loved,
        skip: rules.skip,
        quick: rules.quick,
        guests: rules.guests,
      });
      const extras: string[] = [];
      if (rules.skip.length) extras.push("your days out left free");
      if (Object.keys(rules.guests).length) extras.push("extra plates for your guests");
      toast.success(
        `Four weeks planned — ${result.meals} meals${extras.length ? `, ${extras.join(" and ")}` : ""} 🌼`,
      );
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
