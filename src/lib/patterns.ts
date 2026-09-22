/**
 * Lily noticing things on her own.
 *
 * Nothing here asks the cook a question: it reads the plan, the feedback,
 * the events and the logs that already exist and turns them into a few
 * kind observations — and into the rules the planner then follows.
 */

import type { PlanEntry, Recipe } from "./db";
import { eventKind, type HouseholdEvent, type MealFeedback } from "./household";
import { SLOT_LABELS } from "./nutrition";

export type Insight = { text: string; emoji: string };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayOf(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).getDay();
}

function commonest<T>(values: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  let best: { value: T; count: number } | null = null;
  counts.forEach((count, value) => {
    if (!best || count > best.count) best = { value, count };
  });
  return best;
}

/** Weekdays the house is regularly home late — those dinners stay quick. */
export function busyWeekdays(events: HouseholdEvent[], minimum = 2): number[] {
  const days = events.filter((e) => eventKind(e.kind).quick).map((e) => weekdayOf(e.event_date));
  const counts = new Map<number, number>();
  days.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1));
  return [...counts.entries()].filter(([, c]) => c >= minimum).map(([d]) => d);
}

/** The flavours the house keeps loving, taken from their own feedback. */
export function lovedCuisines(feedback: MealFeedback[], recipes: Recipe[]) {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const cuisines = feedback
    .filter((f) => f.rating === "loved" && f.recipe_id)
    .map((f) => byId.get(f.recipe_id!)?.cuisine)
    .filter((c): c is string => !!c);
  const top = commonest(cuisines);
  return top && top.count >= 2 ? top.value : null;
}

export function noticePatterns({
  entries,
  recipes,
  feedback,
  events,
  today,
}: {
  /** Recent and upcoming plan entries. */
  entries: PlanEntry[];
  recipes: Recipe[];
  feedback: MealFeedback[];
  events: HouseholdEvent[];
  today: string;
}): Insight[] {
  const out: Insight[] = [];
  const past = entries.filter((e) => e.plan_date <= today);

  // 1. A dish or style showing up a lot lately.
  const recent = past.slice(-21);
  const styleWords = ["wrap", "bowl", "pasta", "burger", "couscous", "tagine", "salad", "soup"];
  const styles = recent
    .map((e) => e.recipes?.title.toLowerCase() ?? "")
    .map((title) => styleWords.find((w) => title.includes(w)))
    .filter((w): w is string => !!w);
  const style = commonest(styles);
  if (style && style.count >= 3) {
    out.push({
      emoji: "🔁",
      text: `You've had quite a few ${style.value}s lately, so I'll bring in something different.`,
    });
  }

  // 2. Flavours they keep loving.
  const cuisine = lovedCuisines(feedback, recipes);
  if (cuisine) {
    out.push({
      emoji: "❤️",
      text: `You tend to enjoy ${cuisine} flavours — I'll keep including new versions of them.`,
    });
  }

  // 3. Busy weekdays, kept simple.
  const busy = busyWeekdays(events);
  if (busy.length) {
    out.push({
      emoji: "🕗",
      text: `${busy.map((d) => WEEKDAYS[d]).join(" and ")}s are usually busy for you, so I keep those dinners quick and easy.`,
    });
  }

  // 4. Guests becoming a habit.
  const guestDays = events.filter((e) => e.kind === "guests");
  if (guestDays.length >= 2) {
    const day = commonest(guestDays.map((e) => weekdayOf(e.event_date)));
    if (day && day.count >= 2)
      out.push({
        emoji: "👋",
        text: `You often have people over on ${WEEKDAYS[day.value]}s — I'll plan meals that stretch nicely.`,
      });
  }

  // 5. Things that landed badly, quietly retired.
  const never = feedback.filter((f) => f.rating === "never").length;
  if (never)
    out.push({
      emoji: "🌼",
      text: `${never} meal${never === 1 ? "" : "s"} you didn't like ${never === 1 ? "is" : "are"} off your plans for good.`,
    });

  // 6. A meal slot that keeps getting skipped for real life.
  const skipped = events.filter((e) => eventKind(e.kind).skips && e.slot);
  const slot = commonest(skipped.map((e) => e.slot!));
  if (slot && slot.count >= 2)
    out.push({
      emoji: "🍽️",
      text: `You're often out at ${(SLOT_LABELS[slot.value] ?? slot.value).toLowerCase()} — I'll plan lighter around it.`,
    });

  return out.slice(0, 4);
}
