import { useState } from "react";
import berryYogurt from "@/assets/food/berry-yogurt.webp.asset.json";
import breakfastOats from "@/assets/food/breakfast-oats.webp.asset.json";
import chickenTagine from "@/assets/food/chicken-tagine.webp.asset.json";
import chickenWrap from "@/assets/food/chicken-wrap.webp.asset.json";
import chickpeaBowl from "@/assets/food/chickpea-bowl.webp.asset.json";
import lentilSoup from "@/assets/food/lentil-soup.webp.asset.json";
import spicedFish from "@/assets/food/spiced-fish.webp.asset.json";
import vegetablePasta from "@/assets/food/vegetable-pasta.webp.asset.json";
import { cn } from "@/lib/utils";

type PhotoRecipe = {
  title: string;
  tagline?: string;
  cuisine?: string;
  emoji: string;
  meal_types?: string[];
  tags?: string[];
  image_url?: string | null;
};

/** User photos always win. Catalog art is warm serving inspiration, chosen deterministically. */
export function RecipePhoto({
  recipe,
  className,
  imageClassName,
  eager = false,
}: {
  recipe: PhotoRecipe;
  className?: string;
  imageClassName?: string;
  eager?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const text = [recipe.title, recipe.tagline, recipe.cuisine, ...(recipe.tags ?? []), ...(recipe.meal_types ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let src = chickenTagine.url;
  if (/breakfast|oat|porridge|pancake|waffle|msemen|baghrir|granola/.test(text)) src = breakfastOats.url;
  if (/yogurt|yoghurt|berry|berries|smoothie|dessert|fruit|chia/.test(text)) src = berryYogurt.url;
  if (/wrap|sandwich|pita|burger|shawarma|taco/.test(text)) src = chickenWrap.url;
  if (/fish|salmon|sardine|tuna|cod|hake|seafood|shrimp|prawn/.test(text)) src = spicedFish.url;
  if (/soup|harira|lentil|chorba|broth/.test(text)) src = lentilSoup.url;
  if (/pasta|spaghetti|noodle|lasagna|macaroni/.test(text)) src = vegetablePasta.url;
  if (/salad|bowl|chickpea|quinoa|couscous|rice|buddha|falafel/.test(text)) src = chickpeaBowl.url;

  const selected = recipe.image_url?.trim() || src;
  const failed = failedSource === selected;

  return (
    <div className={cn("recipe-photo relative overflow-hidden bg-secondary", className)}>
      {failed ? (
        <div className="grid h-full min-h-20 w-full place-items-center bg-butter/35 text-4xl" aria-hidden>
          {recipe.emoji}
        </div>
      ) : (
        <img
          src={selected}
          alt={`${recipe.title} — serving inspiration`}
          className={cn("h-full w-full object-cover", imageClassName)}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailedSource(selected)}
        />
      )}
    </div>
  );
}
