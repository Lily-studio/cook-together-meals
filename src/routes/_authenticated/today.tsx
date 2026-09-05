import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { accentOf, useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { CalorieRing, MacroBar } from "@/components/macro";
import { MealCard } from "@/components/meal-card";
import { useDeleteLog, useLogs, usePlan } from "@/lib/db";
import { SLOTS, SLOT_LABELS, isoDate, prettyDate } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  component: Today,
});

function Today() {
  const { people, householdId, me } = useApp();
  const today = useMemo(() => new Date(), []);
  const date = isoDate(today);
  const plan = usePlan(householdId, date, date);
  const logs = useLogs(householdId, date, date);
  const deleteLog = useDeleteLog();

  const entries = plan.data ?? [];
  const dayLogs = logs.data ?? [];

  const totalsFor = (profileId: string) =>
    dayLogs
      .filter((l) => l.profile_id === profileId)
      .reduce(
        (acc, l) => ({
          calories: acc.calories + l.calories,
          protein: acc.protein + l.protein,
          carbs: acc.carbs + l.carbs,
          fat: acc.fat + l.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );

  const planned = entries.filter((e) => e.recipes).length;

  return (
    <AppShell title={`Hi ${me?.display_name ?? "there"}`} subtitle={prettyDate(today)}>
      <LilySays>
        {planned >= 4
          ? "Your day is planned. Tap a fork when someone's eaten it."
          : "Let's fill in the gaps — tap a plus to plan a meal."}
      </LilySays>

      <SectionTitle>Today's progress</SectionTitle>
      <div className="grid gap-3">
        {people.map((p) => {
          const t = totalsFor(p.id);
          const accent = accentOf(p);
          return (
            <Card key={p.id}>
              <div className="flex items-center gap-4">
                <CalorieRing value={t.calories} target={p.calorie_target} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", accent.dot)} />
                    <p className="truncate font-display text-[17px] font-semibold">{p.display_name}</p>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    {Math.max(0, p.calorie_target - t.calories)} kcal left today
                  </p>
                  <div className="mt-2 flex gap-3">
                    <MacroBar label="Protein" value={t.protein} target={p.protein_target} tone="olive" />
                    <MacroBar label="Carbs" value={t.carbs} target={p.carb_target} />
                    <MacroBar label="Fat" value={t.fat} target={p.fat_target} tone="terracotta" />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <SectionTitle>Meals today</SectionTitle>
      <div className="grid gap-3">
        {SLOTS.map((slot) => (
          <MealCard
            key={slot}
            date={date}
            slot={slot}
            entry={entries.find((e) => e.slot === slot)}
            logs={dayLogs}
          />
        ))}
      </div>

      <SectionTitle>Eaten today</SectionTitle>
      {dayLogs.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted-foreground">
            Nothing logged yet.{" "}
            <Link to="/tell-lily" className="font-semibold text-caramel hover:underline">
              Tell Lily what you ate
            </Link>
            .
          </p>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {dayLogs.map((log) => {
            const person = people.find((p) => p.id === log.profile_id);
            return (
              <li key={log.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                <span className={cn("size-2 shrink-0 rounded-full", accentOf(person).dot)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{log.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {person?.display_name ?? "Someone"} · {SLOT_LABELS[log.slot] ?? log.slot} · {log.calories} kcal
                  </p>
                </div>
                <button
                  onClick={() => deleteLog.mutate(log.id)}
                  aria-label="Delete this log"
                  className="text-muted-foreground hover:text-terracotta"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
