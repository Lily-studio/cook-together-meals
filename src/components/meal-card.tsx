import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChefHat,
  ChevronDown,
  Clock,
  Minus,
  PiggyBank,
  Plus,
  Repeat2,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { accentOf, useApp } from "@/components/app-context";
import { CookingMode } from "@/components/cooking-mode";
import { MealCost } from "@/components/meal-cost";
import { RecipePicker } from "@/components/recipe-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useAddLog,
  useDeletePlanEntry,
  useFavorites,
  useSetPlanEntry,
  useUpdatePlanEntry,
  type FoodLog,
  type PlanEntry,
} from "@/lib/db";
import { SLOT_EMOJI, SLOT_LABELS, scaleMacros } from "@/lib/nutrition";
import { portionsFor } from "@/lib/planner";
import { suggestSwaps } from "@/lib/portions";
import { cheaperIdea, servingVariant, whyThisMeal } from "@/lib/lily-brain";
import { formatGrams, splitDish } from "@/lib/dish";
import { ingredientsUsed, usePantry, usePantryMutations } from "@/lib/pantry";
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
  const stock = usePantry(householdId);
  const favorites = useFavorites(householdId);
  const setEntry = useSetPlanEntry();
  const updateEntry = useUpdatePlanEntry();
  const deleteEntry = useDeletePlanEntry();
  const addLog = useAddLog();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<{ name: string; amount: string } | null>(null);
  const [cookOpen, setCookOpen] = useState(false);

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
      {
        onSuccess: () => {
          // Take what this portion actually used out of the pantry.
          const used = ingredientsUsed(recipe, portions[profileId] ?? 1, swaps);
          pantry.consume.mutate(used, {
            onSuccess: (count) =>
              toast.success(
                count > 0 ? "Logged — pantry updated 🌼" : "Logged — nice one!",
              ),
          });
        },
      },
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
  const split = recipe ? splitDish(recipe, shown, portions, swaps) : null;
  const why = recipe
    ? whyThisMeal({
        recipe,
        slot,
        pantry: stock.data ?? [],
        favouriteRecipeIds: (favorites.data ?? []).map((f) => f.recipe_id),
      })
    : "";
  const cheaper = recipe ? cheaperIdea(recipe, swaps) : null;
  const variant = recipe && shown.length > 1 ? servingVariant(recipe) : null;
  // The lighter plate goes to whoever eats less of this dish.
  const lighter = variant
    ? [...shown].sort((a, b) => (portions[a.id] ?? 1) - (portions[b.id] ?? 1))[0]
    : null;


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

      {recipe && split ? (
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Cook it once{split.batches !== 1 ? ` · make ${split.batches}× the recipe` : ""} · finished dish ≈{" "}
            {formatGrams(split.total)}
          </p>

          <p className="mt-1.5 text-[12px] text-muted-foreground italic">
            👩🏻‍🍳 Why this one? Because {why}.
          </p>

          <ul className="mt-2 grid gap-2">
            {split.shares.map((share) => {
              const p = shown.find((x) => x.id === share.id)!;
              const mult = portions[p.id] ?? 1;
              const accent = accentOf(p);
              const eaten = logs.some((l) => l.profile_id === p.id && l.slot === slot);
              return (
                <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-secondary/40 px-2.5 py-2">
                  <span className={cn("size-2 shrink-0 rounded-full", accent.dot)} />
                  <span className="w-16 shrink-0 truncate text-[12px] font-semibold">{p.display_name}</span>
                  {mult === 0 ? (
                    <span className="flex-1 text-[12px] text-muted-foreground italic">eating something else</span>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-[12px] tabular-nums">
                      <span className="font-display text-[15px] font-semibold">
                        {formatGrams(share.grams)}
                      </span>
                      <span className="text-muted-foreground"> ≈ {share.calories} kcal</span>
                    </span>
                  )}
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-card px-1.5 py-0.5">
                    <button
                      onClick={() => adjust(p.id, -0.25)}
                      aria-label={`Smaller portion for ${p.display_name}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Minus className="size-3.5" />
                    </button>
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
                      "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
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

          {split.leftover > 0 ? (
            <p className="mt-2 rounded-2xl bg-butter/45 px-3 py-2 text-[12px] text-muted-foreground">
              🧊 {formatGrams(split.leftover)} left over — pop it in the fridge, that's another meal sorted.
            </p>
          ) : null}

          {variant && lighter ? (
            <p className="mt-2 rounded-2xl bg-olive/12 px-3 py-2 text-[12px] text-muted-foreground">
              🥬 <span className="font-semibold text-foreground">One meal, two plates:</span> same pan for
              both of you — {lighter.display_name} can have the filling piled over lettuce instead of the{" "}
              {variant.breadName.toLowerCase()}.
            </p>
          ) : null}


          {cheaper && entry ? (
            <button
              onClick={() => applySwap(cheaper.from, cheaper.to)}
              className="mt-2 flex w-full items-center gap-2 rounded-2xl bg-olive/12 px-3 py-2 text-left text-[12px] transition-colors hover:bg-olive/20"
            >
              <PiggyBank className="size-4 shrink-0 text-olive" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Make it cheaper</span>
                <span className="block truncate text-muted-foreground">{cheaper.note}</span>
              </span>
            </button>
          ) : null}

          <button
            onClick={() => setOpenFor(openFor === "all" ? null : "all")}
            className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-caramel"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", openFor === "all" && "rotate-180")} />
            {openFor === "all" ? "Hide the shopping quantities" : "What to cook — for both of you"}
          </button>

          {openFor === "all" ? (
            <ul className="mt-1.5 grid gap-1 border-t border-border/60 pt-1.5">
              {recipe.ingredients.map((ing) => {
                const swapped = swaps[ing.name];
                const name = swapped?.name ?? ing.name;
                const amount = swapped?.amount ?? ing.amount;
                return (
                  <li key={ing.name} className="flex items-center gap-2 text-[12px]">
                    <span className="min-w-0 flex-1 truncate">
                      {name}
                      {swapped ? <span className="ml-1 text-[10px] text-olive">swapped</span> : null}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{amount}</span>
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
              <li className="mt-1 text-[11px] text-muted-foreground italic">
                Cook the whole thing, then weigh the finished dish and serve the grams above 🌼
              </li>
            </ul>
          ) : null}

          <button
            onClick={() => setCookOpen(true)}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full bg-caramel px-4 py-2.5 text-[13px] font-semibold text-caramel-foreground transition-transform active:scale-[0.99]"
          >
            <ChefHat className="size-4" /> Cook it with me
          </button>

          <MealCost recipe={recipe} batches={split.batches} className="mt-2" swaps={swaps} />
        </div>
      ) : null}

      {recipe ? (
        <CookingMode
          open={cookOpen}
          onOpenChange={setCookOpen}
          recipe={recipe}
          entryId={entry?.id}
          people={shown.map((p) => ({ id: p.id, display_name: p.display_name }))}
          portions={portions}
          swaps={swaps}
        />
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
