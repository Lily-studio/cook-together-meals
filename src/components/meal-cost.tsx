import { useState } from "react";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Recipe } from "@/lib/db";
import { buildPriceBook, mealCost, money, usePriceMutations, usePrices } from "@/lib/prices";
import { cn } from "@/lib/utils";

/**
 * Optional and quiet: what this dish cost to cook, only when someone asks.
 * Anything Lily is guessing at can be corrected on the spot, and the correction
 * is remembered for every future meal and swap.
 */
export function MealCost({
  recipe,
  batches = 1,
  servings,
  swaps = {},
  className,
}: {
  recipe: Recipe;
  batches?: number;
  servings?: number;
  swaps?: Record<string, { name: string; amount: string }>;
  className?: string;
}) {
  const { householdId } = useApp();
  const prices = usePrices(householdId);
  const { save } = usePriceMutations(householdId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");

  const book = buildPriceBook(prices.data ?? []);
  const cost = mealCost(recipe, book, { batches, ...(servings ? { servings } : {}), swaps });

  const savePrice = (name: string) => {
    const price = Number(value.replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) return;
    save.mutate(
      { name, price, pack_size: 100, unit: "g" },
      {
        onSuccess: () => {
          toast.success(`${name}: ${money(price, cost.currency)} per 100 g — noted`);
          setEditing(null);
          setValue("");
        },
      },
    );
  };

  return (
    <div className={cn("min-w-0", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-caramel"
      >
        <Coins className="size-3.5" />
        {open ? "Hide the cost" : `What did this cost? ≈ ${money(cost.total, cost.currency)}`}
      </button>

      {open ? (
        <div className="mt-1.5 rounded-2xl bg-secondary/40 p-3">
          <ul className="grid gap-1">
            {cost.lines.slice(0, 8).map((line) => (
              <li key={line.name} className="flex items-center gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate">
                  {line.name}
                  {line.known ? null : <span className="ml-1 text-[10px] text-muted-foreground">guess</span>}
                </span>
                {editing === line.name ? (
                  <form
                    className="flex shrink-0 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      savePrice(line.name);
                    }}
                  >
                    <Input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      inputMode="decimal"
                      placeholder="per 100 g"
                      className="h-7 w-24 rounded-full px-2 text-[11px]"
                    />
                    <Button type="submit" size="sm" className="h-7 rounded-full px-2 text-[11px]">
                      Save
                    </Button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setEditing(line.name);
                      setValue("");
                    }}
                    className="shrink-0 font-semibold tabular-nums hover:text-caramel"
                  >
                    {money(line.cost, cost.currency)}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-border/60 pt-2">
            <span className="text-[12px] font-semibold">Total</span>
            <span className="font-display text-[16px] font-semibold">{money(cost.total, cost.currency)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            About {money(cost.perServing, cost.currency)} a serving
            {cost.guessed ? ` · tap a price to correct my ${cost.guessed} guesses` : ""}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
