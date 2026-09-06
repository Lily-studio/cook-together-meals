/**
 * Turning a recipe's base quantities into exact per-person quantities,
 * plus friendly ingredient swaps that keep the calories close.
 */

const FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};

function parseLeadingNumber(text: string): { value: number; rest: string } | null {
  const trimmed = text.trim();
  const frac = trimmed.match(/^(\d+)\s*\/\s*(\d+)(.*)$/);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (b) return { value: a / b, rest: frac[3] ?? "" };
  }
  const glyph = trimmed.match(/^([½¼¾⅓⅔])(.*)$/);
  if (glyph) return { value: FRACTIONS[glyph[1]!]!, rest: glyph[2] ?? "" };
  const num = trimmed.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
  if (num) return { value: Number(num[1]!.replace(",", ".")), rest: num[2] ?? "" };
  return null;
}

function pretty(value: number, unit: string) {
  const u = unit.trim();
  const isCount = !/^(g|kg|ml|l|cl)\b/i.test(u);
  if (!isCount) {
    const rounded = value >= 100 ? Math.round(value / 5) * 5 : Math.round(value);
    return `${rounded}${u.startsWith(" ") ? "" : " "}${u}`.trim();
  }
  const rounded = Math.round(value * 2) / 2;
  const shown = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${shown} ${u}`.trim();
}

/** Scale an ingredient amount string ("120 g", "1/2 msemen") by a portion multiplier. */
export function scaleAmount(amount: string, multiplier: number): string {
  if (!amount) return "";
  if (!Number.isFinite(multiplier) || multiplier <= 0) return "—";
  const parsed = parseLeadingNumber(amount);
  if (!parsed) return amount;
  return pretty(parsed.value * multiplier, parsed.rest);
}

/** Grams (or ml) in an amount string, when there are any. */
export function gramsIn(amount: string): number | null {
  const parsed = parseLeadingNumber(amount);
  if (!parsed) return null;
  if (!/^\s*(g|ml)\b/i.test(parsed.rest)) return null;
  return parsed.value;
}

type SwapItem = { name: string; kcal100: number };

/** Groups of everyday Moroccan / Mediterranean ingredients that swap well. */
const SWAP_GROUPS: SwapItem[][] = [
  [
    { name: "Courgette", kcal100: 17 },
    { name: "Carrot", kcal100: 41 },
    { name: "Bell pepper", kcal100: 26 },
    { name: "Green beans", kcal100: 31 },
    { name: "Aubergine", kcal100: 25 },
    { name: "Pumpkin", kcal100: 26 },
    { name: "Cauliflower", kcal100: 25 },
    { name: "Broccoli", kcal100: 34 },
    { name: "Turnip", kcal100: 28 },
    { name: "Tomato", kcal100: 18 },
    { name: "Spinach", kcal100: 23 },
    { name: "Cabbage", kcal100: 25 },
  ],
  [
    { name: "Chicken breast", kcal100: 120 },
    { name: "Chicken thigh", kcal100: 165 },
    { name: "Turkey breast", kcal100: 115 },
    { name: "Lean beef", kcal100: 175 },
    { name: "Sardines", kcal100: 145 },
    { name: "White fish", kcal100: 95 },
    { name: "Tinned tuna", kcal100: 115 },
    { name: "Eggs", kcal100: 143 },
  ],
  [
    { name: "Rice", kcal100: 130 },
    { name: "Couscous", kcal100: 112 },
    { name: "Pasta", kcal100: 131 },
    { name: "Bulgur", kcal100: 120 },
    { name: "Potato", kcal100: 87 },
    { name: "Sweet potato", kcal100: 90 },
    { name: "Bread", kcal100: 265 },
    { name: "Msemen", kcal100: 290 },
  ],
  [
    { name: "Chickpeas", kcal100: 164 },
    { name: "Lentils", kcal100: 116 },
    { name: "White beans", kcal100: 140 },
    { name: "Fava beans", kcal100: 110 },
    { name: "Split peas", kcal100: 118 },
  ],
  [
    { name: "Yoghurt", kcal100: 60 },
    { name: "Fromage frais", kcal100: 70 },
    { name: "Milk", kcal100: 47 },
    { name: "Ricotta", kcal100: 130 },
    { name: "Labneh", kcal100: 150 },
  ],
  [
    { name: "Olive oil", kcal100: 884 },
    { name: "Argan oil", kcal100: 884 },
    { name: "Butter", kcal100: 717 },
    { name: "Almonds", kcal100: 600 },
    { name: "Walnuts", kcal100: 654 },
    { name: "Peanut butter", kcal100: 588 },
  ],
  [
    { name: "Apple", kcal100: 52 },
    { name: "Orange", kcal100: 47 },
    { name: "Banana", kcal100: 89 },
    { name: "Pear", kcal100: 57 },
    { name: "Strawberries", kcal100: 33 },
    { name: "Melon", kcal100: 34 },
    { name: "Dates", kcal100: 282 },
    { name: "Grapes", kcal100: 69 },
  ],
];

function findItem(name: string) {
  const needle = name.trim().toLowerCase();
  for (const group of SWAP_GROUPS) {
    const hit = group.find(
      (item) =>
        needle.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(needle),
    );
    if (hit) return { group, hit };
  }
  return null;
}

export type Swap = { name: string; amount: string; note: string };

/**
 * Suggest replacements for an ingredient, with the quantity adjusted so the
 * calories stay as close as possible to the original.
 */
export function suggestSwaps(name: string, amount: string, max = 4): Swap[] {
  const found = findItem(name);
  if (!found) return [];
  const grams = gramsIn(amount);
  const originalKcal = grams !== null ? (grams * found.hit.kcal100) / 100 : null;

  return found.group
    .filter((item) => item.name.toLowerCase() !== found.hit.name.toLowerCase())
    .slice(0, max)
    .map((item) => {
      if (originalKcal === null || grams === null) {
        return { name: item.name, amount, note: "same quantity" };
      }
      const needed = (originalKcal / item.kcal100) * 100;
      const rounded = needed >= 100 ? Math.round(needed / 5) * 5 : Math.round(needed);
      return {
        name: item.name,
        amount: `${rounded} g`,
        note: `≈ ${Math.round(originalKcal)} kcal, same as before`,
      };
    });
}
