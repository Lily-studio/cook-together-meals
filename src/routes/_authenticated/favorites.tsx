import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { RecipeCard, RecipeCardGrid } from "@/components/recipe-card";
import { LilySays } from "@/components/lily";
import { useFavorites, useSetPlanEntry, useToggleFavorite } from "@/lib/db";
import { SLOT_MEAL_TYPE, SLOTS, isoDate } from "@/lib/nutrition";
import { portionsFor } from "@/lib/planner";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [
    { title: "Favourite meals — Cook with Lily" },
    { name: "description", content: "Keep your household's favourite recipes together and add them to your meal plan." },
    { property: "og:title", content: "Favourite meals — Cook with Lily" },
    { property: "og:description", content: "The meals your household keeps coming back to." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
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
        <RecipeCardGrid>
          {rows.map((fav) => {
            const person = people.find((p) => p.id === fav.profile_id);
            if (!fav.recipes) return null;
            return (
              <RecipeCard
                key={fav.id}
                recipe={fav.recipes}
                favorite
                personLabel={person?.display_name ?? "Household"}
                onPlan={() => planTomorrow(fav.recipe_id, fav.recipes?.meal_types ?? [])}
                onFavorite={() =>
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
              />
            );
          })}
        </RecipeCardGrid>
      )}
    </AppShell>
  );
}
