/**
 * The whole house, and real life.
 *
 * Any number of people, guests who come and go, days when nobody's home,
 * quick feedback after a meal, and little messages anyone in the house can
 * leave for Lily. All of it lives in the database and feeds the planning.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { from: (table: string) => any };

/* ---------------- real life ---------------- */

export type HouseholdEvent = {
  id: string;
  household_id: string;
  event_date: string;
  /** null = the whole day */
  slot: string | null;
  kind: string;
  guests: number;
  note: string;
};

export type EventKind = {
  value: string;
  label: string;
  emoji: string;
  hint: string;
  /** Nobody eats at home for that meal, so Lily leaves it out of the plan. */
  skips: boolean;
  /** Lily keeps that meal as fast as she can. */
  quick: boolean;
  /** Asks for a number of extra people. */
  counts: boolean;
};

export const EVENT_KINDS: EventKind[] = [
  {
    value: "eating_out",
    label: "Eating out",
    emoji: "🍽️",
    hint: "Restaurant, family, takeaway — no cooking at home",
    skips: true,
    quick: false,
    counts: false,
  },
  {
    value: "away",
    label: "Not home",
    emoji: "✈️",
    hint: "Travelling, at work, out all day",
    skips: true,
    quick: false,
    counts: false,
  },
  {
    value: "late",
    label: "Home late",
    emoji: "🕗",
    hint: "Lily keeps it to something really quick",
    skips: false,
    quick: true,
    counts: false,
  },
  {
    value: "guests",
    label: "Guests coming",
    emoji: "👋",
    hint: "Extra plates, just this once",
    skips: false,
    quick: false,
    counts: true,
  },
];

export function eventKind(value: string): EventKind {
  return EVENT_KINDS.find((k) => k.value === value) ?? EVENT_KINDS[3]!;
}

export function eventLabel(event: HouseholdEvent) {
  const kind = eventKind(event.kind);
  if (kind.counts) return `${kind.label} (+${event.guests})`;
  return kind.label;
}

export function useEvents(householdId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["events", householdId, from, to],
    enabled: !!householdId,
    queryFn: async (): Promise<HouseholdEvent[]> => {
      const { data, error } = await db
        .from("household_events")
        .select("*")
        .eq("household_id", householdId)
        .gte("event_date", from)
        .lte("event_date", to)
        .order("event_date");
      if (error) throw error;
      return (data ?? []) as HouseholdEvent[];
    },
  });
}

export function useEventMutations(householdId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["events"] });

  const add = useMutation({
    mutationFn: async (event: {
      event_date: string;
      slot?: string | null;
      kind: string;
      guests?: number;
      note?: string;
    }) => {
      const { error } = await db.from("household_events").insert([
        {
          household_id: householdId,
          event_date: event.event_date,
          slot: event.slot ?? null,
          kind: event.kind,
          guests: Math.max(0, Math.round(event.guests ?? 0)),
          note: event.note ?? "",
        },
      ]);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("household_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setGuests = useMutation({
    mutationFn: async ({
      event_date,
      slot,
      guests,
      note,
    }: {
      event_date: string;
      slot?: string | null;
      guests: number;
      note?: string;
    }) => {
      const query = db
        .from("household_events")
        .select("id")
        .eq("household_id", householdId)
        .eq("event_date", event_date)
        .eq("kind", "guests");
      const { data } = slot ? await query.eq("slot", slot) : await query.is("slot", null);
      const existing = (data ?? [])[0] as { id: string } | undefined;

      if (guests <= 0) {
        if (existing) {
          const { error } = await db.from("household_events").delete().eq("id", existing.id);
          if (error) throw error;
        }
        return;
      }
      if (existing) {
        const { error } = await db
          .from("household_events")
          .update({ guests: Math.round(guests), ...(note ? { note } : {}) })
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await db.from("household_events").insert([
        {
          household_id: householdId,
          event_date,
          slot: slot ?? null,
          kind: "guests",
          guests: Math.round(guests),
          note: note ?? "",
        },
      ]);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, remove, setGuests };
}

/** Events that touch one meal (either that exact meal, or the whole day). */
export function eventsFor(events: HouseholdEvent[], date: string, slot?: string) {
  return events.filter(
    (e) => e.event_date === date && (e.slot === null || !slot || e.slot === slot),
  );
}

/** Extra plates for one meal — guests, and nothing permanent. */
export function guestsFor(events: HouseholdEvent[], date: string, slot?: string) {
  return eventsFor(events, date, slot)
    .filter((e) => e.kind === "guests")
    .reduce((a, e) => a + e.guests, 0);
}

/** Nobody's eating at home for this one. */
export function mealSkipped(events: HouseholdEvent[], date: string, slot: string) {
  return eventsFor(events, date, slot).some((e) => eventKind(e.kind).skips);
}

/** Lily should keep this meal fast. */
export function mealShouldBeQuick(events: HouseholdEvent[], date: string, slot: string) {
  return eventsFor(events, date, slot).some((e) => eventKind(e.kind).quick);
}

/* ---------------- what actually worked ---------------- */

export type MealFeedback = {
  id: string;
  household_id: string;
  profile_id: string;
  recipe_id: string | null;
  plan_date: string | null;
  slot: string | null;
  rating: string;
  note: string;
};

export const RATINGS: { value: string; label: string; emoji: string }[] = [
  { value: "loved", label: "Loved it", emoji: "❤️" },
  { value: "okay", label: "It was okay", emoji: "🙂" },
  { value: "never", label: "Never again", emoji: "❌" },
];

export function useFeedback(householdId: string | undefined) {
  return useQuery({
    queryKey: ["feedback", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<MealFeedback[]> => {
      const { data, error } = await db
        .from("meal_feedback")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MealFeedback[];
    },
  });
}

export function useRateMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      household_id: string;
      profile_id: string;
      recipe_id: string;
      plan_date: string;
      slot: string;
      rating: string;
    }) => {
      const { error } = await db
        .from("meal_feedback")
        .upsert([row], { onConflict: "household_id,profile_id,recipe_id,plan_date,slot" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback"] }),
  });
}

/** Which recipes the house loved, and which ones never to serve again. */
export function feedbackSplit(feedback: MealFeedback[]) {
  const never = new Set<string>();
  const loved = new Set<string>();
  feedback.forEach((f) => {
    if (!f.recipe_id) return;
    if (f.rating === "never") never.add(f.recipe_id);
    if (f.rating === "loved") loved.add(f.recipe_id);
  });
  // "Never again" always wins over an earlier "loved it".
  never.forEach((id) => loved.delete(id));
  return { never: [...never], loved: [...loved] };
}

/* ---------------- shared household ---------------- */

export type HouseholdNote = {
  id: string;
  household_id: string;
  from_name: string;
  about_profile: string | null;
  message: string;
  handled: boolean;
  created_at: string;
};

export function useHouseholdNotes(householdId: string | undefined) {
  return useQuery({
    queryKey: ["household-notes", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<HouseholdNote[]> => {
      const { data, error } = await db
        .from("household_notes")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HouseholdNote[];
    },
  });
}

export function useNoteMutations(householdId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["household-notes"] });

  const add = useMutation({
    mutationFn: async (note: { from_name: string; message: string; about_profile?: string | null }) => {
      const { error } = await db.from("household_notes").insert([
        {
          household_id: householdId,
          from_name: note.from_name,
          message: note.message,
          about_profile: note.about_profile ?? null,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setHandled = useMutation({
    mutationFn: async ({ id, handled }: { id: string; handled: boolean }) => {
      const { error } = await db.from("household_notes").update({ handled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("household_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, setHandled, remove };
}
