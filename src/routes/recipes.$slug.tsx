import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ChefHat, Clock, Users } from "lucide-react";
import { LilyBeside, LilySays } from "@/components/lily";
import { useApp } from "@/components/app-context";
import { CookingMode } from "@/components/cooking-mode";
import { MealCost } from "@/components/meal-cost";
import { Button } from "@/components/ui/button";
import { useRecipe } from "@/lib/db";
import { portionsFor } from "@/lib/planner";
import { formatGrams, splitDish } from "@/lib/dish";

export const Route = createFileRoute("/recipes/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Cook with Lily` },
      { name: "description", content: "A warm, affordable recipe with per-person portions from Lily." },
      { property: "og:title", content: "A recipe from Cook with Lily" },
      { property: "og:description", content: "Cook once, serve two portions that fit each goal." },
    ],
  }),
  component: RecipePage,
});

function RecipePage() {
  const { slug } = Route.useParams();
  const { data: recipe, isLoading } = useRecipe(slug);
  const { people } = useApp();
  const slot = recipe?.meal_types?.[0] ?? "dinner";
  const [cookOpen, setCookOpen] = useState(false);
  const split =
    recipe && people.length ? splitDish(recipe, people, portionsFor(people, slot, recipe)) : null;

  return (
    <main className="paper min-h-screen bg-background pb-16">
      <div className="mx-auto w-full max-w-md px-5 pt-7">
        <Link
          to="/today"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-caramel hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to my day
        </Link>

        {isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Fetching the recipe…</p>
        ) : !recipe ? (
          <p className="mt-8 text-sm text-muted-foreground">That recipe isn't in Lily's book.</p>
        ) : (
          <>
            <div className="mt-5 flex items-start gap-3">
              <span className="text-4xl" aria-hidden>
                {recipe.emoji}
              </span>
              <div>
                <h1 className="font-display text-[26px] leading-tight font-semibold">{recipe.title}</h1>
                <p className="text-[13px] text-muted-foreground">{recipe.tagline}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1.5 shadow-soft">
                <Clock className="size-3.5" /> {recipe.prep_minutes + recipe.cook_minutes} min
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1.5 shadow-soft">
                <Users className="size-3.5" /> serves {recipe.base_servings}
              </span>
              <span className="rounded-full bg-card px-3 py-1.5 shadow-soft">{recipe.difficulty}</span>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 rounded-3xl bg-butter/45 p-3 text-center">
              {[
                ["kcal", recipe.calories],
                ["protein", `${recipe.protein}g`],
                ["carbs", `${recipe.carbs}g`],
                ["fat", `${recipe.fat}g`],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="font-display text-[17px] font-semibold">{value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
                </div>
              ))}
            </div>

            {split ? (
              <section className="mt-5 rounded-3xl bg-card p-4 shadow-soft">
                <h2 className="font-display text-[17px] font-semibold">
                  👩🏻‍🍳 Prepare this once — for both of you
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Cook the whole recipe, then weigh the finished dish and serve these amounts.
                </p>
                <p className="mt-3 rounded-2xl bg-butter/45 px-3 py-2 text-[13px] font-semibold">
                  {split.batches !== 1 ? `Make ${split.batches}× the recipe · ` : ""}Total finished dish ≈{" "}
                  {formatGrams(split.total)}
                </p>
                <ul className="mt-2 grid gap-2">
                  {split.shares.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-baseline justify-between rounded-2xl bg-secondary/50 px-3.5 py-2.5"
                    >
                      <span className="text-[13px] font-semibold">{s.name}</span>
                      <span className="text-right">
                        <span className="font-display text-[19px] font-semibold">{formatGrams(s.grams)}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          ≈ {s.calories} kcal · {s.protein}g protein
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {split.leftover > 0 ? (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    🧊 <span className="font-semibold">{formatGrams(split.leftover)} left over</span> — keep it
                    covered in the fridge for up to 3 days, then reheat gently. That's another meal already done.
                  </p>
                ) : null}
              </section>
            ) : null}

            {recipe.lily_note ? (
              <LilyBeside mood="cooking" height={130} className="mt-5">
                {recipe.lily_note}
              </LilyBeside>
            ) : null}


            <h2 className="mt-6 mb-2 font-display text-[15px] font-semibold tracking-wide text-muted-foreground uppercase">
              Ingredients
            </h2>
            <ul className="grid gap-1.5">
              {recipe.ingredients.map((ing) => (
                <li
                  key={ing.name}
                  className="flex items-center justify-between rounded-2xl bg-card px-4 py-2.5 shadow-soft"
                >
                  <span className="text-[13px] font-medium">{ing.name}</span>
                  <span className="text-[12px] text-muted-foreground">{ing.amount}</span>
                </li>
              ))}
            </ul>

            <MealCost recipe={recipe} batches={split?.batches ?? 1} className="mt-3" />

            <h2 className="mt-6 mb-2 font-display text-[15px] font-semibold tracking-wide text-muted-foreground uppercase">
              How to cook it
            </h2>
            <Button className="w-full rounded-full" onClick={() => setCookOpen(true)}>
              <ChefHat className="size-4" /> Cook it with me — one step at a time
            </Button>
            <ol className="mt-2.5 grid gap-2.5">
              {recipe.steps.map((step, i) => (
                <li key={step} className="flex gap-3 rounded-2xl bg-card p-3.5 shadow-soft">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-caramel text-[12px] font-semibold text-caramel-foreground">
                    {i + 1}
                  </span>
                  <p className="text-[13px] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>

            <CookingMode
              open={cookOpen}
              onOpenChange={setCookOpen}
              recipe={recipe}
              people={people.map((p) => ({ id: p.id, display_name: p.display_name }))}
              portions={portionsFor(people, slot, recipe)}
            />
          </>
        )}
      </div>
    </main>
  );
}
