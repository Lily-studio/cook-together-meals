import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Globe2, Heart, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { Chip } from "@/components/macro";
import { LilySays } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFavorites, usePlan, useRecipes, useSetPlanEntry, useToggleFavorite, type Recipe } from "@/lib/db";
import { portionsFor, restrictionsFor, recipeAllowed } from "@/lib/planner";
import { isoDate } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: "Discover something new · Cook with Lily" },
      {
        name: "description",
        content:
          "Browse every meal Lily can cook for your household, or let her pick a dish from a cuisine you haven't tried lately — always within your preferences and nutrition.",
      },
      { property: "og:title", content: "Discover something new · Cook with Lily" },
      {
        property: "og:description",
        content: "Moroccan, Mediterranean and international meals that still fit your goals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});

const FILTERS = ["all", "breakfast", "lunch", "dinner", "snack"];
/** Tag shortcuts: the fun corners of the library. */
const TAG_FILTERS: { key: string; label: string }[] = [
  { key: "air fryer", label: "🔥 Air fryer" },
  { key: "coffee", label: "☕ Coffee" },
  { key: "burger", label: "🍔 Burgers" },
  { key: "dessert", label: "🍰 Sweet" },
  { key: "high protein", label: "💪 High protein" },
  { key: "quick", label: "⏱️ Quick" },
];

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function Discover() {
  const { people, me, householdId } = useApp();
  const { data: recipes = [] } = useRecipes();
  const favorites = useFavorites(householdId);
  const toggleFavorite = useToggleFavorite();
  const setEntry = useSetPlanEntry();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [tag, setTag] = useState<string | null>(null);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [surprise, setSurprise] = useState<Recipe | null>(null);

  const today = useMemo(() => isoDate(new Date()), []);
  const recent = usePlan(householdId, addDays(today, -21), addDays(today, 1));

  /** Every allowed recipe, before the browsing filters — the pool Lily picks from. */
  const allowed = useMemo(() => {
    const r = restrictionsFor(people);
    return recipes.filter((rec) => recipeAllowed(rec, r));
  }, [recipes, people]);

  const cuisines = useMemo(
    () => [...new Set(allowed.map((r) => r.cuisine).filter(Boolean))].sort(),
    [allowed],
  );

  /** Cuisines already on the plate lately — the ones a "new" pick should avoid. */
  const recentCuisines = useMemo(() => {
    const set = new Set<string>();
    (recent.data ?? []).forEach((e) => {
      if (e.recipes?.cuisine) set.add(e.recipes.cuisine);
    });
    return set;
  }, [recent.data]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allowed
      .filter((rec) => (filter === "all" ? true : rec.meal_types.includes(filter)))
      .filter((rec) => (tag ? rec.tags.some((t) => t.toLowerCase() === tag) : true))
      .filter((rec) => (cuisine ? rec.cuisine === cuisine : true))
      .filter((rec) =>
        needle ? `${rec.title} ${rec.tagline} ${rec.tags.join(" ")}`.toLowerCase().includes(needle) : true,
      );
  }, [allowed, filter, tag, cuisine, q]);

  /** Pick a proper dinner from a cuisine the household hasn't eaten recently. */
  const pickSomethingNew = () => {
    const mains = allowed.filter((r) => r.meal_types.includes("dinner") || r.meal_types.includes("lunch"));
    const fresh = mains.filter((r) => !recentCuisines.has(r.cuisine));
    const pool = (fresh.length ? fresh : mains).filter((r) => r.id !== surprise?.id);
    if (!pool.length) {
      toast.error("I've run out of new ideas for now — try again after a replan.");
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)]!;
    setSurprise(pick);
    setCuisine(pick.cuisine);
  };

  const cookTomorrow = (rec: Recipe) => {
    if (!householdId) return;
    setEntry.mutate(
      {
        household_id: householdId,
        plan_date: addDays(today, 1),
        slot: "dinner",
        recipe_id: rec.id,
        portions: portionsFor(people, "dinner", rec),
      },
      { onSuccess: () => toast.success(`${rec.title} is tomorrow's dinner — I've updated your plan.`) },
    );
  };

  const favOf = (recipeId: string) =>
    (favorites.data ?? []).find((f) => f.recipe_id === recipeId && f.profile_id === me?.id);

  return (
    <AppShell title="Discover" subtitle="Warm, affordable, Moroccan-friendly">
      <LilySays mood="happy">
        Fancy something different? I'll find a meal from a kitchen you haven't cooked from lately — still inside
        your goals, your dislikes and your budget.
      </LilySays>

      <Card className="mt-3 bg-butter/40">
        <div className="flex items-center gap-2">
          <Globe2 className="size-4 text-caramel" />
          <p className="font-display text-[16px] font-semibold">Discover something new</p>
        </div>
        {surprise ? (
          <div className="mt-2">
            <p className="text-[13px]">
              <span aria-hidden>{surprise.emoji}</span>{" "}
              <span className="font-semibold">{surprise.title}</span> — {surprise.cuisine}. {surprise.tagline}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {surprise.calories} kcal · {surprise.protein}g protein ·{" "}
              {surprise.prep_minutes + surprise.cook_minutes} min
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" className="rounded-full" onClick={() => cookTomorrow(surprise)}>
                Cook it tomorrow
              </Button>
              <Button size="sm" variant="secondary" className="rounded-full" onClick={pickSomethingNew}>
                Something else
              </Button>
              <Link
                to="/recipes/$slug"
                params={{ slug: surprise.slug }}
                className="self-center text-[12px] font-semibold text-caramel hover:underline"
              >
                See the recipe
              </Link>
            </div>
          </div>
        ) : (
          <Button size="sm" className="mt-2 rounded-full" onClick={pickSomethingNew}>
            <Sparkles className="mr-1.5 size-4" /> Surprise me
          </Button>
        )}
      </Card>

      <div className="relative mt-3">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipes"
          className="rounded-full pl-9"
        />
      </div>
      {cuisines.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cuisines.map((c) => (
            <Chip key={c} active={cuisine === c} onClick={() => setCuisine(cuisine === c ? null : c)}>
              {c}
            </Chip>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "Everything" : f}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TAG_FILTERS.map((t) => (
          <Chip key={t.key} active={tag === t.key} onClick={() => setTag(tag === t.key ? null : t.key)}>
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {list.map((rec) => {
          const fav = favOf(rec.id);
          return (
            <Card key={rec.id} className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                {rec.emoji}
              </span>
              <Link to="/recipes/$slug" params={{ slug: rec.slug }} className="min-w-0 flex-1">
                <p className="truncate font-display text-[16px] font-semibold">{rec.title}</p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {rec.calories} kcal · {rec.protein}g protein · {rec.prep_minutes + rec.cook_minutes} min
                </p>
              </Link>
              <button
                onClick={() => {
                  if (!me || !householdId) return;
                  toggleFavorite.mutate(
                    {
                      profileId: me.id,
                      householdId,
                      recipeId: rec.id,
                      ...(fav ? { existingId: fav.id } : {}),
                    },
                    { onSuccess: () => toast.success(fav ? "Removed from favourites" : "Saved to favourites") },
                  );
                }}
                aria-label={fav ? `Unfavourite ${rec.title}` : `Favourite ${rec.title}`}
                className="shrink-0 text-muted-foreground transition-colors hover:text-terracotta"
              >
                <Heart className={cn("size-5", fav && "fill-terracotta text-terracotta")} />
              </button>
            </Card>
          );
        })}
        {list.length === 0 ? (
          <Card>
            <p className="text-[13px] text-muted-foreground">Nothing matches that search yet.</p>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
