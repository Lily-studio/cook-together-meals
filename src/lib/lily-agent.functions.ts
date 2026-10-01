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

const attachmentSchema = z.object({
  name: z.string().min(1).max(160),
  mime: z.string().max(120),
  kind: z.enum(["image", "text", "file"]),
  // image/file: a data: URL; text: the file's text.
  data: z.string().min(1).max(7_000_000),
});
export type LilyAttachment = z.infer<typeof attachmentSchema>;

const pictureSchema = z.object({
  n: z.number().int().min(1).max(20),
  name: z.string().max(160),
  url: z.string().url().max(2000),
});
export type LilyPicture = z.infer<typeof pictureSchema>;

const inputSchema = z.object({
  context: z.string().max(9000),
  attachments: z.array(attachmentSchema).max(4).optional(),
  pictures: z.array(pictureSchema).max(20).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
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
  | { kind: "add_event"; date: string; event: string; slot?: string; guests?: number; note?: string }
  | { kind: "set_guests"; date: string; slot?: string; guests: number }
  | { kind: "household_note"; message: string; from?: string }
  | { kind: "rate_meal"; date: string; slot: string; rating: string; note?: string }
  | { kind: "delete_month_plan" }
  | { kind: "plan_recipe"; recipe: string; date: string; slot: string }
  | { kind: "rotate_discover"; from: string; to: string; slots?: string[]; only_empty?: boolean; tag?: string | null }
  | { kind: "record_create"; table: string; values: Record<string, string | number | boolean | null> }
  | { kind: "record_update"; table: string; id?: string; match?: string; values: Record<string, string | number | boolean | null> }
  | { kind: "record_delete"; table: string; id?: string; match?: string }
  | { kind: "undo_last" }
  | { kind: "recipe_create"; recipe: Omit<ProposedRecipe, "picture" | "uncertain"> }
  | { kind: "recipe_update"; recipe: string; changes: Record<string, string | number | string[] | { from: string; to: string } | { name: string; amount: string }[]> }
  | { kind: "recipe_delete"; recipe: string }
  | { kind: "propose_recipes"; recipes: ProposedRecipe[] };

export type ProposedRecipe = {
  picture: number | null;
  title: string;
  tagline: string;
  cuisine: string;
  meal_types: string[];
  emoji: string;
  base_servings: number;
  prep_minutes: number;
  cook_minutes: number;
  difficulty: string;
  ingredients: { name: string; amount: string; category: string }[];
  steps: string[];
  equipment: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  tags: string[];
  uncertain: string[];
};

export type LilyReply = { reply: string; actions: LilyAction[] } | { error: string };

const SYSTEM = `You are Lily: the warm Moroccan-Mediterranean cooking companion who RUNS the "Cook with Lily" app for this household.
You are not only a chatbot — you can actually change the app. Reply with JSON only:
{"reply": string, "actions": Action[]}

"reply" is your own warm voice, max 70 words (up to 220 when describing pictures), no markdown, no lists of technical detail. Confirm plainly what you just changed.
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
{"kind":"add_event","date":"2026-09-18","event":"eating_out|away|late|guests","slot":"dinner","guests":2,"note":"My parents are coming"}
{"kind":"set_guests","date":"2026-09-18","slot":"dinner","guests":3}   extra plates for one meal only
{"kind":"household_note","message":"Nabil doesn't want this tonight","from":"Nabil"}
{"kind":"rate_meal","date":"2026-09-16","slot":"dinner","rating":"loved|okay|never_again","note":""}
{"kind":"delete_month_plan"}                                  only if they clearly ask to wipe the whole plan
{"kind":"plan_recipe","recipe":"chicken-shawarma-wrap","date":"2026-09-18","slot":"lunch"}   put one Discover recipe (use its slug from the CATALOG) into one slot
{"kind":"rotate_discover","from":"2026-09-20","to":"2026-10-03","slots":["lunch","dinner"],"only_empty":false,"tag":null}   rotate ALL suitable Discover recipes through future meals; tag narrows it (e.g. "air-fryer", "Italian")
{"kind":"record_create","table":"pantry_items","values":{"name":"Eggs","quantity":12,"unit":"pc"}}
{"kind":"record_update","table":"prep_batches","match":"meatballs","values":{"portions_left":2}}
{"kind":"record_delete","table":"household_events","match":"parents"}
{"kind":"recipe_create","recipe":{"title":"...","tagline":"...","cuisine":"Moroccan","meal_types":["dinner"],"emoji":"🍲","base_servings":2,"prep_minutes":10,"cook_minutes":25,"difficulty":"easy","ingredients":[{"name":"Turkey mince","amount":"400 g","category":"Meat & fish"}],"steps":["..."],"equipment":["pan"],"calories":550,"protein":40,"carbs":45,"fat":18,"fiber":6,"tags":["high-protein"]}}   save a complete new recipe straight into Discover when they ask you to create/add one (not from pictures)
{"kind":"recipe_update","recipe":"<slug from CATALOG marked MINE>","changes":{"calories":520,"title":"...","replace_ingredient":{"from":"chicken","to":"turkey"},"equipment":["monsieur cuisine"],"steps":["..."],"ingredients":[{"name":"...","amount":"..."}]}}   only include fields that change
{"kind":"recipe_delete","recipe":"<slug marked MINE>"}   the app asks for confirmation; cooked history is kept
{"kind":"undo_last"}                                          "undo that", "put it back", "that was a mistake"
{"kind":"propose_recipes","recipes":[{"picture":1,"title":"...","tagline":"...","cuisine":"Moroccan","meal_types":["lunch","dinner"],"emoji":"🍗","base_servings":2,"prep_minutes":10,"cook_minutes":25,"difficulty":"easy","ingredients":[{"name":"Chicken thighs","amount":"500 g","category":"Meat & fish"}],"steps":["..."],"equipment":["oven"],"calories":560,"protein":42,"carbs":45,"fat":20,"fiber":6,"tags":["high-protein","complete-meal"],"uncertain":["sauce looks like harissa yoghurt — guessed"]}]}   DRAFT original recipes inspired by pictures; the app shows them for approval and saves nothing until the person approves
Record tables and columns: pantry_items(name,category,quantity,unit,low_threshold,staple,opened_on,expires_on) grocery_items(name,amount,category,checked,week_start) household_events(event_date,slot,kind,guests,note) household_notes(from_name,message,handled) prep_batches(title,portions_total,portions_left,prepared_on,best_before,note) favorites(recipe) food_logs(log_date,slot,description,calories,protein,carbs,fat) meal_feedback(plan_date,slot,rating,note) ingredient_prices(name,unit,pack_size,price,currency). "match" is a word from the row's name/title/message.

Slots are exactly: breakfast, snack_am, lunch, snack_pm, dinner. Leave "slot" out of an event when it covers the whole day.
Pages you may navigate to: /today /week /month /grocery /pantry /prep /kitchen /household /favorites /discover /tell-lily /lily /settings
Dates are always YYYY-MM-DD. Use the TODAY value from the kitchen summary to resolve "today", "tomorrow", "tonight", "Friday".

Rules:
- Never invent a change you did not put in "actions".
- Prefer doing it over explaining where to click. When they only ask where something is, add a navigate action.
- "I don't like today's lunch" → one replace_meal for that slot only, never the whole day.
- Pair a change with a navigate action when seeing it helps.
- Add units in grocery amounts (g, kg, ml, L, pieces).
- "I'm eating out Friday", "working late Tuesday", "guests Saturday", "not home for lunch" → add_event for just that day and slot; do not touch the rest of the plan.
- "my parents are coming for dinner tonight" → set_guests (plus add_event only if they want it remembered as a plan).
- Someone in the house passing on a message or a preference → household_note, and remember_avoid too only if it's lasting.
- Only use recipes that exist in the CATALOG for plan_recipe; the app checks allergies, avoids, targets and portions and will refuse unsuitable ones — say "I'll try" rather than promising.
- Only recipes marked MINE in the CATALOG can be edited or deleted. To change a shared recipe, recipe_create a personal copy with the changes. "Replace today's lunch with <recipe>" → plan_recipe for that one slot only.
- The app confirms deletes and rotations with the person itself; still describe what will change.
- ATTACHMENTS: when the person attaches images or files, look at them carefully and use them as context. Identify foods and ingredients, read recipes and documents, use photos as inspiration (suggest the closest CATALOG recipe). Only turn them into actions when asked (e.g. "add these to my pantry" → record_create or pantry_add per item).
- PICTURES are numbered for the whole conversation (Picture 1, Picture 2 …). "the third picture" = Picture 3; "the second recipe" = the 2nd recipe in your most recent propose_recipes list.
- When asked to analyse food pictures or turn them into recipes: in "reply", briefly name each meal, its style/cuisine and meal type, and what you're unsure of. If something important can't be seen (e.g. the protein, or whether it's fried), ask ONE short question before proposing. Otherwise return propose_recipes with ORIGINAL recipes (never copy a known recipe), one per picture unless told otherwise, with realistic grams, per-serving nutrition estimates, steps, times, equipment, and categories. meal_types from breakfast/lunch/dinner/snack. Lunch/dinner recipes must be complete meals (a protein + a base) and lunch needs chicken, turkey or minced meat. When the person corrects a proposal, send the full corrected propose_recipes list again. Never claim a recipe is saved — the person saves it with the button.
- Answer questions about the plan, pantry or targets from the kitchen summary. If it isn't in there, say you don't know instead of guessing.`;

export const lilyCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<LilyReply> => {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) return { error: "Lily's kitchen radio isn't connected yet." };

    const sb = context.supabase as unknown as { from: (t: string) => any };
    const { data: recipes } = await sb
      .from("recipes")
      .select("slug, title, meal_types, calories, protein, tags, cuisine, household_id")
      .is("archived_at", null);
    const catalog = ((recipes ?? []) as { slug: string; title: string; meal_types: string[]; calories: number; protein: number; tags: string[]; cuisine: string; household_id: string | null }[])
      .map((r) => `${r.household_id ? "MINE " : ""}${r.slug} | ${r.title} | ${r.meal_types.join("/")} | ${r.calories} kcal ${r.protein} g protein | ${r.cuisine} | ${r.tags.slice(0, 5).join(",")}`)
      .join("\n");

    const attachments = data.attachments ?? [];
    const pictures = data.pictures ?? [];
    const lastUser = data.messages.length - 1;
    const input = [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: `${SYSTEM}\n\nAnswer in json.\n\nKITCHEN SUMMARY:\n${data.context}\n\nDISCOVER CATALOG (slug | title | meal types | per serving | cuisine | tags):\n${catalog}`,
          },
        ],
      },
      ...data.messages.map((m, i) => {
        if (m.role === "assistant") return { role: "assistant", content: [{ type: "output_text", text: m.content }] };
        const parts: Record<string, unknown>[] = [{ type: "input_text", text: m.content }];
        if (i === lastUser) {
          for (const p of pictures) {
            parts.push({ type: "input_text", text: `Picture ${p.n} (${p.name}):` });
            parts.push({ type: "input_image", image_url: p.url });
          }
          for (const a of attachments) {
            if (a.kind === "image") parts.push({ type: "input_image", image_url: a.data });
            else if (a.kind === "text")
              parts.push({ type: "input_text", text: `ATTACHED FILE "${a.name}":\n${a.data.slice(0, 60_000)}` });
            else parts.push({ type: "input_file", filename: a.name, file_data: a.data });
          }
        }
        return { role: "user", content: parts };
      }),
    ];

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input,
          stream: true,
          store: false,
          text: { format: { type: "json_object" } },
        }),
      });

      if (response.status === 429) return { error: "So many things at once! Give me a minute." };
      if (response.status === 402 || (response.status === 429 && /quota/i.test(await response.clone().text())))
        return { error: "Your OpenAI account is out of credit — add some at platform.openai.com → Billing." };
      if (response.status === 403) return { error: "Your OpenAI key was refused — check it in the app secrets." };
      if (!response.ok || !response.body) {
        console.error("lily gateway", response.status, await response.text().catch(() => ""));
        return { error: "I couldn't think straight just now — try again?" };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const ev = JSON.parse(raw) as { type?: string; delta?: string };
            if (ev.type === "response.output_text.delta" && ev.delta) content += ev.delta;
          } catch {
            /* partial event */
          }
        }
      }
      content = content.trim();
      if (!content) return { error: "I couldn't think straight just now — try again?" };

      const parsed = JSON.parse(content) as { reply?: string; actions?: unknown };
      const actions = Array.isArray(parsed.actions)
        ? (parsed.actions.filter(
            (a) => a && typeof a === "object" && typeof (a as { kind?: unknown }).kind === "string",
          ) as LilyAction[]).slice(0, 12)
        : [];
      return {
        reply: (parsed.reply ?? "Done 🌼").slice(0, 2000),
        actions,
      };
    } catch (e) {
      console.error("lily command failed", e);
      return { error: "Something went wrong in the kitchen — try again?" };
    }
  });
