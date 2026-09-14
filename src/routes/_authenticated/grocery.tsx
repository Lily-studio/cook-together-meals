import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PlanMonthButton } from "@/components/plan-month-button";
import { useGrocery, useGroceryMutations, usePlan } from "@/lib/db";
import { sameIngredient, usePantry } from "@/lib/pantry";
import { isoDate, startOfWeek, weekDates } from "@/lib/nutrition";
import { GROCERY_ORDER, buildGroceryList } from "@/lib/planner";
import { shoppingMission } from "@/lib/quick";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/grocery")({
  head: () => ({
    meta: [
      { title: "Groceries — Cook with Lily" },
      {
        name: "description",
        content:
          "One tidy shopping list built from your plan: week by week or the whole month, with duplicate ingredients added up.",
      },
      { property: "og:title", content: "Groceries — Cook with Lily" },
      { property: "og:description", content: "Affordable, local shopping sorted by aisle." },
    ],
  }),
  component: GroceryPage,
});

/** Friendly aisle names for the categories stored on recipes. */
const AISLES: Record<string, string> = {
  Produce: "🥬 Vegetables & fruit",
  Meat: "🍗 Protein",
  Fish: "🐟 Fish",
  Dairy: "🥚 Eggs & dairy",
  Bakery: "🍚 Grains & bread",
  Pantry: "🥫 Pantry & legumes",
  Spices: "🌿 Herbs & spices",
  Other: "🧺 Other",
};

function GroceryPage() {
  const { householdId, people } = useApp();
  const weeks = useMemo(() => {
    const first = startOfWeek(new Date());
    return Array.from({ length: 4 }, (_, i) => {
      const s = new Date(first);
      s.setDate(s.getDate() + i * 7);
      return weekDates(s);
    });
  }, []);
  const monthFrom = isoDate(weeks[0]![0]!);
  const monthTo = isoDate(weeks[3]![6]!);

  const [tab, setTab] = useState<number | "month">(0);
  const weekIndex = tab === "month" ? 0 : tab;
  const weekStart = isoDate(weeks[weekIndex]![0]!);

  const monthPlan = usePlan(householdId, monthFrom, monthTo);
  const items = useGrocery(householdId, weekStart);
  const { add, toggle, remove, clear } = useGroceryMutations(householdId, weekStart);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  const allEntries = monthPlan.data ?? [];
  const entriesForWeek = (i: number) => {
    const from = isoDate(weeks[i]![0]!);
    const to = isoDate(weeks[i]![6]!);
    return allEntries.filter((e) => e.plan_date >= from && e.plan_date <= to);
  };

  const list = items.data ?? [];
  const [shopMode, setShopMode] = useState(false);
  const stockForMission = usePantry(householdId);
  const mission = useMemo(
    () => shoppingMission({ items: list, pantry: stockForMission.data ?? [] }),
    [list, stockForMission.data],
  );
  const grouped = shopMode
    ? mission.groups.map((g) => ({ cat: g.heading, hint: g.hint, rows: g.rows }))
    : GROCERY_ORDER.map((cat) => ({
        cat,
        hint: "",
        rows: list.filter((i) => i.category === cat),
      })).filter((g) => g.rows.length);

  const monthList = useMemo(() => buildGroceryList(allEntries), [allEntries]);
  const stock = usePantry(householdId);

  // Three honest piles: what you already have, the big monthly shop, and the
  // fresh things that are better bought week by week.
  const MONTHLY_AISLES = ["Pantry", "Spices", "Other"];
  const monthPiles = useMemo(() => {
    const inStock = (stock.data ?? []).filter((s) => s.quantity > 0);
    const have: typeof monthList = [];
    const monthly: typeof monthList = [];
    const fresh: typeof monthList = [];
    monthList.forEach((item) => {
      if (inStock.some((s) => sameIngredient(s.name, item.name))) have.push(item);
      else if (MONTHLY_AISLES.includes(item.category)) monthly.push(item);
      else fresh.push(item);
    });
    return { have, monthly, fresh };
  }, [monthList, stock.data]);

  const rebuild = async () => {
    setBusy(true);
    try {
      await clear.mutateAsync();
      const built = buildGroceryList(entriesForWeek(weekIndex));
      if (built.length) await add.mutateAsync(built);
      toast.success("Your list is ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't build the list");
    } finally {
      setBusy(false);
    }
  };

  // Older lists were saved with "400 g × 2" style amounts. Quietly rebuild them
  // once so the shop always shows one honest total.
  const healed = useRef<Record<number, boolean>>({});
  useEffect(() => {
    if (busy || healed.current[weekIndex]) return;
    const legacy = list.some((i) => !i.manual && i.amount.includes("×"));
    if (!legacy) return;
    healed.current[weekIndex] = true;
    void rebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, busy, weekIndex]);

  const done = list.filter((i) => i.checked).length;
  const monthLabel = weeks[0]![0]!.toLocaleDateString("en-GB", { month: "long" });

  return (
    <AppShell
      title="Groceries"
      subtitle={`${monthLabel}, week by week`}
      mood="shopping"
      right={
        tab === "month" ? (
          <PlanMonthButton size="sm" label="Replan month" reshuffle className="h-9 px-3 text-[12px]" />
        ) : (
          <Button size="sm" onClick={rebuild} disabled={busy} className="h-9 rounded-full px-3 text-[12px]">
            <RefreshCw className="size-3.5" /> {busy ? "…" : "Rebuild"}
          </Button>
        )
      }
    >
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {weeks.map((w, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors",
              tab === i ? "bg-caramel text-caramel-foreground" : "bg-card text-muted-foreground shadow-soft",
            )}
          >
            Week {i + 1}
            <span className="ml-1 font-normal opacity-70">
              {w[0]!.getDate()}–{w[6]!.getDate()}
            </span>
          </button>
        ))}
        <button
          onClick={() => setTab("month")}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors",
            tab === "month" ? "bg-caramel text-caramel-foreground" : "bg-card text-muted-foreground shadow-soft",
          )}
        >
          Whole month
        </button>
      </div>

      {tab === "month" ? (
        <>
          <LilySays mood="shopping" className="mt-4">
            {monthList.length
              ? `Everything for ${monthLabel} added up — ${monthList.length} things, duplicates combined so you buy once.`
              : "Tap “Replan month” and I'll fill four weeks, then add all the shopping up for you."}
          </LilySays>
          <div className="mt-4 grid gap-5">
            {(
              [
                ["🛒 Buy once for the whole month", monthPiles.monthly, "Dry things that keep — one big shop."],
                ["🥬 Buy fresh, week by week", monthPiles.fresh, "Better bought closer to when you cook it."],
                ["✅ Already in your kitchen", monthPiles.have, "You told me you have these, so don't buy them again."],
              ] as const
            )
              .filter(([, rows]) => rows.length)
              .map(([heading, rows, hint]) => (
                <div key={heading}>
                  <p className="font-display text-[15px] font-semibold">{heading}</p>
                  <p className="mb-2 text-[12px] text-muted-foreground">{hint}</p>
                  <ul className="grid gap-1.5">
                    {rows.map((item) => (
                      <li
                        key={item.name}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl p-3 shadow-soft",
                          heading.startsWith("✅") ? "bg-olive/10" : "bg-card",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {AISLES[item.category] ?? item.category}
                        </span>
                        <span className="shrink-0 text-[12px] font-semibold tabular-nums">{item.amount}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </>
      ) : list.length === 0 ? (
        <>
          <LilySays mood="shopping" className="mt-4">
            Tap rebuild and I'll turn week {weekIndex + 1}'s meals into one tidy shopping list.
          </LilySays>
          <Card className="mt-4">
            <p className="text-[13px] text-muted-foreground">
              This week's list is empty. It builds itself from the plan, sorted by aisle.
            </p>
          </Card>
        </>
      ) : (
        <>
          <LilySays mood="shopping" className="mt-4">
            {shopMode
              ? `${mission.toBuy} things to actually buy — the rest is already at home or can wait.`
              : `${done} of ${list.length} ticked off. Everything is scaled to your two portions.`}
          </LilySays>
          <button
            onClick={() => setShopMode((v) => !v)}
            className={cn(
              "mt-3 w-full rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors",
              shopMode ? "bg-caramel text-caramel-foreground" : "bg-card text-caramel shadow-soft",
            )}
          >
            {shopMode ? "Back to aisles" : "🛍️ Shopping mode — sort it for the shop"}
          </button>
          <div className="mt-4 grid gap-4">
            {grouped.map((group) => (
              <div key={group.cat}>
                <p className="mb-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {AISLES[group.cat] ?? group.cat}
                </p>
                {group.hint ? (
                  <p className="mb-1.5 text-[11px] text-muted-foreground">{group.hint}</p>
                ) : null}
                <ul className="grid gap-1.5">
                  {group.rows.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={(v) => toggle.mutate({ id: item.id, checked: Boolean(v) })}
                        aria-label={`Tick off ${item.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-[13px] font-semibold",
                            item.checked && "text-muted-foreground line-through",
                          )}
                        >
                          {item.name}
                        </p>
                        {item.amount ? (
                          <p className="text-[11px] text-muted-foreground">{item.amount}</p>
                        ) : null}
                      </div>
                      <button
                        onClick={() => remove.mutate(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="text-muted-foreground hover:text-terracotta"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "month" ? null : (
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!manual.trim()) return;
            add.mutate([{ name: manual.trim(), amount: "", category: "Other", manual: true }]);
            setManual("");
          }}
        >
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Add something else…"
            className="rounded-full"
          />
          <Button type="submit" className="rounded-full px-5">
            Add
          </Button>
        </form>
      )}
    </AppShell>
  );
}
