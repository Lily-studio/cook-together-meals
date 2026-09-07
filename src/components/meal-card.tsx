import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Clock,
  Minus,
  Plus,
  Repeat2,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { accentOf, useApp } from "@/components/app-context";
import { RecipePicker } from "@/components/recipe-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useAddLog,
  useDeletePlanEntry,
  useSetPlanEntry,
  useUpdatePlanEntry,
  type FoodLog,
  type PlanEntry,
} from "@/lib/db";
import { SLOT_EMOJI, SLOT_LABELS, scaleMacros } from "@/lib/nutrition";
import { portionsFor } from "@/lib/planner";
import { scaleAmount, suggestSwaps } from "@/lib/portions";
import { ingredientsUsed, usePantryMutations } from "@/lib/pantry";
import { cn } from "@/lib/utils";

export function MealCard({
  date,
  slot,
  entry,
  logs = [],
  onlyProfileId,
}: {
  date: string;
  slot: string;
  entry: PlanEntry | undefined;
  logs?: FoodLog[] | undefined;
  onlyProfileId?: string | undefined;
}) {
  const { people, householdId } = useApp();
  const pantry = usePantryMutations(householdId);
  const setEntry = useSetPlanEntry();
  const updateEntry = useUpdatePlanEntry();
  const deleteEntry = useDeletePlanEntry();
  const addLog = useAddLog();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<{ name: string; amount: string } | null>(null);

  const recipe = entry?.recipes ?? null;
  const swaps = entry?.swaps ?? {};
  const shown = onlyProfileId ? people.filter((p) => p.id === onlyProfileId) : people;

  // Auto-personalised portions, overridden by anything saved for this entry.
  const portions: Record<string, number> = recipe
    ? { ...portionsFor(people, slot, recipe), ...(entry?.portions ?? {}) }
    : (entry?.portions ?? {});

  const adjust = (profileId: string, delta: number) => {
    if (!entry) return;
    const next = {
      ...portions,
      [profileId]: Math.max(0, Math.round(((portions[profileId] ?? 1) + delta) * 20) / 20),
    };
    updateEntry.mutate({ id: entry.id, values: { portions: next } });
  };

  const markEaten = (profileId: string) => {
    if (!recipe || !householdId) return;
    const macros = scaleMacros(recipe, portions[profileId] ?? 1);
    addLog.mutate(
      {
        profile_id: profileId,
        household_id: householdId,
        log_date: date,
        slot,
        description: recipe.title,
        source: "plan",
        ...macros,
      },
      { onSuccess: () => toast.success("Logged — nice one!") },
    );
  };

  const applySwap = (from: string, to: { name: string; amount: string }) => {
    if (!entry) return;
    updateEntry.mutate(
      { id: entry.id, values: { swaps: { ...swaps, [from]: to } } },
      { onSuccess: () => toast.success(`${to.name} instead of ${from} — noted`) },
    );
    setSwapFor(null);
  };

  const clearSwap = (from: string) => {
    if (!entry) return;
    const next = { ...swaps };
    delete next[from];
    updateEntry.mutate({ id: entry.id, values: { swaps: next } });
  };

  const minutes = recipe ? recipe.prep_minutes + recipe.cook_minutes : 0;
  const swapCandidates = swapFor ? suggestSwaps(swapFor.name, swapFor.amount) : [];

  return (
    <Card className="relative">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          {recipe?.emoji ?? SLOT_EMOJI[slot]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {SLOT_LABELS[slot]}
          </p>
          {recipe ? (
            <Link
              to="/recipes/$slug"
              params={{ slug: recipe.slug }}
              className="block truncate font-display text-[17px] leading-snug font-semibold hover:underline"
            >
              {recipe.title}
            </Link>
          ) : (
            <p className="font-display text-[17px] font-semibold text-muted-foreground">
              {entry?.custom_title ?? "Nothing planned yet"}
            </p>
          )}
          {recipe ? (
            <p className="flex items-center gap-1 truncate text-[12px] text-muted-foreground">
              <Clock className="size-3.5" /> {minutes} min · {recipe.tagline}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={() => setPickerOpen(true)}
            aria-label={recipe ? "Replace this meal" : "Choose a meal"}
            className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-caramel/15 hover:text-caramel"
          >
            {recipe ? <Repeat2 className="size-4" /> : <Plus className="size-4" />}
          </button>
          {entry ? (
            <button
              onClick={() =>
                deleteEntry.mutate(entry.id, { onSuccess: () => toast.success("Removed from the plan") })
              }
              aria-label="Remove this meal"
              className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-terracotta/15 hover:text-terracotta"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {recipe ? (
        <ul className="mt-3 grid gap-2 border-t border-border/60 pt-3">
          {shown.map((p) => {
            const mult = portions[p.id] ?? 1;
            const macros = scaleMacros(recipe, mult);
            const accent = accentOf(p);
            const eaten = logs.some((l) => l.profile_id === p.id && l.slot === slot);
            const expanded = openFor === p.id;
            return (
              <li key={p.id} className="rounded-2xl bg-secondary/40 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", accent.dot)} />
                  <span className="w-16 shrink-0 truncate text-[12px] font-semibold">{p.display_name}</span>
                  {mult === 0 ? (
                    <span className="flex-1 text-[12px] text-muted-foreground italic">eating something else</span>
                  ) : (
                    <span className="flex-1 text-[12px] text-muted-foreground tabular-nums">
                      {macros.calories} kcal · {macros.protein}g P
                    </span>
                  )}
                  <span className="flex items-center gap-1 rounded-full bg-card px-1.5 py-0.5">
                    <button
                      onClick={() => adjust(p.id, -0.25)}
                      aria-label={`Smaller portion for ${p.display_name}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-9 text-center text-[11px] font-semibold tabular-nums">
                      {mult.toFixed(2).replace(/0$/, "")}×
                    </span>
                    <button
                      onClick={() => adjust(p.id, 0.25)}
                      aria-label={`Bigger portion for ${p.display_name}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </span>
                  <button
                    onClick={() => markEaten(p.id)}
                    disabled={eaten}
                    aria-label={`Log this meal for ${p.display_name}`}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full transition-colors",
                      eaten
                        ? "bg-olive/20 text-olive"
                        : "bg-butter/60 text-caramel hover:bg-caramel hover:text-caramel-foreground",
                    )}
                  >
                    {eaten ? <Check className="size-4" /> : <UtensilsCrossed className="size-3.5" />}
                  </button>
                </div>

                {mult > 0 ? (
                  <button
                    onClick={() => setOpenFor(expanded ? null : p.id)}
                    className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-caramel"
                  >
                    <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
                    {expanded ? "Hide quantities" : `Exact quantities for ${p.display_name}`}
                  </button>
                ) : null}

                {expanded ? (
                  <ul className="mt-1.5 grid gap-1 border-t border-border/60 pt-1.5">
                    {recipe.ingredients.map((ing) => {
                      const swapped = swaps[ing.name];
                      const name = swapped?.name ?? ing.name;
                      const baseAmount = swapped?.amount ?? ing.amount;
                      return (
                        <li key={ing.name} className="flex items-center gap-2 text-[12px]">
                          <span className="min-w-0 flex-1 truncate">
                            {name}
                            {swapped ? (
                              <span className="ml-1 text-[10px] text-olive">swapped</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {scaleAmount(baseAmount, mult / Math.max(1, recipe.base_servings))}
                          </span>
                          {swapped ? (
                            <button
                              onClick={() => clearSwap(ing.name)}
                              className="shrink-0 text-[10px] font-semibold text-muted-foreground hover:text-terracotta"
                            >
                              undo
                            </button>
                          ) : (
                            <button
                              onClick={() => setSwapFor({ name: ing.name, amount: ing.amount })}
                              aria-label={`Replace ${ing.name}`}
                              className="shrink-0 text-muted-foreground hover:text-caramel"
                            >
                              <Repeat2 className="size-3.5" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <RecipePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        slot={slot}
        targetCalories={recipe?.calories}
        onPick={(rec) => {
          if (!householdId) return;
          setEntry.mutate(
            {
              household_id: householdId,
              plan_date: date,
              slot,
              recipe_id: rec.id,
              portions: portionsFor(people, slot, rec),
            },
            { onSuccess: () => toast.success(`${rec.title} it is!`) },
          );
        }}
      />

      <Dialog open={!!swapFor} onOpenChange={(v) => !v && setSwapFor(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Don't like {swapFor?.name.toLowerCase()}?
            </DialogTitle>
          </DialogHeader>
          {swapCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              I haven't got a good stand-in for that one yet — try replacing the whole meal instead.
            </p>
          ) : (
            <ul className="grid gap-2">
              {swapCandidates.map((s) => (
                <li key={s.name}>
                  <button
                    onClick={() => swapFor && applySwap(swapFor.name, { name: s.name, amount: s.amount })}
                    className="flex w-full items-center gap-3 rounded-2xl bg-secondary/60 p-3 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{s.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{s.note}</span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold tabular-nums">{s.amount}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
