import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Lily's control layer.
 *
 * Everything the cook says goes through here once: Lily answers in her own
 * voice AND returns a list of real actions the app then carries out against
 * the database. Nothing is pretended — if she says she saved it, an action
 * came back with it.
 */

const inputSchema = z.object({
  context: z.string().max(9000),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(30),
});

export type LilyAction =
  | { kind: "remember_avoid"; value: string }
  | { kind: "forget_avoid"; value: string }
  | { kind: "remember_prefer"; value: string }
  | { kind: "remember_note"; value: string }
  | { kind: "set_cooking_method"; value: string; note?: string }
  | { kind: "pantry_add"; name: string; quantity?: number; unit?: string; expires_on?: string; opened?: boolean }
  | { kind: "pantry_remove"; name: string }
  | { kind: "grocery_add"; name: string; amount?: string }
  | { kind: "grocery_remove"; name: string }
  | { kind: "replace_meal"; date: string; slot: string; mode?: string }
  | { kind: "regenerate_day"; date: string }
  | { kind: "clear_meal"; date: string; slot: string }
  | { kind: "log_food"; description: string; calories: number; protein?: number; carbs?: number; fat?: number; slot?: string }
  | { kind: "favorite"; title: string }
  | { kind: "prep_add"; title: string; portions?: number }
  | { kind: "navigate"; to: string; label: string }
  | { kind: "delete_month_plan" };

export type LilyReply = { reply: string; actions: LilyAction[] } | { error: string };

const SYSTEM = `You are Lily: the warm Moroccan-Mediterranean cooking companion who RUNS the "Cook with Lily" app for this household.
You are not only a chatbot — you can actually change the app. Reply with JSON only:
{"reply": string, "actions": Action[]}

"reply" is your own warm voice, max 70 words, no markdown, no lists of technical detail. Confirm plainly what you just changed.
"actions" is what the app must really do. Use [] when the person only asked a question.

Allowed actions (copy the shapes exactly):
{"kind":"remember_avoid","value":"carrot sticks"}            lasting "never / don't give me / I don't like / avoid"
{"kind":"forget_avoid","value":"carrots"}                    they changed their mind and want it back
{"kind":"remember_prefer","value":"chicken"}                 "use more X", "I prefer X"
{"kind":"remember_note","value":"prefers spicy food"}        any other lasting instruction worth remembering
{"kind":"set_cooking_method","value":"regular|monsieur_cuisine|thermomix|custom","note":"Air fryer"}
{"kind":"pantry_add","name":"Yoghurt","quantity":2,"unit":"pc","expires_on":"2026-10-04","opened":true}
{"kind":"pantry_remove","name":"Yoghurt"}                    thrown away / finished / expired
{"kind":"grocery_add","name":"Chicken thighs","amount":"600 g"}
{"kind":"grocery_remove","name":"Rice"}
{"kind":"replace_meal","date":"2026-09-16","slot":"lunch","mode":"same_calories|cheaper|faster|easier|pantry|different"}
{"kind":"regenerate_day","date":"2026-09-16"}                 they want ALL of one day's meals changed
{"kind":"clear_meal","date":"2026-09-16","slot":"snack_pm"}
{"kind":"log_food","description":"Msemen with honey","calories":420,"protein":8,"carbs":60,"fat":16,"slot":"breakfast"}
{"kind":"favorite","title":"Chicken Shawarma Wrap"}
{"kind":"prep_add","title":"Turkey meatballs","portions":4}
{"kind":"navigate","to":"/grocery","label":"Open grocery list"}
{"kind":"delete_month_plan"}                                  only if they clearly ask to wipe the whole plan

Slots are exactly: breakfast, snack_am, lunch, snack_pm, dinner.
Pages you may navigate to: /today /week /month /grocery /pantry /prep /favorites /discover /tell-lily /lily /settings
Dates are always YYYY-MM-DD. Use the TODAY value from the kitchen summary to resolve "today", "tomorrow", "tonight", "Friday".

Rules:
- Never invent a change you did not put in "actions".
- Prefer doing it over explaining where to click. When they only ask where something is, add a navigate action.
- "I don't like today's lunch" → one replace_meal for that slot only, never the whole day.
- Pair a change with a navigate action when seeing it helps.
- Add units in grocery amounts (g, kg, ml, L, pieces).
- Answer questions about the plan, pantry or targets from the kitchen summary. If it isn't in there, say you don't know instead of guessing.`;

export const lilyCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<LilyReply> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "Lily's kitchen radio isn't connected yet." };

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.7-flash",
          messages: [
            { role: "system", content: `${SYSTEM}\n\nKITCHEN SUMMARY:\n${data.context}` },
            ...data.messages,
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (response.status === 429) return { error: "So many things at once! Give me a minute." };
      if (response.status === 402 || response.status === 403)
        return { error: "Lily's AI credits have run out — top them up to keep going." };
      if (!response.ok) return { error: "I couldn't think straight just now — try again?" };

      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) return { error: "I couldn't think straight just now — try again?" };

      const parsed = JSON.parse(content) as { reply?: string; actions?: unknown };
      const actions = Array.isArray(parsed.actions)
        ? (parsed.actions.filter(
            (a) => a && typeof a === "object" && typeof (a as { kind?: unknown }).kind === "string",
          ) as LilyAction[]).slice(0, 12)
        : [];
      return {
        reply: (parsed.reply ?? "Done 🌼").slice(0, 1200),
        actions,
      };
    } catch {
      return { error: "Something went wrong in the kitchen — try again?" };
    }
  });
