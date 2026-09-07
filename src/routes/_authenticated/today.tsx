import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { MessageCircleHeart, MessagesSquare, Trash2 } from "lucide-react";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { accentOf, useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { CalorieRing, MacroBar } from "@/components/macro";
import { MealCard } from "@/components/meal-card";
import { useDeleteLog, useLogs, usePlan } from "@/lib/db";
import { SLOTS, SLOT_LABELS, isoDate, prettyDate } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Cook with Lily" },
      {
        name: "description",
        content:
          "Lily already planned your day: three meals, two snacks, exact portions for each of you, and one tap to log what you ate.",
      },
      { property: "og:title", content: "Today — Cook with Lily" },
      { property: "og:description", content: "Your cosy little kitchen, already planned for the day." },
    ],
  }),
  component: Today,
});

function greeting(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${name} 🌼`;
}

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
    <AppShell
      title={greeting(me?.display_name ?? "there")}
      subtitle={prettyDate(today)}
      mood="welcome"
    >
      <LilySays mood={planned >= 4 ? "excited" : "thinking"}>
        {planned >= 4
          ? "Your day is already planned — open a meal for the exact quantities, and tap the fork once it's eaten."
          : "Let's fill in the gaps — tap a plus on any meal and I'll suggest something."}
      </LilySays>

      <Link
        to="/tell-lily"
        className="mt-4 flex items-center gap-3 rounded-3xl bg-caramel p-4 text-caramel-foreground shadow-lift transition-transform active:scale-[0.99]"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-butter/40">
          <MessageCircleHeart className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] font-semibold">Tell Lily what I ate</span>
          <span className="block text-[12px] opacity-90">
            Type it normally — she'll work out the calories
          </span>
        </span>
      </Link>

      <Link
        to="/talk"
        className="mt-2 flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft transition-colors hover:bg-butter/30"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-butter/50 text-caramel">
          <MessagesSquare className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] font-semibold">Talk to Lily</span>
          <span className="block text-[12px] text-muted-foreground">
            Missing an ingredient? Ask her for a swap
          </span>
        </span>
      </Link>

      {low.length > 0 ? (
        <Card className="mt-3 bg-butter/40">
          <p className="font-display text-[15px] font-semibold">Running low</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {low.map((i) => i.name).slice(0, 4).join(", ")}
            {low.length > 4 ? ` and ${low.length - 4} more` : ""} —{" "}
            <Link to="/pantry" className="font-semibold text-caramel hover:underline">
              top up the pantry
            </Link>
            .
          </p>
        </Card>
      ) : null}

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

      <SectionTitle>Today</SectionTitle>
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
