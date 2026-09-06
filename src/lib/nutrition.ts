export type Goal = "lose" | "maintain" | "gain" | "recomp";

export const GOAL_LABELS: Record<Goal, string> = {
  lose: "Lose fat gently",
  maintain: "Stay where I am",
  gain: "Build & gain",
  recomp: "Leaner and stronger",
};

export const ACTIVITY_FACTORS: Record<string, number> = {
  low: 1.35,
  moderate: 1.55,
  high: 1.75,
};

export const ACTIVITY_LABELS: Record<string, string> = {
  low: "Mostly sitting",
  moderate: "Moving a fair bit",
  high: "Very active",
};

export type TargetInput = {
  sex?: string | null;
  age?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  activity_level: string;
  goal: string;
};

export function computeTargets(input: TargetInput) {
  const weight = input.weight_kg ?? 70;
  const height = input.height_cm ?? 170;
  const age = input.age ?? 30;
  const base =
    input.sex === "female"
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5;
  const tdee = base * (ACTIVITY_FACTORS[input.activity_level] ?? 1.55);
  const adjust =
    input.goal === "lose" ? -0.18 : input.goal === "gain" ? 0.13 : input.goal === "recomp" ? -0.07 : 0;
  const floor = input.sex === "female" ? 1400 : 1700; // kind, never crash-diet territory
  const calories = Math.max(floor, Math.round((tdee * (1 + adjust)) / 10) * 10);
  const proteinPerKg = input.goal === "gain" ? 1.9 : input.goal === "lose" ? 2.0 : 1.7;
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((calories * 0.28) / 9);
  const carbs = Math.max(60, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calorie_target: calories, protein_target: protein, carb_target: carbs, fat_target: fat };
}

/** Portion multiplier so a shared dish lands near each person's share of the day. */
export function suggestedPortion(calorieTarget: number, othersTargets: number[]) {
  const all = [calorieTarget, ...othersTargets];
  const avg = all.reduce((a, b) => a + b, 0) / all.length;
  const raw = calorieTarget / avg;
  return Math.round(Math.min(1.6, Math.max(0.6, raw)) * 20) / 20;
}

export const SLOTS = ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  snack_am: "Morning snack",
  lunch: "Lunch",
  snack_pm: "Afternoon snack",
  dinner: "Dinner",
};

export const SLOT_EMOJI: Record<string, string> = {
  breakfast: "\u2615",
  snack_am: "\ud83c\udf4a",
  lunch: "\ud83e\udd57",
  snack_pm: "\ud83c\udf75",
  dinner: "\ud83c\udf72",
};

export const SLOT_SHARE: Record<string, number> = {
  breakfast: 0.24,
  snack_am: 0.08,
  lunch: 0.32,
  snack_pm: 0.08,
  dinner: 0.28,
};

export const SLOT_MEAL_TYPE: Record<string, string> = {
  breakfast: "breakfast",
  snack_am: "snack",
  lunch: "lunch",
  snack_pm: "snack",
  dinner: "dinner",
};

export function scaleMacros(
  recipe: { calories: number; protein: number; carbs: number; fat: number },
  multiplier: number,
) {
  return {
    calories: Math.round(recipe.calories * multiplier),
    protein: Math.round(recipe.protein * multiplier),
    carbs: Math.round(recipe.carbs * multiplier),
    fat: Math.round(recipe.fat * multiplier),
  };
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfWeek(d: Date) {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday start
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function weekDates(start: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function dayLabel(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

export function prettyDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
