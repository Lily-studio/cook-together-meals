import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, MessageCircleHeart, MessagesSquare, Trash2 } from "lucide-react";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { accentOf, useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { CalorieRing, MacroBar } from "@/components/macro";
import { MealCard } from "@/components/meal-card";
import { PlanMonthButton } from "@/components/plan-month-button";
import { useDeleteLog, useLogs, usePlan, usePrepBatches, usePrepMutations } from "@/lib/db";
import { lowStock, usePantry } from "@/lib/pantry";
import { SLOTS, SLOT_LABELS, dayLabel, isoDate, prettyDate } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search["date"] === "string" ? (search["date"] as string) : undefined,
  }),
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

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return date;
}

function Today() {
  const { people, householdId, me } = useApp();
  const search = Route.useSearch();
  const todayIso = useMemo(() => isoDate(new Date()), []);
  const [date, setDate] = useState(search.date ?? todayIso);
  const viewed = useMemo(() => addDays(date, 0), [date]);
  const isToday = date === todayIso;
  const strip = useMemo(
    () => Array.from({ length: 10 }, (_, i) => addDays(todayIso, i - 1)),
    [todayIso],
  );
  const plan = usePlan(householdId, date, date);
  const logs = useLogs(householdId, date, date);
  const deleteLog = useDeleteLog();
  const pantry = usePantry(householdId);
  const prep = usePrepBatches(householdId);
  const prepMut = usePrepMutations(householdId);

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
  const plannedIds = entries.map((e) => e.recipe_id);
  const readyFromPrep = (prep.data ?? []).filter(
    (b) => b.portions_left > 0 && b.recipe_id && plannedIds.includes(b.recipe_id),
  );
  const low = lowStock(pantry.data ?? []);

  return (
    <AppShell
      title={isToday ? greeting(me?.display_name ?? "there") : prettyDate(viewed)}
      subtitle={isToday ? prettyDate(viewed) : "Lily already planned this day"}
      mood="welcome"
      right={
        <Link
          to="/month"
          className="flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-[12px] font-semibold text-caramel shadow-soft"
        >
          <CalendarDays className="size-3.5" /> My month
        </Link>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setDate(isoDate(addDays(date, -1)))}
          aria-label="Previous day"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-caramel shadow-soft"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
          {strip.map((d) => {
            const iso = isoDate(d);
            return (
              <button
                key={iso}
                onClick={() => setDate(iso)}
                className={cn(
                  "flex w-12 shrink-0 flex-col items-center rounded-2xl py-2 transition-colors",
                  iso === date
                    ? "bg-caramel text-caramel-foreground"
                    : "bg-card text-muted-foreground shadow-soft",
                )}
              >
                <span className="text-[10px] font-semibold uppercase">
                  {iso === todayIso ? "Today" : dayLabel(d)}
                </span>
                <span className="font-display text-base leading-none font-semibold">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setDate(isoDate(addDays(date, 1)))}
          aria-label="Next day"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-caramel shadow-soft"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <LilySays mood={planned >= 4 ? "excited" : "thinking"}>
        {planned >= 4
          ? "It's all planned — open a meal for the exact quantities, and tap the fork once it's eaten."
          : "I haven't planned this day yet. One tap and I'll fill four whole weeks for you."}
      </LilySays>

      {planned === 0 ? (
        <Card className="mt-4 text-center">
          <p className="font-display text-[17px] font-semibold">Nothing planned here yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            I'll write out four weeks of meals, portions for each of you, and the shopping list.
          </p>
          <PlanMonthButton className="mt-3 h-11 w-full text-[15px]" />
        </Card>
      ) : null}

      {readyFromPrep.length ? (
        <Card className="mt-4 bg-olive/10">
          <p className="text-[13px]">
            <span className="font-semibold text-olive">Already prepared 🌼</span> — {readyFromPrep[0]!.title} is
            in the fridge, {readyFromPrep[0]!.portions_left} portion
            {readyFromPrep[0]!.portions_left === 1 ? "" : "s"} left.{" "}
            <button
              onClick={() =>
                prepMut.takePortion.mutate({
                  id: readyFromPrep[0]!.id,
                  left: readyFromPrep[0]!.portions_left,
                })
              }
              className="font-semibold text-caramel hover:underline"
            >
              Take one portion
            </button>
          </p>
        </Card>
      ) : null}

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

      <SectionTitle>{isToday ? "Today's progress" : "That day's intake"}</SectionTitle>
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

      <SectionTitle>{isToday ? "Today" : dayLabel(viewed) + "'s plan"}</SectionTitle>
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

      <SectionTitle>{isToday ? "Eaten today" : "Logged that day"}</SectionTitle>
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
