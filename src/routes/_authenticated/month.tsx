import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { PlanMonthButton } from "@/components/plan-month-button";
import { usePlan } from "@/lib/db";
import { isoDate, startOfWeek, dayLabel } from "@/lib/nutrition";
import { monthDates } from "@/lib/month-plan";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/month")({
  head: () => ({
    meta: [
      { title: "My month — Cook with Lily" },
      {
        name: "description",
        content:
          "Four weeks of meals Lily already planned for you: tap any day to see breakfast, snacks, lunch and dinner with exact portions.",
      },
      { property: "og:title", content: "My month — Cook with Lily" },
      {
        property: "og:description",
        content: "Lily plans the month. You just cook. Four weeks, two goals, one kitchen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonthPage,
});

function MonthPage() {
  const { householdId } = useApp();
  const dates = useMemo(() => monthDates(startOfWeek(new Date())), []);
  const plan = usePlan(householdId, isoDate(dates[0]!), isoDate(dates[27]!));
  const entries = plan.data ?? [];
  const todayIso = isoDate(new Date());

  const monthLabel = dates[0]!.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const weeks = [0, 1, 2, 3].map((w) => dates.slice(w * 7, w * 7 + 7));
  const plannedDays = new Set(entries.map((e) => e.plan_date)).size;

  return (
    <AppShell
      title="My month"
      subtitle={monthLabel}
      mood="thinking"
      right={<PlanMonthButton size="sm" label={plannedDays ? "Replan" : "Plan"} reshuffle={plannedDays > 0} className="h-9 px-3 text-[12px]" />}
      aside={
        <Card>
          <p className="font-display text-[16px] font-semibold">How to read this</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Each day shows its dinner. Tap a day to open the full five meals with exact grams for each of
            you. Nothing here needs building — it is already planned.
          </p>
        </Card>
      }
    >
      <LilySays mood={plannedDays ? "excited" : "thinking"}>
        {plannedDays
          ? `${plannedDays} days planned — four weeks of dinners, lunches and homemade snacks, already sorted.`
          : "Your month is still empty. One tap and I'll plan all four weeks, portions and shopping included."}
      </LilySays>

      {plannedDays === 0 ? (
        <Card className="mt-4 text-center">
          <PlanMonthButton className="h-11 w-full text-[15px]" />
        </Card>
      ) : null}

      {weeks.map((week, wi) => (
        <div key={wi}>
          <SectionTitle>
            Week {wi + 1} · {week[0]!.getDate()}–{week[6]!.getDate()}{" "}
            {week[6]!.toLocaleDateString("en-GB", { month: "short" })}
          </SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {week.map((d) => {
              const iso = isoDate(d);
              const day = entries.filter((e) => e.plan_date === iso);
              const dinner = day.find((e) => e.slot === "dinner")?.recipes;
              return (
                <Link
                  key={iso}
                  to="/today"
                  search={{ date: iso }}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft transition-colors hover:bg-butter/30",
                    iso === todayIso && "ring-2 ring-caramel",
                  )}
                >
                  <div className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-butter/50 py-1.5">
                    <span className="text-[10px] font-semibold uppercase text-caramel">{dayLabel(d)}</span>
                    <span className="font-display text-base leading-none font-semibold">{d.getDate()}</span>
                  </div>
                  <span className="text-2xl" aria-hidden>
                    {dinner?.emoji ?? "🌼"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {dinner?.title ?? "Not planned yet"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {day.length ? `${day.length} meals planned` : "Tap plan above"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </AppShell>
  );
}
