/**
 * Carrying out what Lily promised.
 *
 * Every action that comes back from `lilyCommand` is executed here against
 * the real database, with the real rules — preferences, pantry, plan,
 * groceries, prep, logs and settings. Nothing is simulated.
 */

import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/components/app-context";
import type { LilyAction } from "./lily-agent.functions";
import { thisWeekStart, useRecipes, type Profile, type Recipe } from "./db";
import { usePantry } from "./pantry";
import { aisleFor, portionsFor } from "./planner";
import { pickReplacement, replacementNote, type ReplaceMode } from "./replace-meal";
import { SLOTS, SLOT_LABELS, isoDate, startOfWeek } from "./nutrition";
import { methodLabel } from "./cooking-method";

const db = supabase as unknown as { from: (table: string) => any };

/** Changes big enough that Lily asks first. */
export const DESTRUCTIVE: LilyAction["kind"][] = ["delete_month_plan", "regenerate_day"];

export function isDestructive(actions: LilyAction[]) {
  return actions.some((a) => DESTRUCTIVE.includes(a.kind));
}

export function confirmQuestion(actions: LilyAction[]) {
  if (actions.some((a) => a.kind === "delete_month_plan"))
    return "Are you sure? That removes your whole 28-day plan.";
  const day = actions.find((a) => a.kind === "regenerate_day");
  if (day && "date" in day) return `Shall I redo every meal on ${day.date}?`;
  return "Shall I go ahead?";
}

export type ActionResult = { done: string[]; navigate: { to: string; label: string } | null };

const clean = (s: string) => s.trim().toLowerCase();

function findRecipe(recipes: Recipe[], title: string) {
  const needle = clean(title);
  return (
    recipes.find((r) => clean(r.title) === needle) ??
    recipes.find((r) => clean(r.title).includes(needle) || needle.includes(clean(r.title))) ??
    null
  );
}

function unique(list: string[]) {
  const seen = new Set<string>();
  return list.filter((v) => {
    const k = clean(v);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function useLilyActions() {
  const qc = useQueryClient();
  const { me, people, householdId, userId } = useApp();
  const recipesQuery = useRecipes();
  const pantryQuery = usePantry(householdId);

  const refresh = (keys: string[]) => keys.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));

  const updateProfile = async (id: string, values: Partial<Profile>) => {
    const { error } = await db.from("profiles").update(values).eq("id", id);
    if (error) throw error;
  };

  const setMeal = async (date: string, slot: string, recipe: Recipe) => {
    const { error } = await db.from("meal_plan_entries").upsert(
      [
        {
          household_id: householdId,
          plan_date: date,
          slot,
          recipe_id: recipe.id,
          portions: portionsFor(people, slot, recipe),
        },
      ],
      { onConflict: "household_id,plan_date,slot" },
    );
    if (error) throw error;
  };

  const currentRecipe = async (date: string, slot: string): Promise<Recipe | null> => {
    const { data } = await db
      .from("meal_plan_entries")
      .select("*, recipes(*)")
      .eq("household_id", householdId)
      .eq("plan_date", date)
      .eq("slot", slot)
      .maybeSingle();
    return (data?.recipes ?? null) as Recipe | null;
  };

  /** Runs the list in order and returns a plain-language list of what changed. */
  const run = async (actions: LilyAction[]): Promise<ActionResult> => {
    const done: string[] = [];
    let navigate: { to: string; label: string } | null = null;
    if (!householdId || !me) return { done, navigate };

    const recipes = recipesQuery.data ?? [];
    const pantry = pantryQuery.data ?? [];

    for (const action of actions) {
      switch (action.kind) {
        case "remember_avoid": {
          await updateProfile(me.id, { disliked: unique([...(me.disliked ?? []), action.value]) });
          refresh(["profile", "household-profiles"]);
          done.push(`I won't plan ${action.value} again.`);
          break;
        }
        case "forget_avoid": {
          const needle = clean(action.value);
          for (const p of people) {
            const next = (p.disliked ?? []).filter((d) => !clean(d).includes(needle));
            const rules = { ...(p.ingredient_rules ?? {}) };
            Object.keys(rules).forEach((k) => {
              if (clean(k).includes(needle)) delete rules[k];
            });
            await updateProfile(p.id, { disliked: next, ingredient_rules: rules });
          }
          refresh(["profile", "household-profiles"]);
          done.push(`${action.value} is back on the menu.`);
          break;
        }
        case "remember_prefer": {
          await updateProfile(me.id, { prefer_more: unique([...(me.prefer_more ?? []), action.value]) });
          refresh(["profile", "household-profiles"]);
          done.push(`More ${action.value} from now on.`);
          break;
        }
        case "remember_note": {
          await updateProfile(me.id, { lily_notes: unique([...(me.lily_notes ?? []), action.value]) });
          refresh(["profile", "household-profiles"]);
          done.push(`Noted: ${action.value}`);
          break;
        }
        case "set_cooking_method": {
          for (const p of people)
            await updateProfile(p.id, {
              cooking_method: action.value,
              cooking_method_note: action.note ?? "",
            });
          refresh(["profile", "household-profiles"]);
          done.push(`Cooking with your ${methodLabel(action.value, action.note ?? "")} from now on.`);
          break;
        }
        case "pantry_add": {
          const existing = pantry.find((p) => clean(p.name) === clean(action.name));
          const row: Record<string, unknown> = {
            household_id: householdId,
            name: action.name.trim(),
            quantity: action.quantity ?? existing?.quantity ?? 1,
            unit: action.unit ?? existing?.unit ?? "pc",
            category: existing?.category ?? "Pantry",
          };
          if (action.expires_on) row["expires_on"] = action.expires_on;
          if (action.opened) row["opened_on"] = isoDate(new Date());
          const { error } = await db
            .from("pantry_items")
            .upsert([row], { onConflict: "household_id,name" });
          if (error) throw error;
          refresh(["pantry"]);
          done.push(
            `${action.name} is in your kitchen${action.expires_on ? `, best before ${action.expires_on}` : ""}.`,
          );
          break;
        }
        case "pantry_remove": {
          const { error } = await db
            .from("pantry_items")
            .delete()
            .eq("household_id", householdId)
            .ilike("name", `%${action.name.trim()}%`);
          if (error) throw error;
          refresh(["pantry"]);
          done.push(`${action.name} taken out of your kitchen.`);
          break;
        }
        case "grocery_add": {
          const amount = action.amount?.trim() || "1";
          const { error } = await db.from("grocery_items").insert([
            {
              household_id: householdId,
              week_start: thisWeekStart(),
              name: action.name.trim(),
              amount,
              category: aisleFor(action.name, "Other"),
              manual: true,
            },
          ]);
          if (error) throw error;
          refresh(["grocery"]);
          done.push(`${action.name} (${amount}) added to this week's list.`);
          break;
        }
        case "grocery_remove": {
          const { error } = await db
            .from("grocery_items")
            .delete()
            .eq("household_id", householdId)
            .eq("week_start", thisWeekStart())
            .ilike("name", `%${action.name.trim()}%`);
          if (error) throw error;
          refresh(["grocery"]);
          done.push(`${action.name} off the list.`);
          break;
        }
        case "replace_meal": {
          const slot = SLOTS.includes(action.slot as never) ? action.slot : "dinner";
          const current = await currentRecipe(action.date, slot);
          const next = pickReplacement({
            recipes,
            people,
            slot,
            current,
            pantry,
            mode: (action.mode ?? "different") as ReplaceMode,
            seed: new Date().getSeconds(),
          });
          if (!next) {
            done.push(`I couldn't find another ${SLOT_LABELS[slot]?.toLowerCase()} that fits your rules.`);
            break;
          }
          await setMeal(action.date, slot, next);
          refresh(["plan", "grocery"]);
          done.push(
            `${SLOT_LABELS[slot]} on ${action.date} is now ${next.title} — ${replacementNote(
              (action.mode ?? "different") as ReplaceMode,
              current,
              next,
            )}`,
          );
          break;
        }
        case "regenerate_day": {
          const changed: string[] = [];
          for (const slot of SLOTS) {
            const current = await currentRecipe(action.date, slot);
            const next = pickReplacement({
              recipes,
              people,
              slot,
              current,
              pantry,
              mode: "different",
              seed: new Date().getSeconds() + slot.length,
            });
            if (!next) continue;
            await setMeal(action.date, slot, next);
            changed.push(next.title);
          }
          refresh(["plan", "grocery"]);
          done.push(changed.length ? `${action.date} is all new: ${changed.join(", ")}.` : "Nothing to change.");
          break;
        }
        case "clear_meal": {
          const { error } = await db
            .from("meal_plan_entries")
            .delete()
            .eq("household_id", householdId)
            .eq("plan_date", action.date)
            .eq("slot", action.slot);
          if (error) throw error;
          refresh(["plan"]);
          done.push(`${SLOT_LABELS[action.slot] ?? action.slot} on ${action.date} cleared.`);
          break;
        }
        case "log_food": {
          const { error } = await db.from("food_logs").insert([
            {
              profile_id: userId ?? me.id,
              household_id: householdId,
              log_date: isoDate(new Date()),
              slot: action.slot ?? "snack",
              description: action.description,
              calories: Math.max(0, Math.round(action.calories ?? 0)),
              protein: Math.max(0, Math.round(action.protein ?? 0)),
              carbs: Math.max(0, Math.round(action.carbs ?? 0)),
              fat: Math.max(0, Math.round(action.fat ?? 0)),
              source: "tell_lily",
            },
          ]);
          if (error) throw error;
          refresh(["logs"]);
          done.push(`Logged ${action.description} — ${Math.round(action.calories ?? 0)} kcal.`);
          break;
        }
        case "favorite": {
          const recipe = findRecipe(recipes, action.title);
          if (!recipe) {
            done.push(`I don't have a recipe called "${action.title}" yet.`);
            break;
          }
          const { error } = await db
            .from("favorites")
            .insert([{ profile_id: me.id, household_id: householdId, recipe_id: recipe.id }]);
          if (error && !`${error.message}`.includes("duplicate")) throw error;
          refresh(["favorites"]);
          done.push(`${recipe.title} saved to your favourites.`);
          break;
        }
        case "prep_add": {
          const recipe = findRecipe(recipes, action.title);
          const { error } = await db.from("prep_batches").insert([
            {
              household_id: householdId,
              recipe_id: recipe?.id ?? null,
              title: recipe?.title ?? action.title,
              portions_total: action.portions ?? 2,
              portions_left: action.portions ?? 2,
              note: "Added by Lily",
            },
          ]);
          if (error) throw error;
          refresh(["prep-batches"]);
          done.push(`${recipe?.title ?? action.title} added to your prep list.`);
          break;
        }
        case "delete_month_plan": {
          const from = isoDate(startOfWeek(new Date()));
          const { error } = await db
            .from("meal_plan_entries")
            .delete()
            .eq("household_id", householdId)
            .gte("plan_date", from);
          if (error) throw error;
          refresh(["plan", "grocery"]);
          done.push("Your plan is cleared — say the word and I'll build a fresh month.");
          break;
        }
        case "add_event": {
          const { error } = await db.from("household_events").insert([
            {
              household_id: householdId,
              event_date: action.date,
              slot: action.slot ?? null,
              kind: action.event,
              guests: Math.max(0, Math.round(action.guests ?? 0)),
              note: action.note ?? "",
            },
          ]);
          if (error) throw error;
          refresh(["household-events"]);
          done.push(`Noted for ${action.date}${action.slot ? ` (${SLOT_LABELS[action.slot] ?? action.slot})` : ""}.`);
          break;
        }
        case "set_guests": {
          const guests = Math.max(0, Math.round(action.guests ?? 0));
          const { data: existing } = await db
            .from("household_events")
            .select("id")
            .eq("household_id", householdId)
            .eq("event_date", action.date)
            .eq("kind", "guests")
            .limit(1);
          const row = (existing as { id: string }[] | null)?.[0];
          if (row) {
            const { error } = await db
              .from("household_events")
              .update({ guests, slot: action.slot ?? null })
              .eq("id", row.id);
            if (error) throw error;
          } else {
            const { error } = await db.from("household_events").insert([
              {
                household_id: householdId,
                event_date: action.date,
                slot: action.slot ?? null,
                kind: "guests",
                guests,
                note: "",
              },
            ]);
            if (error) throw error;
          }
          refresh(["household-events", "plan"]);
          done.push(
            guests
              ? `${guests} extra plate${guests === 1 ? "" : "s"} on ${action.date} — I'll cook more.`
              : `No extra plates on ${action.date} any more.`,
          );
          break;
        }
        case "household_note": {
          const { error } = await db.from("household_notes").insert([
            {
              household_id: householdId,
              from_name: action.from ?? "",
              message: action.message,
            },
          ]);
          if (error) throw error;
          refresh(["household-notes"]);
          done.push("I've written that down for the household.");
          break;
        }
        case "rate_meal": {
          const { data: rows } = await db
            .from("meal_plan_entries")
            .select("recipe_id")
            .eq("household_id", householdId)
            .eq("plan_date", action.date)
            .eq("slot", action.slot)
            .limit(1);
          const recipeId = (rows as { recipe_id: string | null }[] | null)?.[0]?.recipe_id ?? null;
          const { error } = await db.from("meal_feedback").insert([
            {
              household_id: householdId,
              profile_id: me.id,
              recipe_id: recipeId,
              plan_date: action.date,
              slot: action.slot,
              rating: action.rating,
              note: action.note ?? "",
            },
          ]);
          if (error) throw error;
          refresh(["meal-feedback"]);
          done.push(
            action.rating === "never_again"
              ? "Understood — I won't plan that one again."
              : "Thanks, that helps me plan better.",
          );
          break;
        }
        case "navigate": {
          navigate = { to: action.to, label: action.label || "Take me there" };
          break;
        }
        default:
          break;
      }
    }

    return { done, navigate };
  };

  return { run };
}
