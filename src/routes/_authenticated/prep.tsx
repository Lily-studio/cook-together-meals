import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { usePlan } from "@/lib/db";
import { SLOT_LABELS, isoDate, startOfWeek, weekDates } from "@/lib/nutrition";

export const Route = createFileRoute("/_authenticated/prep")({
  component: Prep,
});

function Prep() {
  const { householdId } = useApp();
  const start = useMemo(() => startOfWeek(new Date()), []);
  const dates = useMemo(() => weekDates(start), [start]);
  const plan = usePlan(householdId, isoDate(dates[0]!), isoDate(dates[6]!));
  const entries = plan.data ?? [];

  const batches = useMemo(() => {
    const map = new Map<
      string,
      { title: string; slug: string; emoji: string; times: number; prepFriendly: boolean; slots: string[] }
    >();
    entries.forEach((e) => {
      const r = e.recipes;
      if (!r) return;
      const cur = map.get(r.id);
      if (cur) {
        cur.times += 1;
        if (!cur.slots.includes(e.slot)) cur.slots.push(e.slot);
      } else {
        map.set(r.id, {
          title: r.title,
          slug: r.slug,
          emoji: r.emoji,
          times: 1,
          prepFriendly: r.prep_friendly,
          slots: [e.slot],
        });
      }
    });
    return [...map.values()].sort((a, b) => b.times - a.times);
  }, [entries]);

  const doubleUp = batches.filter((b) => b.times > 1);
  const friendly = batches.filter((b) => b.prepFriendly && b.times === 1);

  return (
    <AppShell title="Meal prep" subtitle="Cook once, eat twice">
      <LilySays>
        {doubleUp.length
          ? "These dishes appear more than once this week — cook a bigger pot and you're done."
          : "Add a few repeats to your week and I'll show you what to batch cook."}
      </LilySays>

      {doubleUp.length ? (
        <>
          <SectionTitle>Batch cook these</SectionTitle>
          <div className="grid gap-3">
            {doubleUp.map((b) => (
              <Card key={b.slug} className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  {b.emoji}
                </span>
                <Link to="/recipes/$slug" params={{ slug: b.slug }} className="min-w-0 flex-1">
                  <p className="truncate font-display text-[16px] font-semibold">{b.title}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {b.times}× this week · {b.slots.map((s) => SLOT_LABELS[s]).join(", ")}
                  </p>
                </Link>
                <span className="rounded-full bg-olive/15 px-2.5 py-1 text-[11px] font-semibold text-olive">
                  ×{b.times} pot
                </span>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {friendly.length ? (
        <>
          <SectionTitle>Keeps well in the fridge</SectionTitle>
          <div className="grid gap-2">
            {friendly.map((b) => (
              <Link
                key={b.slug}
                to="/recipes/$slug"
                params={{ slug: b.slug }}
                className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft"
              >
                <span className="text-2xl" aria-hidden>
                  {b.emoji}
                </span>
                <p className="truncate text-[13px] font-semibold">{b.title}</p>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <Card className="mt-6">
        <p className="text-[13px] text-muted-foreground">
          Lily's rhythm: chop vegetables on Sunday, cook two big pots, portion them into containers, and
          keep snacks (dates, almonds, yoghurt) ready in a bowl.
        </p>
      </Card>
    </AppShell>
  );
}
