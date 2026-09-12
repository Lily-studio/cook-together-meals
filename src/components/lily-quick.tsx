import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BatteryLow, Sparkles, Timer, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { Chip } from "@/components/macro";
import { Button } from "@/components/ui/button";
import { useRecipes, useSetPlanEntry, usePrepBatches, type PlanEntry } from "@/lib/db";
import { portionsFor } from "@/lib/planner";
import { SLOT_LABELS } from "@/lib/nutrition";
import {
  RESTAURANT_CRAVINGS,
  TIME_CHOICES,
  easiestMeals,
  mealsInTime,
  restaurantIdeas,
  slotNow,
  totalMinutes,
  type Suggestion,
} from "@/lib/quick";
import { cn } from "@/lib/utils";

type Mode = null | "time" | "tired" | "craving";

/**
 * The calm little helper on the home screen: nothing shouts until someone taps.
 * Every answer here is a real meal she can put straight into today's plan.
 */
export function LilyQuick({ date, entries }: { date: string; entries: PlanEntry[] }) {
  const { householdId, people } = useApp();
  const { data: recipes = [] } = useRecipes();
  const prep = usePrepBatches(householdId);
  const setEntry = useSetPlanEntry();

  const [mode, setMode] = useState<Mode>(null);
  const [minutes, setMinutes] = useState(20);
  const [craving, setCraving] = useState("");
  const slot = useMemo(() => slotNow(), []);

  const suggestions: Suggestion[] = useMemo(() => {
    if (mode === "time") return mealsInTime({ minutes, entries, recipes, slot });
    if (mode === "tired")
      return easiestMeals({ entries, recipes, slot, prep: prep.data ?? [] });
    if (mode === "craving")
      return restaurantIdeas(recipes, craving).map((r) => ({
        recipe: r,
        slot,
        fromPlan: false,
        why: `${totalMinutes(r)} min at home — better than takeaway`,
      }));
    return [];
  }, [mode, minutes, craving, entries, recipes, slot, prep.data]);

  const putInPlan = (s: Suggestion) => {
    if (!householdId) return;
    setEntry.mutate(
      {
        household_id: householdId,
        plan_date: date,
        slot: s.slot,
        recipe_id: s.recipe.id,
        portions: portionsFor(people, s.slot, s.recipe),
      },
      {
        onSuccess: () =>
          toast.success(`${s.recipe.title} is your ${SLOT_LABELS[s.slot]?.toLowerCase() ?? s.slot} 🌼`),
      },
    );
  };

  return (
    <Card className="mt-3">
      <p className="font-display text-[16px] font-semibold">Lily can sort it 🌼</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Short on time, worn out, or craving something? Tell me and I'll fix {SLOT_LABELS[slot]?.toLowerCase() ?? "it"}.
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Chip active={mode === "time"} onClick={() => setMode(mode === "time" ? null : "time")}>
          <Timer className="mr-1 inline size-3.5" /> I only have 20 minutes
        </Chip>
        <Chip active={mode === "tired"} onClick={() => setMode(mode === "tired" ? null : "tired")}>
          <BatteryLow className="mr-1 inline size-3.5" /> I'm exhausted
        </Chip>
        <Chip active={mode === "craving"} onClick={() => setMode(mode === "craving" ? null : "craving")}>
          <Sparkles className="mr-1 inline size-3.5" /> I'm craving…
        </Chip>
      </div>

      {mode === "time" ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {TIME_CHOICES.map((t) => (
            <Chip key={t.minutes} active={minutes === t.minutes} onClick={() => setMinutes(t.minutes)}>
              {t.label}
            </Chip>
          ))}
        </div>
      ) : null}

      {mode === "craving" ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {RESTAURANT_CRAVINGS.map((c) => (
            <Chip key={c.label} active={craving === c.label} onClick={() => setCraving(c.label)}>
              {c.label}
            </Chip>
          ))}
        </div>
      ) : null}

      {mode === "tired" ? (
        <p className="mt-2.5 rounded-2xl bg-butter/45 px-3 py-2 text-[12px]">
          Rough day — that's allowed. Here's the least work for a proper meal.
        </p>
      ) : null}

      {mode && suggestions.length === 0 ? (
        <p className="mt-2.5 text-[12px] text-muted-foreground">
          {mode === "craving" && !craving
            ? "Pick what you fancy and I'll find the homemade version."
            : "Nothing quick enough in my book for that — try a little more time."}
        </p>
      ) : null}

      {suggestions.length ? (
        <ul className="mt-2.5 grid gap-1.5">
          {suggestions.map((s) => (
            <li
              key={`${s.slot}-${s.recipe.id}`}
              className="flex items-center gap-2 rounded-2xl bg-secondary/40 px-2.5 py-2"
            >
              <span aria-hidden>{s.recipe.emoji}</span>
              <span className="min-w-0 flex-1">
                <Link
                  to="/recipes/$slug"
                  params={{ slug: s.recipe.slug }}
                  className="block truncate text-[13px] font-semibold hover:underline"
                >
                  {s.recipe.title}
                </Link>
                <span className="block truncate text-[11px] text-muted-foreground">{s.why}</span>
              </span>
              {s.fromPlan ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full bg-olive/15 px-2 py-1 text-[10px] font-semibold text-olive",
                  )}
                >
                  in your plan
                </span>
              ) : (
                <Button size="sm" className="h-8 shrink-0 rounded-full" onClick={() => putInPlan(s)}>
                  <UtensilsCrossed className="mr-1 size-3.5" /> Make this
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
