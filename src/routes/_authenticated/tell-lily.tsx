import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { accentOf, useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { Chip } from "@/components/macro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAddLog, useLogs, usePlan, useRecipes, useSetPlanEntry, useUpdatePlanEntry } from "@/lib/db";
import { estimateMeal, type Estimate } from "@/lib/lily.functions";
import { localEstimate } from "@/lib/local-estimate";
import { reassure, treatsFor } from "@/lib/lily-brain";
import { SLOTS, SLOT_LABELS, isoDate } from "@/lib/nutrition";
import { portionsFor } from "@/lib/planner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tell-lily")({
  component: TellLily,
});

const EXAMPLES = [
  "A bowl of harira and two dates",
  "Chicken tagine with bread and olives",
  "Msemen with honey and mint tea",
  "Big plate of couscous with vegetables",
];

function TellLily() {
  const { people, me, householdId } = useApp();
  const date = isoDate(new Date());
  const plan = usePlan(householdId, date, date);
  const addLog = useAddLog();
  const updateEntry = useUpdatePlanEntry();
  const estimate = useServerFn(estimateMeal);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Estimate | null>(null);
  const [who, setWho] = useState(me?.id ?? "");
  const [slot, setSlot] = useState<string>("lunch");
  const [craving, setCraving] = useState("");
  const { data: recipes = [] } = useRecipes();
  const logs = useLogs(householdId, date, date);
  const setPlanEntry = useSetPlanEntry();

  const ask = async () => {
    if (text.trim().length < 2) return;
    setBusy(true);
    try {
      const result = await estimate({ data: { text: text.trim() } });
      setDraft(result ?? localEstimate(text));
    } catch {
      setDraft(localEstimate(text));
    } finally {
      setBusy(false);
    }
  };

  const personId = who || me?.id || people[0]?.id || "";

  const save = async (replacePlanned: boolean) => {
    if (!draft || !householdId || !personId) return;
    try {
      await addLog.mutateAsync({
        profile_id: personId,
        household_id: householdId,
        log_date: date,
        slot,
        description: draft.description || text.trim(),
        calories: draft.calories,
        protein: draft.protein,
        carbs: draft.carbs,
        fat: draft.fat,
        source: "lily",
      });
      if (replacePlanned) {
        const entry = (plan.data ?? []).find((e) => e.slot === slot);
        if (entry) {
          await updateEntry.mutateAsync({
            id: entry.id,
            values: { portions: { ...(entry.portions ?? {}), [personId]: 0 } },
          });
        }
      }
      toast.success(replacePlanned ? "Logged, and the plan knows about it" : "Logged!");
      setDraft(null);
      setText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that");
    }
  };

  const person = people.find((p) => p.id === personId) ?? me;
  const eatenToday = (logs.data ?? [])
    .filter((l) => l.profile_id === personId)
    .reduce((a, l) => a + l.calories, 0);
  const kcalLeft = Math.max(0, (person?.calorie_target ?? 2000) - eatenToday);
  const over = eatenToday - (person?.calorie_target ?? 2000);
  const treats = craving.trim().length > 2 ? treatsFor(recipes, craving, kcalLeft) : [];

  const planTreat = (recipeId: string, title: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe || !householdId) return;
    setPlanEntry.mutate(
      {
        household_id: householdId,
        plan_date: date,
        slot: "snack_pm",
        recipe_id: recipe.id,
        portions: portionsFor(people, "snack_pm", recipe),
      },
      { onSuccess: () => toast.success(`${title} is your afternoon treat 🌼`) },
    );
  };

  return (
    <AppShell title="Tell Lily" subtitle="Describe your plate in plain words">
      <LilySays>Tell me what you ate and I'll do the maths — you can edit anything after.</LilySays>

      <Card className="mt-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Half a chicken tagine with two pieces of khobz…"
          className="resize-none rounded-2xl"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <Chip key={e} onClick={() => setText(e)}>
              {e}
            </Chip>
          ))}
        </div>
        <Button onClick={ask} disabled={busy || text.trim().length < 2} className="mt-3 h-11 w-full rounded-full">
          {busy ? "Lily is thinking…" : "Estimate it"} <Send className="size-4" />
        </Button>
      </Card>

      {draft ? (
        <>
          <SectionTitle>Lily's estimate</SectionTitle>
          <Card>
            <p className="font-display text-[17px] font-semibold">{draft.description}</p>
            {draft.note ? <p className="mt-0.5 text-[12px] text-muted-foreground">{draft.note}</p> : null}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {(
                [
                  ["Calories", "calories"],
                  ["Protein", "protein"],
                  ["Carbs", "carbs"],
                  ["Fat", "fat"],
                ] as const
              ).map(([label, key]) => (
                <div key={key} className="grid gap-1">
                  <Label className="text-[11px]">{label}</Label>
                  <Input
                    inputMode="numeric"
                    value={String(draft[key])}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="h-9 rounded-xl px-2 text-center text-[13px]"
                  />
                </div>
              ))}
            </div>

            <p className="mt-4 text-[12px] font-semibold text-muted-foreground">Who ate it?</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {people.map((p) => (
                <Chip key={p.id} active={personId === p.id} onClick={() => setWho(p.id)}>
                  <span className={cn("size-1.5 rounded-full", accentOf(p).dot)} />
                  {p.display_name}
                </Chip>
              ))}
            </div>

            <p className="mt-3 text-[12px] font-semibold text-muted-foreground">Which meal?</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SLOTS.map((s) => (
                <Chip key={s} active={slot === s} onClick={() => setSlot(s)}>
                  {SLOT_LABELS[s]}
                </Chip>
              ))}
            </div>

            <div className="mt-4 grid gap-2">
              <Button onClick={() => save(false)} className="h-11 rounded-full">
                Add to my day
              </Button>
              <Button variant="outline" onClick={() => save(true)} className="h-11 rounded-full">
                This replaced my planned {SLOT_LABELS[slot]?.toLowerCase()}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)} className="h-9 rounded-full text-[13px]">
                Start over
              </Button>
            </div>
          </Card>
        </>
      ) : null}

      {over > 0 ? (
        <Card className="mt-4 bg-butter/45">
          <p className="font-display text-[15px] font-semibold">Had a bigger day? That's fine 🌼</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{reassure(over)}</p>
        </Card>
      ) : null}

      <SectionTitle>Craving something?</SectionTitle>
      <Card>
        <p className="text-[13px] text-muted-foreground">
          Tell me what you fancy and I'll find something that fits — you have about {kcalLeft} kcal left today.
        </p>
        <Input
          value={craving}
          onChange={(e) => setCraving(e.target.value)}
          placeholder="Something sweet, salty, bread…"
          className="mt-2 rounded-full"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["something sweet", "salty", "bread", "creamy", "crunchy", "warm"].map((c) => (
            <Chip key={c} onClick={() => setCraving(c)}>
              {c}
            </Chip>
          ))}
        </div>
        {craving.trim().length > 2 ? (
          treats.length ? (
            <ul className="mt-3 grid gap-2">
              {treats.map((t) => (
                <li
                  key={t.recipe.id}
                  className="flex items-center gap-2 rounded-2xl bg-secondary/40 p-2.5"
                >
                  <span aria-hidden>{t.recipe.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{t.recipe.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {t.recipe.calories} kcal a serving ·{" "}
                      {t.fits ? "fits your day easily" : "a proper treat — worth it sometimes"}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    className="h-8 shrink-0 rounded-full"
                    onClick={() => planTreat(t.recipe.id, t.recipe.title)}
                  >
                    Have it
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-muted-foreground">
              Nothing in my book matches that yet — try “sweet”, “salty” or “bread”.
            </p>
          )
        ) : null}
      </Card>
    </AppShell>
  );
}
