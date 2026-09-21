import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Heart, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { Chip } from "@/components/macro";
import { Input } from "@/components/ui/input";
import { useFavorites, useRecipes, useToggleFavorite } from "@/lib/db";
import { restrictionsFor, recipeAllowed } from "@/lib/planner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/discover")({
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

function Discover() {
  const { people, me, householdId } = useApp();
  const { data: recipes = [] } = useRecipes();
  const favorites = useFavorites(householdId);
  const toggleFavorite = useToggleFavorite();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [tag, setTag] = useState<string | null>(null);

  const list = useMemo(() => {
    const r = restrictionsFor(people);
    const needle = q.trim().toLowerCase();
    return recipes
      .filter((rec) => recipeAllowed(rec, r))
      .filter((rec) => (filter === "all" ? true : rec.meal_types.includes(filter)))
      .filter((rec) => (tag ? rec.tags.some((t) => t.toLowerCase() === tag) : true))
      .filter((rec) =>
        needle ? `${rec.title} ${rec.tagline} ${rec.tags.join(" ")}`.toLowerCase().includes(needle) : true,
      );
  }, [recipes, people, filter, tag, q]);

  const favOf = (recipeId: string) =>
    (favorites.data ?? []).find((f) => f.recipe_id === recipeId && f.profile_id === me?.id);

  return (
    <AppShell title="Discover" subtitle="Warm, affordable, Moroccan-friendly">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipes"
          className="rounded-full pl-9"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "Everything" : f}
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
