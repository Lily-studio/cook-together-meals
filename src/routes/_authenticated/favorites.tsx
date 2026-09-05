import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import { accentOf, useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { useFavorites, useSetPlanEntry, useToggleFavorite } from "@/lib/db";
import { SLOT_MEAL_TYPE, SLOTS, isoDate } from "@/lib/nutrition";
import { portionsFor } from "@/lib/planner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/favorites")({
  component: Favorites,
});

function Favorites() {
  const { householdId, people } = useApp();
  const favorites = useFavorites(householdId);
  const toggleFavorite = useToggleFavorite();
  const setEntry = useSetPlanEntry();
  const rows = favorites.data ?? [];

  const planTomorrow = (recipeId: string, mealTypes: string[]) => {
    const fav = rows.find((r) => r.recipe_id === recipeId);
    if (!fav || !householdId) return;
    const slot = SLOTS.find((s) => mealTypes.includes(SLOT_MEAL_TYPE[s] ?? "")) ?? "dinner";
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setEntry.mutate(
      {
        household_id: householdId,
        plan_date: isoDate(d),
        slot,
        recipe_id: recipeId,
        portions: portionsFor(people, slot, fav.recipes),
      },
      { onSuccess: () => toast.success("Added to tomorrow's plan") },
    );
  };

  return (
    <AppShell title="Favourites" subtitle="The meals you keep coming back to">
      {rows.length === 0 ? (
        <LilySays>
          No favourites yet — tap the little heart on any recipe and it lands here.
        </LilySays>
      ) : (
        <div className="grid gap-3">
          {rows.map((fav) => {
            const person = people.find((p) => p.id === fav.profile_id);
            return (
              <Card key={fav.id} className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  {fav.recipes?.emoji}
                </span>
                <Link
                  to="/recipes/$slug"
                  params={{ slug: fav.recipes?.slug ?? "" }}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate font-display text-[16px] font-semibold">{fav.recipes?.title}</p>
                  <p className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", accentOf(person).dot)} />
                    {person?.display_name ?? "Household"} · {fav.recipes?.calories} kcal
                  </p>
                </Link>
                <button
                  onClick={() => planTomorrow(fav.recipe_id, fav.recipes?.meal_types ?? [])}
                  aria-label="Plan for tomorrow"
                  className="flex size-8 items-center justify-center rounded-full bg-butter/60 text-caramel hover:bg-caramel hover:text-caramel-foreground"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  onClick={() =>
                    toggleFavorite.mutate(
                      {
                        profileId: fav.profile_id,
                        householdId: householdId!,
                        recipeId: fav.recipe_id,
                        existingId: fav.id,
                      },
                      { onSuccess: () => toast.success("Removed") },
                    )
                  }
                  aria-label="Remove favourite"
                  className="text-terracotta"
                >
                  <Heart className="size-5 fill-terracotta" />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
