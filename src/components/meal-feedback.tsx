/**
 * "What actually worked?"
 *
 * Three taps, nothing more. A "never again" takes the dish out of every future
 * plan; a "loved it" makes Lily lean on it and on flavours like it.
 */

import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { RATINGS, useFeedback, useRateMeal } from "@/lib/household";
import { cn } from "@/lib/utils";

export function MealFeedbackRow({
  recipeId,
  date,
  slot,
  className,
}: {
  recipeId: string;
  date: string;
  slot: string;
  className?: string;
}) {
  const { me, householdId } = useApp();
  const feedback = useFeedback(householdId);
  const rate = useRateMeal();

  const mine = (feedback.data ?? []).find(
    (f) =>
      f.recipe_id === recipeId && f.plan_date === date && f.slot === slot && f.profile_id === me?.id,
  );

  const choose = (rating: string) => {
    if (!me || !householdId) return;
    rate.mutate(
      {
        household_id: householdId,
        profile_id: me.id,
        recipe_id: recipeId,
        plan_date: date,
        slot,
        rating,
      },
      {
        onSuccess: () =>
          toast.success(
            rating === "never"
              ? "Noted — I won't plan that one again."
              : rating === "loved"
                ? "Lovely! More meals like that one."
                : "Thanks — good to know.",
          ),
      },
    );
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="mr-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        How was it?
      </span>
      {RATINGS.map((r) => (
        <button
          key={r.value}
          onClick={() => choose(r.value)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
            mine?.rating === r.value
              ? "bg-caramel/20 ring-1 ring-caramel/40"
              : "bg-secondary/60 hover:bg-secondary",
          )}
        >
          {r.emoji} {r.label}
        </button>
      ))}
    </div>
  );
}
