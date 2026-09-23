/**
 * "I planned for 4 but 6 are eating."
 *
 * Works with the finished-dish weighing the rest of the app uses: tell it how
 * many plates you need and it says how much of the recipe to make, what the
 * pot will weigh, and how many grams go on each plate.
 */

import { useState } from "react";
import { Minus, Plus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Recipe } from "@/lib/db";
import { finishedWeight, formatGrams, roundGrams, type Swaps } from "@/lib/dish";
import { scaleAmount } from "@/lib/portions";
import { scaleMacros } from "@/lib/nutrition";

export function ServingCalculator({
  recipe,
  swaps = {},
  plannedFor,
  open,
  onOpenChange,
}: {
  recipe: Recipe;
  swaps?: Swaps;
  /** How many plates the plan already expects. */
  plannedFor: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const start = Math.max(1, Math.round(plannedFor || recipe.base_servings));
  const [eaters, setEaters] = useState(start);

  const batches = Math.max(0.25, Math.round((eaters / Math.max(1, recipe.base_servings)) * 4) / 4);
  const total = roundGrams(finishedWeight(recipe, swaps) * batches);
  const perPlate = roundGrams(total / Math.max(1, eaters));
  const macros = scaleMacros(recipe, eaters / Math.max(1, recipe.base_servings) / Math.max(1, eaters));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">How many are eating?</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-5 rounded-3xl bg-butter/50 py-4">
          <button
            onClick={() => setEaters((n) => Math.max(1, n - 1))}
            aria-label="One fewer person"
            className="grid size-10 place-items-center rounded-full bg-card text-caramel shadow-soft"
          >
            <Minus className="size-4" />
          </button>
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-semibold tabular-nums">{eaters}</span>
            <span className="text-[12px] text-muted-foreground">
              plate{eaters === 1 ? "" : "s"}
            </span>
          </span>
          <button
            onClick={() => setEaters((n) => Math.min(20, n + 1))}
            aria-label="One more person"
            className="grid size-10 place-items-center rounded-full bg-card text-caramel shadow-soft"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <p className="text-[13px] leading-relaxed">
          Make <span className="font-semibold">{batches}× the recipe</span> — the finished dish will weigh
          about <span className="font-semibold">{formatGrams(total)}</span>, so serve roughly{" "}
          <span className="font-semibold">{formatGrams(perPlate)}</span> per plate
          {macros.calories > 0 ? <> (≈ {macros.calories} kcal each)</> : null}.
        </p>

        <div className="max-h-56 overflow-y-auto rounded-2xl bg-secondary/40 p-3">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Shopping quantities for {eaters}
          </p>
          <ul className="grid gap-1">
            {recipe.ingredients.map((ing) => {
              const swapped = swaps[ing.name];
              return (
                <li key={ing.name} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate">{swapped?.name ?? ing.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {scaleAmount(swapped?.amount ?? ing.amount, batches)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-[12px] text-muted-foreground">
          Weigh the finished dish and share it out — that's always the accurate way 🌼
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function ServingCalculatorButton({
  recipe,
  swaps,
  plannedFor,
  className,
}: {
  recipe: Recipe;
  swaps?: Swaps;
  plannedFor: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-secondary"
        }
      >
        <Users className="size-3.5 text-caramel" /> More people eating?
      </button>
      <ServingCalculator
        recipe={recipe}
        {...(swaps ? { swaps } : {})}
        plannedFor={plannedFor}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
