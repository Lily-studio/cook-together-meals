import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import { useApp, accentOf } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { MealCard } from "@/components/meal-card";
import { Button } from "@/components/ui/button";
import { useDeletePlanEntry, usePlan, useRecipes, useSetPlanEntry } from "@/lib/db";
import { SLOTS, SLOT_SHARE, dayLabel, isoDate, startOfWeek, weekDates } from "@/lib/nutrition";
import { buildWeekPlan } from "@/lib/planner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/week")({
  head: () => ({
    meta: [
      { title: "My week — Cook with Lily" },
      {
        name: "description",
        content:
          "Your whole week planned: 3 meals and 2 snacks a day, one shared recipe with personalised portions for each of you.",
      },
      { property: "og:title", content: "My week — Cook with Lily" },
      {
        property: "og:description",
        content: "One kitchen, one meal, two goals — see your plan, his plan, and the shared version.",
      },
    ],
  }),
  component: WeekPage,
});

function WeekPage() {
  const { people, householdId, me } = useApp();
  const start = useMemo(() => startOfWeek(new Date()), []);
  const dates = useMemo(() => weekDates(start), [start]);
  const from = isoDate(dates[0]!);
  const to = isoDate(dates[6]!);
  const plan = usePlan(householdId, from, to);
  const { data: recipes = [] } = useRecipes();
  const setEntry = useSetPlanEntry();
  const deleteEntry = useDeletePlanEntry();
  const [active, setActive] = useState(() => isoDate(new Date()));
  const [view, setView] = useState<string>("together");
  const [busy, setBusy] = useState(false);

  const entries = plan.data ?? [];
  const dayEntries = entries.filter((e) => e.plan_date === active);
  const partner = people.find((p) => p.id !== me?.id);
  const person = view === "together" ? null : people.find((p) => p.id === view) ?? null;

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

  const tabs = [
    ...people.map((p) => ({ key: p.id, label: p.id === me?.id ? "Your plan" : `${p.display_name}'s plan` })),
    { key: "together", label: "Together" },
  ];

  return (
    <AppShell
      title="My week"
      subtitle="One kitchen. One meal. Two goals."
      mood="thinking"
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

      <div className="mt-4 flex gap-1.5 rounded-full bg-secondary/70 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={cn(
              "flex-1 truncate rounded-full px-2 py-2 text-[12px] font-semibold transition-colors",
              view === t.key ? "bg-card text-caramel shadow-soft" : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {person ? (
        <LilySays mood="cooking" className="mt-4">
          <span className={cn("font-semibold", accentOf(person).text)}>{person.display_name}</span> eats{" "}
          {person.calorie_target} kcal today, split across breakfast, two snacks, lunch and dinner. Tap a meal
          to see the exact grams.
        </LilySays>
      ) : (
        <LilySays mood="excited" className="mt-4">
          You cook one meal. I give {me?.display_name ?? "you"} and {partner?.display_name ?? "your partner"}{" "}
          different quantities of it — open a meal to see both.
        </LilySays>
      )}

      <div className="mt-4 grid gap-3">
        {SLOTS.map((slot) => (
          <MealCard
            key={slot}
            date={active}
            slot={slot}
            entry={dayEntries.find((e) => e.slot === slot)}
            onlyProfileId={person?.id}
          />
        ))}
      </div>

      {person ? (
        <Card className="mt-5">
          <p className="text-[13px] text-muted-foreground">
            Roughly how {person.display_name}'s {person.calorie_target} kcal are spread:{" "}
            {SLOTS.map((s) => Math.round(person.calorie_target * (SLOT_SHARE[s] ?? 0.2))).join(" · ")} kcal.
          </p>
        </Card>
      ) : (
        <Card className="mt-5">
          <p className="text-[13px] text-muted-foreground">
            Portions come from each person's calorie goal. Nudge them with − and + and Lily keeps the numbers
            honest.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
