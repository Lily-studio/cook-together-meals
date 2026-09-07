import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Snowflake, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { usePlan, usePrepBatches, usePrepMutations } from "@/lib/db";
import { SLOT_LABELS, isoDate, startOfWeek, weekDates } from "@/lib/nutrition";

export const Route = createFileRoute("/_authenticated/prep")({
  head: () => ({
    meta: [
      { title: "Prep ahead — Cook with Lily" },
      {
        name: "description",
        content:
          "Lily reads the week ahead and tells you exactly what is worth cooking on Sunday, then keeps track of what's still in the fridge.",
      },
      { property: "og:title", content: "Prep ahead — Cook with Lily" },
      { property: "og:description", content: "Cook once on Sunday, eat well all week." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Prep,
});

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function Prep() {
  const { householdId, people } = useApp();
  const start = useMemo(() => startOfWeek(new Date()), []);
  const dates = useMemo(() => weekDates(start), [start]);
  const plan = usePlan(householdId, isoDate(dates[0]!), isoDate(dates[6]!));
  const batches = usePrepBatches(householdId);
  const { add, takePortion, remove } = usePrepMutations(householdId);
  const entries = plan.data ?? [];
  const heads = Math.max(1, people.length);

  const suggestions = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; slug: string; emoji: string; times: number; prepFriendly: boolean; slots: string[] }
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
          id: r.id,
          title: r.title,
          slug: r.slug,
          emoji: r.emoji,
          times: 1,
          prepFriendly: r.prep_friendly,
          slots: [e.slot],
        });
      }
    });
    return [...map.values()]
      .filter((b) => b.prepFriendly || b.times > 1)
      .sort((a, b) => b.times - a.times || Number(b.prepFriendly) - Number(a.prepFriendly));
  }, [entries]);

  const stored = (batches.data ?? []).filter((b) => b.portions_left > 0);
  const finished = (batches.data ?? []).filter((b) => b.portions_left <= 0);

  const markPrepared = async (s: { id: string; title: string; times: number }) => {
    try {
      await add.mutateAsync({
        recipe_id: s.id,
        title: s.title,
        portions_total: Math.max(2, s.times * heads),
        best_before: isoDate(addDays(new Date(), 4)),
        note: "Prepared ahead",
      });
      toast.success(`${s.title} is in the fridge — I'll remind you 🌼`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that");
    }
  };

  return (
    <AppShell
      title="Prep ahead"
      subtitle="Cook once, eat well all week"
      mood="relaxed"
      aside={
        <Card>
          <p className="font-display text-[16px] font-semibold">Lily's Sunday rhythm</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Chop the vegetables, cook the two dishes that repeat, boil a few eggs, and roll a tin of date
            bites. Everything below keeps 3–4 days covered in the fridge.
          </p>
        </Card>
      }
    >
      <LilySays mood="relaxed">
        {suggestions.length
          ? "Here's what's genuinely worth cooking ahead this week. Tap “I prepared this” and I'll keep count of the portions left."
          : "Once your week is planned I'll tell you exactly what to cook on Sunday."}
      </LilySays>

      {stored.length ? (
        <>
          <SectionTitle>In the fridge right now</SectionTitle>
          <div className="grid gap-2">
            {stored.map((b) => (
              <Card key={b.id} className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-olive/15 text-olive">
                  <Snowflake className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[16px] font-semibold">{b.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {b.portions_left} of {b.portions_total} portions left · prepared{" "}
                    {new Date(b.prepared_on).toLocaleDateString("en-GB", { weekday: "long" })}
                    {b.best_before
                      ? ` · best before ${new Date(b.best_before).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}`
                      : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 rounded-full text-[12px]"
                  onClick={() => takePortion.mutate({ id: b.id, left: b.portions_left })}
                >
                  Take one
                </Button>
                <button
                  onClick={() => remove.mutate(b.id)}
                  aria-label={`Remove ${b.title}`}
                  className="text-muted-foreground hover:text-terracotta"
                >
                  <Trash2 className="size-4" />
                </button>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {suggestions.length ? (
        <>
          <SectionTitle>Worth preparing this week</SectionTitle>
          <div className="grid gap-3">
            {suggestions.map((s) => (
              <Card key={s.slug} className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  {s.emoji}
                </span>
                <Link to="/recipes/$slug" params={{ slug: s.slug }} className="min-w-0 flex-1">
                  <p className="truncate font-display text-[16px] font-semibold">{s.title}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {s.times > 1 ? `${s.times}× this week · ` : "Keeps well · "}
                    {s.slots.map((x) => SLOT_LABELS[x]).join(", ")}
                  </p>
                </Link>
                <Button
                  size="sm"
                  className="h-9 shrink-0 rounded-full text-[12px]"
                  onClick={() => markPrepared(s)}
                >
                  I prepared this
                </Button>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="mt-4">
          <p className="text-[13px] text-muted-foreground">
            Lily couldn't find anything worth batching yet. Once your month is planned, this fills itself.
          </p>
        </Card>
      )}

      {finished.length ? (
        <>
          <SectionTitle>Finished</SectionTitle>
          <div className="grid gap-1.5">
            {finished.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-2xl bg-card/70 p-3 text-muted-foreground shadow-soft"
              >
                <p className="min-w-0 flex-1 truncate text-[13px] line-through">{b.title}</p>
                <button onClick={() => remove.mutate(b.id)} aria-label={`Remove ${b.title}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
