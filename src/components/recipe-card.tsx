import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Heart, Plus } from "lucide-react";
import { RecipePhoto } from "@/components/recipe-photo";
import type { Recipe } from "@/lib/db";
import { cn } from "@/lib/utils";

export function RecipeCard({
  recipe,
  favorite,
  onFavorite,
  onPlan,
  personLabel,
  className,
}: {
  recipe: Recipe;
  favorite?: boolean;
  onFavorite?: () => void;
  onPlan?: () => void;
  personLabel?: string;
  className?: string;
}) {
  const minutes = recipe.prep_minutes + recipe.cook_minutes;
  return (
    <article className={cn("recipe-card group", className)}>
      <div className="relative">
        <Link to="/recipes/$slug" params={{ slug: recipe.slug }} aria-label={`Open ${recipe.title}`}>
          <RecipePhoto recipe={recipe} className="aspect-[16/10] rounded-t-[1.65rem]" />
        </Link>
        <span className="absolute top-3 left-3 rounded-full border border-card/60 bg-card/90 px-3 py-1 text-[10px] font-bold text-caramel uppercase shadow-soft backdrop-blur">
          {recipe.cuisine}
        </span>
        {onFavorite ? (
          <button
            type="button"
            onClick={onFavorite}
            aria-label={favorite ? `Unfavourite ${recipe.title}` : `Favourite ${recipe.title}`}
            className="absolute top-3 right-3 grid size-10 place-items-center rounded-full border border-card/70 bg-card/90 text-muted-foreground shadow-soft backdrop-blur transition-transform hover:scale-105 hover:text-terracotta"
          >
            <Heart className={cn("size-4.5", favorite && "fill-terracotta text-terracotta")} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <Link to="/recipes/$slug" params={{ slug: recipe.slug }} className="block">
          <h3 className="font-display text-[1.2rem] leading-tight font-semibold text-balance group-hover:text-caramel">
            {recipe.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 min-h-10 text-[12.5px] leading-5 text-muted-foreground">{recipe.tagline}</p>
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-muted-foreground">
          <span>{recipe.calories} kcal</span>
          <span>{recipe.protein} g protein</span>
          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{minutes} min</span>
        </div>

        {personLabel || onPlan ? (
          <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
            {personLabel ? <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Saved by {personLabel}</span> : <span className="flex-1" />}
            {onPlan ? (
              <button
                type="button"
                onClick={onPlan}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-butter/55 px-3 text-[11px] font-bold text-caramel transition-colors hover:bg-caramel hover:text-caramel-foreground"
              >
                <Plus className="size-3.5" /> Plan tomorrow
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function RecipeCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
