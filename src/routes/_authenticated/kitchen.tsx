import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, Package, ShoppingBasket, Snowflake } from "lucide-react";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { thisWeekStart, useGrocery, usePlan, usePrepBatches } from "@/lib/db";
import { lowStock, usePantry, type PantryItem } from "@/lib/pantry";
import { EVENT_KINDS, eventLabel, useEvents } from "@/lib/household";
import { defrostList } from "@/lib/quick";
import { formatStock } from "@/lib/portions";
import { SLOTS, SLOT_LABELS, isoDate, prettyDate } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kitchen")({
  head: () => ({
    meta: [
      { title: "My kitchen today — Cook with Lily" },
      {
        name: "description",
        content:
          "Everything you need to know about the food in your house today: what's at home, what to use soon, what's already cooked, and what's coming up.",
      },
      { property: "og:title", content: "My kitchen today — Cook with Lily" },
      {
        property: "og:description",
        content: "One calm overview of your household's food — stock, leftovers, expiry dates and tomorrow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KitchenDashboard,
});

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return date;
}

function daysUntil(iso: string | null | undefined, today: string) {
  if (!iso) return null;
  const a = new Date(`${today}T00:00:00`);
  const b = new Date(`${iso}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function Row({
  title,
  detail,
  tone = "plain",
}: {
  title: string;
  detail: string;
  tone?: "plain" | "warn" | "good";
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-2xl px-3 py-2",
        tone === "warn" ? "bg-terracotta/12" : tone === "good" ? "bg-olive/12" : "bg-secondary/50",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</span>
      <span className="shrink-0 text-[12px] text-muted-foreground">{detail}</span>
    </li>
  );
}

function KitchenDashboard() {
  const { householdId, people } = useApp();
  const today = useMemo(() => isoDate(new Date()), []);
  const tomorrow = useMemo(() => isoDate(addDays(today, 1)), [today]);

  const pantry = usePantry(householdId);
  const prep = usePrepBatches(householdId);
  const plan = usePlan(householdId, today, tomorrow);
  const grocery = useGrocery(householdId, thisWeekStart());
  const events = useEvents(householdId, today, isoDate(addDays(today, 7)));

  const stock = pantry.data ?? [];
  const batches = (prep.data ?? []).filter((b) => b.portions_left > 0);
  const entries = plan.data ?? [];
  const tomorrowEntries = entries.filter((e) => e.plan_date === tomorrow);
  const todayEntries = entries.filter((e) => e.plan_date === today);

  const useSoon = stock
    .map((item) => ({ item, days: daysUntil(item.expires_on, today) }))
    .filter((x) => (x.days !== null && x.days <= 4) || !!x.item.opened_on)
    .sort((a, b) => (a.days ?? 99) - (b.days ?? 99));
  const expired = useSoon.filter((x) => x.days !== null && x.days < 0);
  const low = lowStock(stock);
  const leftToBuy = (grocery.data ?? []).filter((i) => !i.checked);
  const defrost = defrostList(tomorrowEntries, people.length || 2);
  const upcomingEvents = events.data ?? [];

  const atHome = [...stock]
    .filter((i: PantryItem) => i.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const attention: { text: string; to: "/pantry" | "/grocery" | "/household"; label: string }[] = [];
  if (expired.length)
    attention.push({
      text: `${expired.length} thing${expired.length === 1 ? "" : "s"} past its date — ${expired
        .map((x) => x.item.name)
        .slice(0, 3)
        .join(", ")}.`,
      to: "/pantry",
      label: "Sort my stock",
    });
  if (low.length)
    attention.push({
      text: `Running low on ${low.map((i) => i.name).slice(0, 3).join(", ")}${low.length > 3 ? ` and ${low.length - 3} more` : ""}.`,
      to: "/grocery",
      label: "Add to my list",
    });
  if (defrost.length)
    attention.push({
      text: `Take out of the freezer tonight: ${defrost.map((d) => `${d.amount} ${d.name.toLowerCase()}`).join(", ")}.`,
      to: "/pantry",
      label: "My stock",
    });
  if (leftToBuy.length)
    attention.push({
      text: `${leftToBuy.length} item${leftToBuy.length === 1 ? "" : "s"} still to buy this week.`,
      to: "/grocery",
      label: "Open my list",
    });

  return (
    <AppShell
      title="My kitchen today"
      subtitle={prettyDate(new Date())}
      mood="thinking"
      right={
        <Link
          to="/household"
          className="flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-[12px] font-semibold text-caramel shadow-soft"
        >
          My household
        </Link>
      }
    >
      <LilySays mood="thinking">
        Here's everything worth knowing about the food in your house today — nothing hiding at the back of
        the fridge.
      </LilySays>

      {attention.length ? (
        <>
          <SectionTitle>Worth a look</SectionTitle>
          <div className="grid gap-2">
            {attention.map((a) => (
              <Card key={a.text} className="flex items-center gap-3 bg-butter/45">
                <AlertTriangle className="size-4 shrink-0 text-caramel" />
                <p className="min-w-0 flex-1 text-[13px]">{a.text}</p>
                <Link
                  to={a.to}
                  className="shrink-0 text-[12px] font-semibold text-caramel hover:underline"
                >
                  {a.label}
                </Link>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <SectionTitle>At home</SectionTitle>
      <Card className="grid gap-2">
        {atHome.length ? (
          <ul className="grid gap-2">
            {atHome.map((i) => (
              <Row key={i.id} title={i.name} detail={formatStock(i.quantity, i.unit)} />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Your stock list is empty — add what's in your cupboards and I'll plan around it.
          </p>
        )}
        <Link
          to="/pantry"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-caramel hover:underline"
        >
          <Package className="size-3.5" /> See everything in my stock <ArrowRight className="size-3" />
        </Link>
      </Card>

      <SectionTitle>Use soon</SectionTitle>
      <Card>
        {useSoon.length ? (
          <ul className="grid gap-2">
            {useSoon.slice(0, 6).map(({ item, days }) => (
              <Row
                key={item.id}
                title={item.name}
                tone={days !== null && days <= 1 ? "warn" : "plain"}
                detail={
                  days === null
                    ? "opened"
                    : days < 0
                      ? "past its date"
                      : days === 0
                        ? "today's the last day"
                        : `${days} day${days === 1 ? "" : "s"} left`
                }
              />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nothing urgent — everything's fresh 🌼</p>
        )}
      </Card>

      <SectionTitle>Already cooked</SectionTitle>
      <Card>
        {batches.length ? (
          <ul className="grid gap-2">
            {batches.map((b) => (
              <Row
                key={b.id}
                tone="good"
                title={b.title}
                detail={`${b.portions_left} portion${b.portions_left === 1 ? "" : "s"} left`}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Nothing prepped in the fridge.{" "}
            <Link to="/prep" className="font-semibold text-caramel hover:underline">
              Cook a batch ahead
            </Link>
            .
          </p>
        )}
      </Card>

      <SectionTitle>Coming up</SectionTitle>
      <Card className="grid gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Still to eat today
        </p>
        <ul className="grid gap-1.5">
          {SLOTS.map((slot) => {
            const e = todayEntries.find((x) => x.slot === slot);
            if (!e?.recipes) return null;
            return (
              <li key={slot} className="flex items-center gap-2 text-[13px]">
                <span aria-hidden>{e.recipes.emoji}</span>
                <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground uppercase">
                  {SLOT_LABELS[slot]}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{e.recipes.title}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Tomorrow
        </p>
        {tomorrowEntries.length ? (
          <ul className="grid gap-1.5">
            {SLOTS.map((slot) => {
              const e = tomorrowEntries.find((x) => x.slot === slot);
              if (!e?.recipes) return null;
              return (
                <li key={slot} className="flex items-center gap-2 text-[13px]">
                  <span aria-hidden>{e.recipes.emoji}</span>
                  <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground uppercase">
                    {SLOT_LABELS[slot]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{e.recipes.title}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Tomorrow isn't planned yet.</p>
        )}
        {defrost.length ? (
          <p className="flex items-start gap-2 rounded-2xl bg-butter/45 px-3 py-2 text-[12px]">
            <Snowflake className="mt-0.5 size-3.5 shrink-0 text-caramel" />
            <span>
              Take out tonight: {defrost.map((d) => `${d.amount} ${d.name.toLowerCase()}`).join(", ")}.
            </span>
          </p>
        ) : null}
        {upcomingEvents.length ? (
          <ul className="grid gap-1.5 border-t border-border/60 pt-2">
            {upcomingEvents.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-[12.5px]">
                <span aria-hidden>{EVENT_KINDS.find((k) => k.value === e.kind)?.emoji ?? "📅"}</span>
                <span className="min-w-0 flex-1 truncate">
                  {eventLabel(e)} — {e.event_date}
                  {e.slot ? ` · ${(SLOT_LABELS[e.slot] ?? e.slot).toLowerCase()}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Link
        to="/grocery"
        className="mt-4 mb-2 flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft transition-colors hover:bg-butter/30"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-butter/50 text-caramel">
          <ShoppingBasket className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] font-semibold">What to buy</span>
          <span className="block text-[12px] text-muted-foreground">
            {leftToBuy.length ? `${leftToBuy.length} items left on this week's list` : "This week's list is done"}
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </AppShell>
  );
}
