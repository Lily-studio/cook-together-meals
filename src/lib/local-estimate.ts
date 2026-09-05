import type { Estimate } from "./lily.functions";

type Food = {
  keys: string[];
  label: string;
  per: number; // grams-ish reference portion
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const FOODS: Food[] = [
  { keys: ["tagine"], label: "tagine", per: 1, calories: 480, protein: 35, carbs: 20, fat: 28 },
  { keys: ["couscous"], label: "couscous", per: 1, calories: 420, protein: 16, carbs: 62, fat: 10 },
  { keys: ["harira", "soup", "chorba"], label: "harira", per: 1, calories: 260, protein: 14, carbs: 40, fat: 5 },
  { keys: ["bessara"], label: "bessara", per: 1, calories: 290, protein: 18, carbs: 40, fat: 7 },
  { keys: ["msemen", "harcha", "baghrir"], label: "msemen", per: 1, calories: 260, protein: 6, carbs: 34, fat: 11 },
  { keys: ["khobz", "bread", "baguette", "batbout", "pitta"], label: "bread", per: 1, calories: 150, protein: 5, carbs: 29, fat: 1 },
  { keys: ["egg"], label: "egg", per: 1, calories: 78, protein: 6, carbs: 1, fat: 5 },
  { keys: ["chicken"], label: "chicken", per: 1, calories: 230, protein: 30, carbs: 0, fat: 11 },
  { keys: ["beef", "kefta", "lamb", "meat"], label: "kefta", per: 1, calories: 300, protein: 26, carbs: 2, fat: 21 },
  { keys: ["sardine", "fish", "tuna"], label: "fish", per: 1, calories: 210, protein: 24, carbs: 0, fat: 12 },
  { keys: ["lentil"], label: "lentils", per: 1, calories: 230, protein: 15, carbs: 36, fat: 2 },
  { keys: ["chickpea", "hummus"], label: "chickpeas", per: 1, calories: 240, protein: 12, carbs: 34, fat: 6 },
  { keys: ["rice"], label: "rice", per: 1, calories: 260, protein: 6, carbs: 55, fat: 2 },
  { keys: ["pasta", "spaghetti", "vermicelli"], label: "pasta", per: 1, calories: 320, protein: 11, carbs: 62, fat: 3 },
  { keys: ["salad", "zaalouk", "taktouka"], label: "salad", per: 1, calories: 130, protein: 3, carbs: 12, fat: 8 },
  { keys: ["yoghurt", "yogurt", "raib"], label: "yoghurt", per: 1, calories: 140, protein: 9, carbs: 14, fat: 5 },
  { keys: ["milk", "coffee", "nous nous", "latte"], label: "milky drink", per: 1, calories: 110, protein: 6, carbs: 11, fat: 4 },
  { keys: ["tea", "atay"], label: "mint tea", per: 1, calories: 45, protein: 0, carbs: 11, fat: 0 },
  { keys: ["date"], label: "dates", per: 1, calories: 70, protein: 1, carbs: 18, fat: 0 },
  { keys: ["almond", "nut", "walnut", "peanut"], label: "nuts", per: 1, calories: 180, protein: 6, carbs: 6, fat: 15 },
  { keys: ["olive oil", "butter", "smen"], label: "fat", per: 1, calories: 110, protein: 0, carbs: 0, fat: 12 },
  { keys: ["olive"], label: "olives", per: 1, calories: 90, protein: 1, carbs: 2, fat: 9 },
  { keys: ["cheese", "jben"], label: "cheese", per: 1, calories: 160, protein: 10, carbs: 2, fat: 12 },
  { keys: ["orange", "apple", "banana", "fruit", "melon"], label: "fruit", per: 1, calories: 90, protein: 1, carbs: 22, fat: 0 },
  { keys: ["avocado"], label: "avocado", per: 1, calories: 220, protein: 3, carbs: 12, fat: 18 },
  { keys: ["cookie", "biscuit", "cake", "chebakia", "pastry", "sfenj"], label: "sweet", per: 1, calories: 250, protein: 3, carbs: 34, fat: 12 },
  { keys: ["chocolate"], label: "chocolate", per: 1, calories: 210, protein: 3, carbs: 24, fat: 12 },
  { keys: ["soda", "juice", "cola"], label: "sweet drink", per: 1, calories: 140, protein: 0, carbs: 35, fat: 0 },
  { keys: ["potato", "fries", "batata"], label: "potatoes", per: 1, calories: 280, protein: 5, carbs: 40, fat: 11 },
  { keys: ["msemen with honey", "honey"], label: "honey", per: 1, calories: 65, protein: 0, carbs: 17, fat: 0 },
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5,
};

function quantityNear(text: string, index: number) {
  const before = text.slice(Math.max(0, index - 22), index);
  const digit = before.match(/(\d+(?:[.,]\d+)?)\s*\S*$/);
  if (digit?.[1]) return Math.min(6, parseFloat(digit[1]!.replace(",", ".")) || 1);
  const words = before.trim().split(/\s+/).slice(-2);
  for (const w of words) {
    const val = NUMBER_WORDS[w.toLowerCase()];
    if (val) return val;
  }
  return 1;
}

/** Offline fallback so Tell Lily always returns a usable estimate. */
export function localEstimate(text: string): Estimate {
  const lower = ` ${text.toLowerCase()} `;
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  const found: string[] = [];

  for (const food of FOODS) {
    const hitKey = food.keys.find((k) => lower.includes(k));
    if (!hitKey) continue;
    const qty = quantityNear(lower, lower.indexOf(hitKey));
    calories += food.calories * qty;
    protein += food.protein * qty;
    carbs += food.carbs * qty;
    fat += food.fat * qty;
    found.push(food.label);
    if (found.length >= 5) break;
  }

  const big = /\b(big|large|double|generous|two plates)\b/.test(lower);
  const small = /\b(small|light|little|half)\b/.test(lower);
  const factor = big ? 1.3 : small ? 0.7 : 1;

  if (!found.length) {
    calories = 350;
    protein = 15;
    carbs = 40;
    fat = 13;
  }

  return {
    description: text.trim().slice(0, 80),
    calories: Math.round((calories * factor) / 5) * 5,
    protein: Math.round(protein * factor),
    carbs: Math.round(carbs * factor),
    fat: Math.round(fat * factor),
    note: found.length
      ? `I read this as ${found.join(", ")}. Adjust anything that looks off.`
      : "I wasn't sure about this one, so here's a typical plate. Tweak it freely.",
  };
}
