import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Profile, Recipe } from "./db";
import {
  RECORD_TABLES,
  activeRecipes,
  applyRecipeEdit,
  cleanValues,
  findCatalogRecipe,
  findOwnRecipe,
  needsConfirmation,
  planRotation,
  planSpecific,
  type PlanRow,
  type PlannedChange,
  type RecordTable,
} from "./discover-plan";

/**
 * Lily's server-side hands: Discover-recipe planning, household records
 * (create / edit / delete), and undo. Runs as the signed-in user so row
 * security decides what they may touch, then double-checks the household.
 * Every change is logged with the exact rows needed to reverse it.
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slot = z.enum(["breakfast", "snack_am", "lunch", "snack_pm", "dinner"]);
const table = z.enum(Object.keys(RECORD_TABLES) as [RecordTable, ...RecordTable[]]);
const values = z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()]));

export const serverActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan_recipe"), recipe: z.string().min(1).max(120), date, slot }),
  z.object({
    kind: z.literal("rotate_discover"),
    from: date,
    to: date,
    slots: z.array(slot).min(1).max(5).optional(),
    only_empty: z.boolean().optional(),
    tag: z.string().max(40).nullable().optional(),
  }),
  z.object({ kind: z.literal("record_create"), table, values }),
  z.object({
    kind: z.literal("record_update"),
    table,
    id: z.string().uuid().optional(),
    match: z.string().max(120).optional(),
    values,
  }),
  z.object({
    kind: z.literal("record_delete"),
    table,
    id: z.string().uuid().optional(),
    match: z.string().max(120).optional(),
  }),
  z.object({ kind: z.literal("undo_last") }),
  z.object({ kind: z.literal("recipe_create"), recipe: z.lazy(() => recipeSchema) }),
  z.object({ kind: z.literal("recipe_update"), recipe: z.string().min(1).max(120), changes: z.lazy(() => recipeEditSchema) }),
  z.object({ kind: z.literal("recipe_delete"), recipe: z.string().min(1).max(120) }),
]);

export type ServerAction = z.infer<typeof serverActionSchema>;
export const SERVER_KINDS = [
  "plan_recipe",
  "rotate_discover",
  "record_create",
  "record_update",
  "record_delete",
  "undo_last",
  "recipe_create",
  "recipe_update",
  "recipe_delete",
] as const;

type UndoOp = { table: string; op: "delete"; ids: string[] } | { table: string; op: "restore"; rows: Record<string, unknown>[] };

export type ServerActionResult = { kind: string; ok: boolean; message: string };
export type ServerExecResponse =
  | { needsConfirm: true; question: string }
  | { needsConfirm: false; results: ServerActionResult[] };

const NAME_COLUMN: Record<RecordTable, string> = {
  pantry_items: "name",
  grocery_items: "name",
  household_events: "note",
  household_notes: "message",
  prep_batches: "title",
  favorites: "recipe_id",
  food_logs: "description",
  meal_feedback: "note",
  meal_plan_entries: "custom_title",
  ingredient_prices: "name",
};

const LABEL: Record<RecordTable, string> = {
  pantry_items: "kitchen stock",
  grocery_items: "grocery list",
  household_events: "plans",
  household_notes: "household messages",
  prep_batches: "prep batches",
  favorites: "favourites",
  food_logs: "food log",
  meal_feedback: "meal feedback",
  meal_plan_entries: "meal plan",
  ingredient_prices: "prices",
};

export const runLilyServerActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ actions: z.array(serverActionSchema).min(1).max(12), confirmed: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ServerExecResponse> => {
    const sb = context.supabase as unknown as { from: (t: string) => any };
    const userId = context.userId;

    if (!data.confirmed && data.actions.some((a) => needsConfirmation(a))) {
      const a = data.actions.find((x) => needsConfirmation(x))!;
      const question =
        a.kind === "rotate_discover"
          ? `That changes many meals between ${a.from} and ${a.to}. Shall I go ahead?`
          : a.kind === "recipe_delete"
            ? `That deletes "${a.recipe}" from Discover, so I'll never plan it again. Meals you've already cooked keep it. Shall I go ahead?`
            : `That deletes something from your ${LABEL[(a as { table: RecordTable }).table]}. Shall I go ahead?`;
      return { needsConfirm: true, question };
    }

    const { data: me, error: meErr } = await sb.from("profiles").select("household_id").eq("id", userId).single();
    if (meErr || !me) throw new Error("No household found");
    const householdId: string = me.household_id;

    const { data: peopleRows } = await sb.from("profiles").select("*").eq("household_id", householdId);
    const people = (peopleRows ?? []) as Profile[];
    const { data: recipeRows } = await sb.from("recipes").select("*");
    const allRecipes = (recipeRows ?? []) as (Recipe & { archived_at?: string | null })[];
    const recipes = activeRecipes(allRecipes);

    const log = async (kind: string, summary: string, payload: unknown, undo: UndoOp[]) => {
      const { error } = await sb
        .from("lily_action_log")
        .insert([{ household_id: householdId, profile_id: userId, kind, summary, payload, undo }]);
      if (error) console.error("lily log failed", error.message);
    };

    const applyPlanChanges = async (changes: PlannedChange[]) => {
      const rows = changes.map((c) => ({
        household_id: householdId,
        plan_date: c.plan_date,
        slot: c.slot,
        recipe_id: c.recipe.id,
        portions: c.portions,
        custom_title: null,
        cooked: false,
        swaps: {},
      }));
      const { data: saved, error } = await sb
        .from("meal_plan_entries")
        .upsert(rows, { onConflict: "household_id,plan_date,slot" })
        .select("id, plan_date, slot");
      if (error) throw new Error(error.message);
      const restore = changes.map((c) => c.previous).filter(Boolean) as unknown as Record<string, unknown>[];
      const created = (saved ?? [])
        .filter((s: { plan_date: string; slot: string }) => !changes.find((c) => c.plan_date === s.plan_date && c.slot === s.slot)?.previous)
        .map((s: { id: string }) => s.id);
      const undo: UndoOp[] = [];
      if (created.length) undo.push({ table: "meal_plan_entries", op: "delete", ids: created });
      if (restore.length) undo.push({ table: "meal_plan_entries", op: "restore", rows: restore });
      return { count: (saved ?? []).length, undo };
    };

    const loadPlan = async (from: string, to: string) => {
      const { data: rows, error } = await sb
        .from("meal_plan_entries")
        .select("*")
        .eq("household_id", householdId)
        .gte("plan_date", from)
        .lte("plan_date", to);
      if (error) throw new Error(error.message);
      return (rows ?? []) as (PlanRow & Record<string, unknown>)[];
    };

    const findRow = async (t: RecordTable, id?: string, match?: string) => {
      let q = sb.from(t).select("*").eq("household_id", householdId);
      if (id) q = q.eq("id", id);
      else if (match) {
        if (t === "favorites") {
          const r = findCatalogRecipe(recipes, match);
          if (!r) return { error: `I couldn't find "${match}"` };
          q = q.eq("recipe_id", r.id);
        } else q = q.ilike(NAME_COLUMN[t], `%${match.replace(/[%_]/g, "")}%`);
      } else return { error: "Tell me which one" };
      const { data: rows, error } = await q.limit(3);
      if (error) return { error: error.message };
      if (!rows?.length) return { error: `I couldn't find that in your ${LABEL[t]}` };
      if (rows.length > 1 && !id) return { error: `More than one match in your ${LABEL[t]} — which one exactly?` };
      return { row: rows[0] as Record<string, unknown> };
    };

    const results: ServerActionResult[] = [];

    for (const action of data.actions) {
      try {
        switch (action.kind) {
          case "plan_recipe": {
            const recipe = findCatalogRecipe(recipes, action.recipe);
            if (!recipe) {
              results.push({ kind: action.kind, ok: false, message: `"${action.recipe}" isn't in Discover.` });
              break;
            }
            const existing = await loadPlan(action.date, action.date);
            const planned = planSpecific({ recipe, date: action.date, slot: action.slot, people, existing });
            if ("error" in planned) {
              results.push({ kind: action.kind, ok: false, message: `Not saved: ${planned.error}.` });
              break;
            }
            const { undo } = await applyPlanChanges([planned.change]);
            const msg = `${recipe.title} is now ${action.slot.replace("_", " ")} on ${action.date}, portioned for everyone.`;
            await log(action.kind, msg, action, undo);
            results.push({ kind: action.kind, ok: true, message: msg });
            break;
          }
          case "rotate_discover": {
            if (action.to < action.from) throw new Error("End date is before start date");
            const existing = await loadPlan(
              new Date(Date.parse(action.from) - 3 * 86_400_000).toISOString().slice(0, 10),
              action.to,
            );
            const changes = planRotation({
              recipes,
              people,
              existing,
              from: action.from,
              to: action.to,
              slots: action.slots ?? ["lunch", "dinner"],
              onlyEmpty: action.only_empty ?? false,
              tag: action.tag ?? null,
            });
            if (!changes.length) {
              results.push({ kind: action.kind, ok: false, message: "Nothing to change — no suitable swaps found." });
              break;
            }
            const { count, undo } = await applyPlanChanges(changes);
            const distinct = new Set(changes.map((c) => c.recipe.id)).size;
            const msg = `Rotated ${distinct} Discover recipes through ${count} meals (${action.from} → ${action.to}). Cooked meals and other slots untouched.`;
            await log(action.kind, msg, action, undo);
            results.push({ kind: action.kind, ok: true, message: msg });
            break;
          }
          case "record_create": {
            const clean = cleanValues(action.table, action.values);
            if (action.table === "favorites" && typeof action.values["recipe"] === "string") {
              const r = findCatalogRecipe(recipes, action.values["recipe"] as string);
              if (r) clean["recipe_id"] = r.id;
            }
            if (!Object.keys(clean).length) throw new Error("Nothing valid to save");
            const extra: Record<string, unknown> = { household_id: householdId };
            if (["favorites", "food_logs", "meal_feedback"].includes(action.table)) extra["profile_id"] = userId;
            const { data: saved, error } = await sb
              .from(action.table)
              .insert([{ ...clean, ...extra }])
              .select("id")
              .single();
            if (error) throw new Error(error.message);
            const msg = `Added to your ${LABEL[action.table]}.`;
            await log(action.kind, msg, action, [{ table: action.table, op: "delete", ids: [saved.id] }]);
            results.push({ kind: action.kind, ok: true, message: msg });
            break;
          }
          case "record_update": {
            const found = await findRow(action.table, action.id, action.match);
            if ("error" in found) {
              results.push({ kind: action.kind, ok: false, message: `${found.error}.` });
              break;
            }
            const clean = cleanValues(action.table, action.values);
            if (!Object.keys(clean).length) throw new Error("Nothing valid to change");
            const { error } = await sb
              .from(action.table)
              .update(clean)
              .eq("id", found.row["id"])
              .eq("household_id", householdId);
            if (error) throw new Error(error.message);
            const msg = `Updated in your ${LABEL[action.table]}.`;
            await log(action.kind, msg, action, [{ table: action.table, op: "restore", rows: [found.row] }]);
            results.push({ kind: action.kind, ok: true, message: msg });
            break;
          }
          case "record_delete": {
            const found = await findRow(action.table, action.id, action.match);
            if ("error" in found) {
              results.push({ kind: action.kind, ok: false, message: `${found.error}.` });
              break;
            }
            const { error } = await sb
              .from(action.table)
              .delete()
              .eq("id", found.row["id"])
              .eq("household_id", householdId);
            if (error) throw new Error(error.message);
            const msg = `Removed from your ${LABEL[action.table]}.`;
            await log(action.kind, msg, action, [{ table: action.table, op: "restore", rows: [found.row] }]);
            results.push({ kind: action.kind, ok: true, message: msg });
            break;
          }
          case "recipe_create": {
            const row = toRecipeRow(
              { ...action.recipe, picturePath: null },
              householdId,
              userId,
              null,
              "lily",
              "Your own recipe, written with Lily.",
            );
            const { data: saved, error } = await sb.from("recipes").insert([row]).select("*").single();
            if (error || !saved) throw new Error(error?.message ?? "not saved");
            const msg = `Added ${saved.title} to Discover (your Meal Book)`;
            await log(action.kind, msg, { id: saved.id }, [{ table: "recipes", op: "delete", ids: [saved.id] }]);
            results.push({ kind: action.kind, ok: true, message: msg });
            break;
          }
          case "recipe_update": {
            const found = findOwnRecipe(allRecipes, householdId, action.recipe);
            if ("error" in found) {
              results.push({ kind: action.kind, ok: false, message: `${found.error}.` });
              break;
            }
            const before = found.recipe as unknown as Record<string, unknown>;
            const changes = applyRecipeEdit(found.recipe, action.changes);
            if (!Object.keys(changes).length) {
              results.push({ kind: action.kind, ok: false, message: "Tell me what to change." });
              break;
            }
            const { data: upd, error } = await sb
              .from("recipes")
              .update(changes)
              .eq("id", found.recipe.id)
              .eq("household_id", householdId)
              .select("id, title");
            if (error) throw new Error(error.message);
            if (!upd?.length) throw new Error("recipe not updated");
            const msg = `Updated ${upd[0].title} in Discover (${Object.keys(changes).join(", ")})`;
            await log(action.kind, msg, action, [{ table: "recipes", op: "restore", rows: [before] }]);
            results.push({ kind: action.kind, ok: true, message: msg });
            break;
          }
          case "recipe_delete": {
            const found = findOwnRecipe(allRecipes, householdId, action.recipe);
            if ("error" in found) {
              results.push({ kind: action.kind, ok: false, message: `${found.error}.` });
              break;
            }
            const before = found.recipe as unknown as Record<string, unknown>;
            const { data: del, error } = await sb
              .from("recipes")
              .update({ archived_at: new Date().toISOString() })
              .eq("id", found.recipe.id)
              .eq("household_id", householdId)
              .select("id");
            if (error) throw new Error(error.message);
            if (!del?.length) throw new Error("recipe not deleted");
            const today = new Date().toISOString().slice(0, 10);
            const { count } = await sb
              .from("meal_plan_entries")
              .select("id", { count: "exact", head: true })
              .eq("household_id", householdId)
              .eq("recipe_id", found.recipe.id)
              .eq("cooked", false)
              .gte("plan_date", today);
            const msg =
              `Deleted ${found.recipe.title} from Discover — I won't plan it again` +
              (count ? `. It's still on ${count} upcoming meal${count === 1 ? "" : "s"}; ask me to swap ${count === 1 ? "it" : "them"}` : "");
            await log(action.kind, msg, action, [{ table: "recipes", op: "restore", rows: [before] }]);
            results.push({ kind: action.kind, ok: true, message: msg });
            break;
          }
          case "undo_last": {
            const { data: last } = await sb
              .from("lily_action_log")
              .select("*")
              .eq("household_id", householdId)
              .eq("undone", false)
              .neq("kind", "undo_last")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!last) {
              results.push({ kind: action.kind, ok: false, message: "There's nothing of mine to undo." });
              break;
            }
            for (const op of [...(last.undo as UndoOp[])].reverse()) {
              if (!(op.table in RECORD_TABLES) && op.table !== "recipes") continue;
              if (op.op === "delete") {
                const { error } = await sb.from(op.table).delete().in("id", op.ids).eq("household_id", householdId);
                if (error) throw new Error(error.message);
              } else {
                const rows = op.rows.filter((r) => r["household_id"] === householdId);
                if (!rows.length) continue;
                const { error } = await sb.from(op.table).upsert(rows, { onConflict: "id" });
                if (error) throw new Error(error.message);
              }
            }
            await sb.from("lily_action_log").update({ undone: true }).eq("id", last.id);
            const msg = `Undone: ${last.summary}`;
            await log(action.kind, msg, { of: last.id }, []);
            results.push({ kind: action.kind, ok: true, message: msg });
            break;
          }
        }
      } catch (e) {
        console.error("lily action failed", action.kind, e);
        results.push({ kind: action.kind, ok: false, message: "That one didn't save — nothing was changed." });
      }
    }
    return { needsConfirm: false, results };
  });

/* ---------- Personal Meal Book ---------- */

const recipeSchema = z.object({
  picturePath: z.string().max(300).nullable(),
  title: z.string().min(2).max(120),
  tagline: z.string().max(240).default(""),
  cuisine: z.string().max(60).default("Home"),
  meal_types: z.array(z.enum(["breakfast", "lunch", "dinner", "snack", "side"])).min(1).max(4),
  emoji: z.string().max(8).default("🍽️"),
  base_servings: z.number().int().min(1).max(12).default(2),
  prep_minutes: z.number().int().min(0).max(600).default(10),
  cook_minutes: z.number().int().min(0).max(900).default(20),
  difficulty: z.string().max(20).default("easy"),
  ingredients: z
    .array(z.object({ name: z.string().min(1).max(120), amount: z.string().max(60), category: z.string().max(40).default("Other") }))
    .min(1)
    .max(40),
  steps: z.array(z.string().min(1).max(600)).min(1).max(30),
  equipment: z.array(z.string().max(40)).max(12).default([]),
  calories: z.number().min(0).max(3000).default(0),
  protein: z.number().min(0).max(300).default(0),
  carbs: z.number().min(0).max(500).default(0),
  fat: z.number().min(0).max(300).default(0),
  fiber: z.number().min(0).max(100).default(0),
  tags: z.array(z.string().max(40)).max(16).default([]),
});

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "recipe";

export const saveMealBookRecipes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ recipes: z.array(recipeSchema).min(1).max(20) }).parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as { from: (t: string) => any; storage: any };
    const userId = context.userId;
    const { data: me, error: meErr } = await sb.from("profiles").select("household_id").eq("id", userId).single();
    if (meErr || !me) throw new Error("No household found");
    const householdId: string = me.household_id;

    const rows = [];
    for (const r of data.recipes) {
      let image_url: string | null = null;
      if (r.picturePath) {
        if (!r.picturePath.startsWith(`${householdId}/`)) throw new Error("That picture isn't yours");
        const { data: signed, error } = await sb.storage
          .from("lily-images")
          .createSignedUrl(r.picturePath, 60 * 60 * 24 * 365 * 10);
        if (error) throw new Error(error.message);
        image_url = signed.signedUrl;
      }
      rows.push(toRecipeRow(r, householdId, userId, image_url, "lily-picture", "Your own recipe, inspired by your picture."));
    }
    const { data: saved, error } = await sb.from("recipes").insert(rows).select("id, slug, title");
    if (error) throw new Error(error.message);
    const list = (saved ?? []) as { id: string; slug: string; title: string }[];
    if (list.length !== rows.length) throw new Error("Not every recipe saved");
    const summary = `Saved ${list.length} recipe${list.length === 1 ? "" : "s"} to your Meal Book: ${list.map((x) => x.title).join(", ")}`;
    await sb.from("lily_action_log").insert([
      {
        household_id: householdId,
        profile_id: userId,
        kind: "save_recipes",
        summary,
        payload: { ids: list.map((x) => x.id) },
        undo: [{ table: "recipes", op: "delete", ids: list.map((x) => x.id) }],
      },
    ]);
    return { saved: list, message: summary };
  });
