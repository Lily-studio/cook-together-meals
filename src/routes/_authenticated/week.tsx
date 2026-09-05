import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { MealCard } from "@/components/meal-card";
import { Button } from "@/components/ui/button";
import { useDeletePlanEntry, usePlan, useRecipes, useSetPlanEntry } from "@/lib/db";
import { SLOTS, dayLabel, isoDate, startOfWeek, weekDates } from "@/lib/nutrition";
import { buildWeekPlan } from "@/lib/planner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/week")({
  component: WeekPage,
});

function WeekPage() {
  const { people, householdId } = useApp();
  const start = useMemo(() => startOfWeek(new Date()), []);
  const dates = useMemo(() => weekDates(start), [start]);
  const from = isoDate(dates[0]!);
  const to = isoDate(dates[6]!);
  const plan = usePlan(householdId, from, to);
  const { data: recipes = [] } = useRecipes();
  const setEntry = useSetPlanEntry();
  const deleteEntry = useDeletePlanEntry();
  const [active, setActive] = useState(() => isoDate(new Date()));
  const [busy, setBusy] = useState(false);

  const entries = plan.data ?? [];
  const dayEntries = entries.filter((e) => e.plan_date === active);

  const regenerate = async () => {
    if (!householdId || !recipes.length) return;
    setBusy(true);
    try {
      for (const entry of entries) await deleteEntry.mutateAsync(entry.id);
      const fresh = buildWeekPlan(dates, recipes, people, Math.floor(Math.random() * 5) + 1);
      for (const entry of fresh) {
        await setEntry.mutateAsync({
          household_id: householdId,
          plan_date: entry.plan_date,
          slot: entry.slot,
          recipe_id: entry.recipe_id,
          portions: entry.portions,
        });
      }
      toast.success("A fresh week, cooked up by Lily");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't rebuild the week");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Together this week"
      subtitle="Cook once, serve two portions"
      right={
        <Button
          size="sm"
          onClick={regenerate}
          disabled={busy}
          className="h-9 rounded-full px-3 text-[12px]"
        >
          <Sparkles className="size-3.5" /> {busy ? "Planning…" : "Refill"}
        </Button>
      }
    >
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {dates.map((d) => {
          const iso = isoDate(d);
          const count = entries.filter((e) => e.plan_date === iso && e.recipes).length;
          return (
            <button
              key={iso}
              onClick={() => setActive(iso)}
              className={cn(
                "flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-2xl py-2.5 transition-colors",
                active === iso ? "bg-caramel text-caramel-foreground" : "bg-card text-muted-foreground shadow-soft",
              )}
            >
              <span className="text-[11px] font-semibold uppercase">{dayLabel(d)}</span>
              <span className="font-display text-lg leading-none font-semibold">{d.getDate()}</span>
              <span className="text-[10px]">{count}/5</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3">
        {SLOTS.map((slot) => (
          <MealCard key={slot} date={active} slot={slot} entry={dayEntries.find((e) => e.slot === slot)} />
        ))}
      </div>

      <Card className="mt-5">
        <p className="text-[13px] text-muted-foreground">
          Portions are set from each person's calorie goal. Nudge them with the − and + buttons and Lily
          keeps the numbers honest.
        </p>
      </Card>
    </AppShell>
  );
}
