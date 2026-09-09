/**
 * Cooking rescue.
 *
 * Instant, offline answers for the things that actually go wrong mid-cook, so
 * Lily replies the moment she's asked instead of making someone wait.
 */

import type { Recipe } from "./db";

export type Rescue = { title: string; steps: string[]; from?: string };

type Rule = { id: string; label: string; words: string[]; title: string; steps: string[] };

export const RESCUES: Rule[] = [
  {
    id: "thick",
    label: "Sauce too thick",
    words: ["thick", "paste", "claggy", "stodgy", "dry sauce"],
    title: "Loosen it, a splash at a time",
    steps: [
      "Off the heat, stir in 2–3 tbsp hot water or stock.",
      "Back on low heat for a minute so it comes together.",
      "Repeat once if needed — never add cold liquid, it dulls the seasoning.",
      "Taste and add a pinch of salt: thinning always mutes the flavour.",
    ],
  },
  {
    id: "thin",
    label: "Sauce too watery",
    words: ["thin", "watery", "runny", "liquid", "soupy"],
    title: "Let it reduce, don't add flour blindly",
    steps: [
      "Uncover the pan and raise the heat to a lively simmer for 4–6 minutes.",
      "Push the ingredients to one side so the liquid has room to steam off.",
      "Still loose? Mash a few pieces of potato, chickpea or tomato into it.",
      "Last resort: 1 tsp cornflour in 1 tbsp cold water, stirred in, 1 minute more.",
    ],
  },
  {
    id: "salty",
    label: "Too salty",
    words: ["salty", "salt", "salé"],
    title: "Dilute and balance",
    steps: [
      "Add something bulky and unsalted: potato chunks, rice, extra tomato or water.",
      "A squeeze of lemon plus ½ tsp sugar or honey rebalances the tongue fast.",
      "A spoon of yoghurt or labneh at serving softens it beautifully.",
      "Serve with plain bread or rice rather than trying to fix it completely.",
    ],
  },
  {
    id: "dry-meat",
    label: "Chicken is dry",
    words: ["dry chicken", "chicken is dry", "dry meat", "tough chicken", "overcooked", "dry"],
    title: "Bring it back with moisture, not more heat",
    steps: [
      "Take it off the heat immediately — more cooking only makes it drier.",
      "Slice it thinly across the grain; thin slices read as tender.",
      "Warm 100 ml stock, water or the pan juices with a knob of butter or olive oil.",
      "Sit the slices in that for 2 minutes, covered, then serve with the sauce over.",
    ],
  },
  {
    id: "burned",
    label: "Burned the onions",
    words: ["burn", "burned", "burnt", "catching", "stuck", "scorched"],
    title: "Save the pan, not the burn",
    steps: [
      "Tip everything unburnt into a clean pan — don't scrape the dark bits in.",
      "Bin the burnt layer; it will flavour the whole dish bitter.",
      "Start a fresh spoon of onion in oil on medium-low if the base is now thin.",
      "A pinch of sugar and a squeeze of lemon rounds off any lingering bitterness.",
    ],
  },
  {
    id: "dough",
    label: "Dough isn't rising",
    words: ["dough", "rise", "rising", "yeast", "flat bread", "msemen"],
    title: "It's almost always the temperature",
    steps: [
      "Move the bowl somewhere genuinely warm (28–30°C) and cover with a damp cloth.",
      "Give it another 30–45 minutes before judging it.",
      "Liquid too hot kills yeast: next time use water you can hold a finger in.",
      "Still flat? Roll it thin and cook it as flatbread — it will be lovely anyway.",
    ],
  },
  {
    id: "bland",
    label: "Tastes bland",
    words: ["bland", "boring", "no taste", "flat", "tasteless"],
    title: "Salt, acid, fat — in that order",
    steps: [
      "A proper pinch of salt first, then taste again.",
      "Then acid: lemon juice or a splash of vinegar wakes everything up.",
      "Then fat: olive oil, butter or yoghurt carries the flavour.",
      "Finish with fresh coriander, parsley or mint and a little cumin.",
    ],
  },
  {
    id: "spicy",
    label: "Too spicy",
    words: ["spicy", "hot", "harissa", "chilli", "piquant"],
    title: "Dairy and starch, not water",
    steps: [
      "Stir in yoghurt, labneh or a little cream.",
      "Add starch to soak it up: rice, bread, potato or couscous alongside.",
      "A teaspoon of honey or sugar takes the edge off.",
      "Serve with cucumber and tomato on the side to cool each bite.",
    ],
  },
  {
    id: "raw",
    label: "Not cooked through",
    words: ["raw", "not cooked", "undercooked", "pink", "hard vegetables"],
    title: "Lid on, heat down",
    steps: [
      "Add 100 ml water or stock, cover, and cook gently for 8–10 more minutes.",
      "Cut the pieces smaller — halved, they cook in half the time.",
      "Chicken is done at firm and white all the way through, juices clear.",
      "Only turn the heat up at the very end, to reduce any liquid you added.",
    ],
  },
  {
    id: "oily",
    label: "Too oily",
    words: ["oily", "greasy", "fat", "huile"],
    title: "Lift the fat off",
    steps: [
      "Let it settle a minute, then spoon the shining layer off the top.",
      "A slice of bread laid on the surface soaks up a surprising amount.",
      "Add a chopped tomato or a little lemon to cut through the richness.",
      "Serve with plain rice, bread or salad rather than more oil.",
    ],
  },
  {
    id: "stuck",
    label: "Sticking to the pan",
    words: ["sticking", "stick", "glued", "catch"],
    title: "Deglaze instead of scraping",
    steps: [
      "Pour in 3–4 tbsp hot water and let it bubble for 30 seconds.",
      "Now the crust lifts on its own — stir it in, it's pure flavour.",
      "Lower the heat one notch and stir every minute from here.",
    ],
  },
];

/** Lily's instant answer to a kitchen emergency, tied to the dish when she can. */
export function rescueFor(problem: string, recipe?: Recipe | null): Rescue | null {
  const needle = problem.trim().toLowerCase();
  if (needle.length < 2) return null;
  const hit =
    RESCUES.find((r) => r.words.some((w) => needle.includes(w))) ??
    RESCUES.find((r) => needle.includes(r.id));
  if (!hit) return null;
  const from = recipe ? `${recipe.title}` : undefined;
  return { title: hit.title, steps: hit.steps, ...(from ? { from } : {}) };
}

/** The handful of problems worth offering as one-tap chips while cooking. */
export function rescueChips(recipe?: Recipe | null) {
  const hay = recipe
    ? [recipe.title, ...recipe.ingredients.map((i) => i.name), ...recipe.steps].join(" ").toLowerCase()
    : "";
  const relevant = RESCUES.filter((r) => {
    if (r.id === "dough") return hay.includes("flour") || hay.includes("dough") || hay.includes("msemen");
    if (r.id === "dry-meat") return !recipe || /chicken|turkey|beef|meat|kefta|mince/.test(hay);
    return true;
  });
  return relevant.slice(0, 8).map((r) => ({ id: r.id, label: r.label }));
}

/** Timers hiding inside a recipe step ("simmer for 12 minutes"). */
export function minutesInStep(step: string): number | null {
  const match = step.toLowerCase().match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(minute|min|hour|hr)/);
  if (!match) return null;
  const value = Number(match[2] ?? match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return match[3]!.startsWith("h") ? value * 60 : value;
}
