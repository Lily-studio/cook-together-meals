import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { thisWeekStart, useGroceryMutations, useRecipes, useSetPlanEntry } from "@/lib/db";
import { cookFromFridge } from "@/lib/lily-brain";
import { isoDate } from "@/lib/nutrition";
import { portionsFor } from "@/lib/planner";
import { formatStock } from "@/lib/portions";
import { lowStock, usePantry, usePantryMutations, type PantryItem } from "@/lib/pantry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pantry")({
  head: () => ({
    meta: [
      { title: "My Pantry · Cook with Lily" },
      {
        name: "description",
        content:
          "Tell Lily what you already have at home. She takes it off your grocery list and reminds you when something runs low.",
      },
      { property: "og:title", content: "My Pantry · Cook with Lily" },
      {
        property: "og:description",
        content: "Track what's in your kitchen — Lily deducts what you cook and reminds you to restock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PantryPage,
});

const UNITS = ["g", "ml", "pc"] as const;

function PantryPage() {
  const { householdId, people } = useApp();
  const { data: items = [], isLoading } = usePantry(householdId);
  const { add, update, remove } = usePantryMutations(householdId);
  const grocery = useGroceryMutations(householdId, thisWeekStart());
  const { data: recipes = [] } = useRecipes();
  const setEntry = useSetPlanEntry();
  const fridgeIdeas = useMemo(() => cookFromFridge(recipes, items), [recipes, items]);

  const cookTonight = (recipeId: string, title: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe || !householdId) return;
    setEntry.mutate(
      {
        household_id: householdId,
        plan_date: isoDate(new Date()),
        slot: "dinner",
        recipe_id: recipe.id,
        portions: portionsFor(people, "dinner", recipe),
      },
      { onSuccess: () => toast.success(`${title} is tonight's dinner 🌼`) },
    );
  };

  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("g");

  const running = useMemo(() => lowStock(items), [items]);

  const step = (item: PantryItem, dir: 1 | -1) => {
    const bump = item.unit === "pc" ? 1 : 100;
    update.mutate({
      id: item.id,
      values: { quantity: Math.max(0, item.quantity + bump * dir) },
    });
  };

  const restock = (item: PantryItem) => {
    grocery.add.mutate(
      [
        {
          name: item.name,
          amount: formatStock(Math.max(item.low_threshold * 2, item.unit === "pc" ? 6 : 500), item.unit),
          category: item.category,
          manual: true,
        },
      ],
      { onSuccess: () => toast.success(`${item.name} added to your grocery list`) },
    );
  };

  const submit = () => {
    const quantity = Number(qty.replace(",", "."));
    if (!name.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Add a name and a quantity");
      return;
    }
    add.mutate(
      { name, quantity, unit },
      {
        onSuccess: () => {
          toast.success(`${name.trim()} is in your pantry`);
          setName("");
          setQty("");
        },
      },
    );
  };

  return (
    <AppShell
      title="My Pantry"
      subtitle="What you already have at home"
      mood="shopping"
    >
      <LilySays mood="shopping">
        Tell me what you already have and I'll take it off the shopping list. Every time you cook, I quietly
        subtract what you used — and nudge you when something's running out.
      </LilySays>

      {running.length ? (
        <>
          <SectionTitle>Running low</SectionTitle>
          <Card className="grid gap-2 bg-butter/50">
            {running.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
                  {formatStock(item.quantity, item.unit)} left
                </span>
                <Button size="sm" variant="secondary" className="h-8 rounded-full" onClick={() => restock(item)}>
                  <ShoppingBasket className="mr-1 size-3.5" /> Add
                </Button>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      {fridgeIdeas.length ? (
        <>
          <SectionTitle>What's in my fridge?</SectionTitle>
          <Card className="grid gap-2">
            <p className="text-[13px] text-muted-foreground">
              With what you have right now, I could make these — tap one and it becomes tonight's dinner.
            </p>
            {fridgeIdeas.map((idea) => (
              <div key={idea.recipe.id} className="flex items-center gap-2 rounded-2xl bg-secondary/40 p-2.5">
                <span aria-hidden>{idea.recipe.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{idea.recipe.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {idea.have} of {idea.total} ingredients at home
                    {idea.missing.length ? ` · still need ${idea.missing.join(", ").toLowerCase()}` : " · nothing missing!"}
                  </span>
                </span>
                <Button
                  size="sm"
                  className="h-8 shrink-0 rounded-full"
                  onClick={() => cookTonight(idea.recipe.id, idea.recipe.title)}
                >
                  Cook it
                </Button>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Add something</SectionTitle>
      <Card className="grid gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rice, olive oil, oats…"
          className="rounded-2xl"
        />
        <div className="flex gap-2">
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
            placeholder="Quantity"
            className="rounded-2xl"
          />
          <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-secondary p-1">
            {UNITS.map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  unit === u ? "bg-caramel text-caramel-foreground" : "text-muted-foreground",
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={submit} className="rounded-full">
          <Plus className="mr-1 size-4" /> Add to pantry
        </Button>
      </Card>

      <SectionTitle>In stock</SectionTitle>
      {isLoading ? (
        <Card>
          <p className="text-sm text-muted-foreground">Looking in the cupboards…</p>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Nothing here yet. Add the basics you always keep — rice, oats, flour, olive oil.
          </p>
        </Card>
      ) : (
        <Card className="grid gap-1.5">
          {items.map((item) => (
            <div key={item.id} className="grid gap-1.5 rounded-2xl bg-secondary/40 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
                <span className="flex items-center gap-1 rounded-full bg-card px-1.5 py-0.5">
                  <button
                    onClick={() => step(item, -1)}
                    aria-label={`Less ${item.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-16 text-center text-[11px] font-semibold tabular-nums">
                    {formatStock(item.quantity, item.unit)}
                  </span>
                  <button
                    onClick={() => step(item, 1)}
                    aria-label={`More ${item.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </span>
                <button
                  onClick={() => remove.mutate(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="text-muted-foreground hover:text-terracotta"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <button
                  onClick={() =>
                    update.mutate(
                      {
                        id: item.id,
                        values: { opened_on: item.opened_on ? null : isoDate(new Date()) },
                      },
                      {
                        onSuccess: () =>
                          toast.success(
                            item.opened_on ? `${item.name} marked unopened` : `${item.name} — I'll use it first 🌼`,
                          ),
                      },
                    )
                  }
                  className={cn(
                    "rounded-full px-2 py-1 font-semibold transition-colors",
                    item.opened_on ? "bg-caramel/15 text-caramel" : "bg-card text-muted-foreground",
                  )}
                >
                  {item.opened_on ? `Opened ${item.opened_on}` : "Just opened it"}
                </button>
                <label className="flex items-center gap-1">
                  <span>Best before</span>
                  <input
                    type="date"
                    value={item.expires_on ?? ""}
                    onChange={(e) =>
                      update.mutate({
                        id: item.id,
                        values: { expires_on: e.target.value || null },
                      })
                    }
                    aria-label={`Best before date for ${item.name}`}
                    className="rounded-full bg-card px-2 py-1 text-[11px]"
                  />
                </label>
              </div>
            </div>
          ))}
        </Card>
      )}
    </AppShell>
  );
}
