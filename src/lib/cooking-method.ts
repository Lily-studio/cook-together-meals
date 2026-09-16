/**
 * Which machine is in this kitchen.
 *
 * The app is not locked to one gadget: the chosen method nudges recipe
 * selection and gives Lily the right words for the instructions.
 */

import type { Recipe } from "./db";

export type CookingMethod = "regular" | "monsieur_cuisine" | "thermomix" | "custom";

export const COOKING_METHODS: { value: CookingMethod; emoji: string; label: string; hint: string }[] = [
  { value: "regular", emoji: "🍳", label: "Regular kitchen", hint: "Hob, oven and a good pan" },
  {
    value: "monsieur_cuisine",
    emoji: "🤖",
    label: "Monsieur Cuisine",
    hint: "One bowl does the chopping, stirring and cooking",
  },
  { value: "thermomix", emoji: "🌡️", label: "Thermomix", hint: "Guided cooking, precise temperatures" },
  { value: "custom", emoji: "➕", label: "Something else", hint: "Air fryer, slow cooker, rice cooker…" },
];

export function methodOf(profile: { cooking_method?: string | null } | null | undefined): CookingMethod {
  const value = profile?.cooking_method ?? "regular";
  return (COOKING_METHODS.find((m) => m.value === value)?.value ?? "regular") as CookingMethod;
}

export function methodLabel(method: string, note = "") {
  if (method === "custom" && note.trim()) return note.trim();
  return COOKING_METHODS.find((m) => m.value === method)?.label ?? "Regular kitchen";
}

/** Words Lily can pick out of a spoken sentence: "I bought a Thermomix". */
export function methodFromWords(text: string): { method: CookingMethod; note: string } | null {
  const t = text.toLowerCase();
  if (t.includes("thermomix")) return { method: "thermomix", note: "" };
  if (t.includes("monsieur") || t.includes("cuisine connect")) return { method: "monsieur_cuisine", note: "" };
  if (t.includes("air fryer")) return { method: "custom", note: "Air fryer" };
  if (t.includes("slow cooker") || t.includes("crock")) return { method: "custom", note: "Slow cooker" };
  if (t.includes("rice cooker")) return { method: "custom", note: "Rice cooker" };
  if (t.includes("instant pot") || t.includes("pressure cooker")) return { method: "custom", note: "Pressure cooker" };
  if (t.includes("normal kitchen") || t.includes("regular kitchen") || t.includes("just a pan"))
    return { method: "regular", note: "" };
  return null;
}

const MACHINE_FRIENDLY = [
  "soup",
  "stew",
  "tagine",
  "sauce",
  "chilli",
  "chili",
  "risotto",
  "purée",
  "puree",
  "mash",
  "porridge",
  "smoothie",
  "hummus",
  "dip",
  "compote",
  "meatball",
  "kefta",
  "curry",
  "lentil",
  "harira",
];

/** Machine kitchens get one-bowl dishes first; nothing is ever excluded. */
export function methodScore(recipe: Recipe, method: CookingMethod) {
  if (method === "regular" || method === "custom") return 0;
  const hay = [recipe.title, recipe.tagline, ...recipe.tags].join(" ").toLowerCase();
  const machineish = MACHINE_FRIENDLY.some((w) => hay.includes(w));
  const grilled = /grill|barbecue|toast|traybake|bake in the oven/.test(hay);
  return (machineish ? -2 : 0) + (grilled ? 1 : 0);
}

/** One friendly line telling the cook how to run this dish on their machine. */
export function methodNote(recipe: Recipe, method: CookingMethod, note = ""): string | null {
  if (method === "regular") return null;
  const hay = [recipe.title, recipe.tagline, ...recipe.tags].join(" ").toLowerCase();
  const machineish = MACHINE_FRIENDLY.some((w) => hay.includes(w));
  if (method === "custom") {
    const name = note.trim() || "your machine";
    return `Cook this in ${name} if it suits — same ingredients, same finished weight.`;
  }
  const name = method === "thermomix" ? "Thermomix" : "Monsieur Cuisine";
  if (machineish)
    return `${name}: chop the veg on speed 5 for 5 sec, sauté 5 min / 120 °C, then add everything and cook on the stew setting until tender — stir with the paddle so nothing breaks up.`;
  return `${name}: use the bowl for the chopping and any sauce, then finish this one in a pan or the oven so it keeps its colour.`;
}
