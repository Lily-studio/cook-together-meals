import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useGrocery, useGroceryMutations, usePlan } from "@/lib/db";
import { isoDate, startOfWeek, weekDates } from "@/lib/nutrition";
import { GROCERY_ORDER, buildGroceryList } from "@/lib/planner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/grocery")({
  component: GroceryPage,
});

function GroceryPage() {
  const { householdId } = useApp();
  const start = useMemo(() => startOfWeek(new Date()), []);
  const dates = useMemo(() => weekDates(start), [start]);
  const weekStart = isoDate(start);
  const plan = usePlan(householdId, isoDate(dates[0]!), isoDate(dates[6]!));
  const items = useGrocery(householdId, weekStart);
  const { add, toggle, remove, clear } = useGroceryMutations(householdId, weekStart);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  const list = items.data ?? [];
  const grouped = GROCERY_ORDER.map((cat) => ({
    cat,
    rows: list.filter((i) => i.category === cat),
  })).filter((g) => g.rows.length);

  const rebuild = async () => {
    setBusy(true);
    try {
      await clear.mutateAsync();
      const built = buildGroceryList(plan.data ?? []);
      if (built.length) await add.mutateAsync(built);
      toast.success("Your list is ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't build the list");
    } finally {
      setBusy(false);
    }
  };

  const done = list.filter((i) => i.checked).length;

  return (
    <AppShell
      title="Grocery list"
      subtitle={`Week of ${start.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`}
      right={
        <Button size="sm" onClick={rebuild} disabled={busy} className="h-9 rounded-full px-3 text-[12px]">
          <RefreshCw className="size-3.5" /> {busy ? "…" : "Rebuild"}
        </Button>
      }
    >
      {list.length === 0 ? (
        <>
          <LilySays>Tap rebuild and I'll turn this week's meals into one tidy shopping list.</LilySays>
          <Card className="mt-4">
            <p className="text-[13px] text-muted-foreground">
              Your list is empty. It builds itself from the week plan, sorted by aisle.
            </p>
          </Card>
        </>
      ) : (
        <>
          <LilySays>
            {done} of {list.length} ticked off. Everything is scaled to your two portions.
          </LilySays>
          <div className="mt-4 grid gap-4">
            {grouped.map((group) => (
              <div key={group.cat}>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.cat}
                </p>
                <ul className="grid gap-1.5">
                  {group.rows.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={(v) => toggle.mutate({ id: item.id, checked: Boolean(v) })}
                        aria-label={`Tick off ${item.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-[13px] font-semibold", item.checked && "text-muted-foreground line-through")}>
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
    </AppShell>
  );
}
