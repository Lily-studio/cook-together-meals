import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Minus, Plus, Repeat2, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { accentOf, useApp } from "@/components/app-context";
import { RecipePicker } from "@/components/recipe-picker";
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
import { cn } from "@/lib/utils";

export function MealCard({
  date,
  slot,
  entry,
  logs = [],
}: {
  date: string;
  slot: string;
  entry?: PlanEntry;
  logs?: FoodLog[];
}) {
  const { people, householdId } = useApp();
  const setEntry = useSetPlanEntry();
  const updateEntry = useUpdatePlanEntry();
  const deleteEntry = useDeletePlanEntry();
  const addLog = useAddLog();
  const [pickerOpen, setPickerOpen] = useState(false);

  const recipe = entry?.recipes ?? null;
  const portions = entry?.portions ?? {};

  const pick = (recipeId: string, calories: number) => {
    if (!householdId) return;
    void calories;
    setEntry.mutate(
      {
        household_id: householdId,
        plan_date: date,
        slot,
        recipe_id: recipeId,
        portions: {},
      },
      { onSuccess: () => toast.success("Meal updated") },
    );
  };

  const adjust = (profileId: string, delta: number) => {
    if (!entry) return;
    const next = { ...portions, [profileId]: Math.max(0, Math.round(((portions[profileId] ?? 1) + delta) * 20) / 20) };
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
            <p className="truncate text-[12px] text-muted-foreground">
              {recipe.prep_minutes + recipe.cook_minutes} min · {recipe.tagline}
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
          {people.map((p) => {
            const mult = portions[p.id] ?? 1;
            const macros = scaleMacros(recipe, mult);
            const accent = accentOf(p);
            const eaten = logs.some((l) => l.profile_id === p.id && l.slot === slot);
            return (
              <li key={p.id} className="flex items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", accent.dot)} />
                <span className="w-16 shrink-0 truncate text-[12px] font-semibold">{p.display_name}</span>
                {mult === 0 ? (
                  <span className="flex-1 text-[12px] text-muted-foreground italic">eating something else</span>
                ) : (
                  <span className="flex-1 text-[12px] text-muted-foreground tabular-nums">
                    {macros.calories} kcal · {macros.protein}g P
                  </span>
                )}
                <span className="flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5">
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
              </li>
            );
          })}
        </ul>
      ) : null}

      <RecipePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        slot={slot}
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
          void pick;
        }}
      />
    </Card>
  );
}
