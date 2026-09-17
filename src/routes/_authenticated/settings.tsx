import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/macro";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateProfile, type Profile } from "@/lib/db";
import { COOKING_METHODS, methodLabel } from "@/lib/cooking-method";
import { ACTIVITY_LABELS, GOAL_LABELS, computeTargets, type Goal } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "My details — Cook with Lily" },
      {
        name: "description",
        content: "Update weight, goal weight, activity level, calorie target and the foods you'd rather skip.",
      },
      { property: "og:title", content: "My details — Cook with Lily" },
      { property: "og:description", content: "Your goals and food preferences, editable any time." },
    ],
  }),
  component: SettingsPage,
});

const RULE_LABELS: Record<string, string> = {
  never: "Never use",
  sometimes: "Occasionally",
  pricey: "Too expensive",
};

function PersonEditor({ person }: { person: Profile }) {
  const update = useUpdateProfile();
  const [form, setForm] = useState({
    weight: person.weight_kg ?? "",
    goalWeight: person.goal_weight_kg ?? "",
    height: person.height_cm ?? "",
    age: person.age ?? "",
    activity: person.activity_level,
    goal: person.goal,
    calories: person.calorie_target,
  });
  const [dislike, setDislike] = useState("");
  const [ruleName, setRuleName] = useState("");

  useEffect(() => {
    setForm({
      weight: person.weight_kg ?? "",
      goalWeight: person.goal_weight_kg ?? "",
      height: person.height_cm ?? "",
      age: person.age ?? "",
      activity: person.activity_level,
      goal: person.goal,
      calories: person.calorie_target,
    });
  }, [person]);

  const num = (v: string | number) => (v === "" ? null : Number(v));

  const recalc = () => {
    const targets = computeTargets({
      sex: person.sex,
      age: num(form.age),
      height_cm: num(form.height),
      weight_kg: num(form.weight),
      activity_level: form.activity,
      goal: form.goal,
    });
    setForm((f) => ({ ...f, calories: targets.calorie_target }));
    toast.success(`Lily suggests ${targets.calorie_target} kcal a day`);
  };

  const save = () => {
    const base = {
      sex: person.sex,
      age: num(form.age),
      height_cm: num(form.height),
      weight_kg: num(form.weight),
      activity_level: form.activity,
      goal: form.goal,
    };
    const targets = computeTargets(base);
    const ratio = targets.calorie_target > 0 ? Number(form.calories) / targets.calorie_target : 1;
    update.mutate(
      {
        id: person.id,
        values: {
          ...base,
          goal_weight_kg: num(form.goalWeight),
          calorie_target: Math.round(Number(form.calories)),
          protein_target: Math.round(targets.protein_target),
          carb_target: Math.round(targets.carb_target * ratio),
          fat_target: Math.round(targets.fat_target * ratio),
        } as Partial<Profile>,
      },
      { onSuccess: () => toast.success(`${person.display_name} updated`) },
    );
  };

  const addDislike = () => {
    const value = dislike.trim();
    if (!value) return;
    update.mutate({ id: person.id, values: { disliked: [...(person.disliked ?? []), value] } });
    setDislike("");
  };

  const removeDislike = (value: string) => {
    update.mutate({
      id: person.id,
      values: { disliked: (person.disliked ?? []).filter((d) => d !== value) },
    });
  };

  const setRule = (name: string, rule: string) => {
    const rules = { ...(person.ingredient_rules ?? {}) };
    if (rule === "clear") delete rules[name];
    else rules[name] = rule;
    update.mutate({ id: person.id, values: { ingredient_rules: rules } as Partial<Profile> });
  };

  const rules = person.ingredient_rules ?? {};

  return (
    <Card className="grid gap-3">
      <p className="font-display text-[17px] font-semibold">{person.display_name}</p>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[12px] font-medium text-muted-foreground">
          Weight (kg)
          <Input
            type="number"
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="text-[12px] font-medium text-muted-foreground">
          Goal weight (kg)
          <Input
            type="number"
            value={form.goalWeight}
            onChange={(e) => setForm({ ...form, goalWeight: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="text-[12px] font-medium text-muted-foreground">
          Height (cm)
          <Input
            type="number"
            value={form.height}
            onChange={(e) => setForm({ ...form, height: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="text-[12px] font-medium text-muted-foreground">
          Age
          <Input
            type="number"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            className="mt-1"
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">How active</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
            <Chip key={key} active={form.activity === key} onClick={() => setForm({ ...form, activity: key })}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Goal</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(GOAL_LABELS) as Goal[]).map((key) => (
            <Chip key={key} active={form.goal === key} onClick={() => setForm({ ...form, goal: key })}>
              {GOAL_LABELS[key]}
            </Chip>
          ))}
        </div>
      </div>

      <label className="text-[12px] font-medium text-muted-foreground">
        Daily calories
        <div className="mt-1 flex gap-2">
          <Input
            type="number"
            value={form.calories}
            onChange={(e) => setForm({ ...form, calories: Number(e.target.value) })}
          />
          <Button variant="secondary" onClick={recalc} className="shrink-0 rounded-full">
            Ask Lily
          </Button>
        </div>
      </label>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Foods to skip</p>
        <div className="flex flex-wrap gap-2">
          {(person.disliked ?? []).map((d) => (
            <button
              key={d}
              onClick={() => removeDislike(d)}
              className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-medium"
            >
              {d} <X className="size-3" />
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={dislike}
            placeholder="e.g. courgette"
            onChange={(e) => setDislike(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDislike()}
          />
          <Button variant="secondary" onClick={addDislike} className="shrink-0 rounded-full">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Ingredient rules</p>
        <div className="grid gap-2">
          {Object.entries(rules).map(([name, rule]) => (
            <div key={name} className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{name}</span>
              <span className="text-[11px] text-muted-foreground">{RULE_LABELS[String(rule)] ?? String(rule)}</span>
              <button onClick={() => setRule(name, "clear")} aria-label={`Remove rule for ${name}`}>
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input value={ruleName} placeholder="Ingredient" onChange={(e) => setRuleName(e.target.value)} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(RULE_LABELS).map(([key, label]) => (
            <Chip
              key={key}
              active={false}
              onClick={() => {
                const value = ruleName.trim();
                if (!value) {
                  toast.error("Type an ingredient first");
                  return;
                }
                setRule(value, key);
                setRuleName("");
              }}
            >
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <Button onClick={save} className={cn("rounded-full")} disabled={update.isPending}>
        Save {person.display_name}'s details
      </Button>
    </Card>
  );
}

function KitchenEquipment() {
  const { people, me } = useApp();
  const update = useUpdateProfile();
  const current = me?.cooking_method ?? "regular";
  const [note, setNote] = useState(me?.cooking_method_note ?? "");

  const choose = (value: string, customNote = "") => {
    people.forEach((p) =>
      update.mutate({ id: p.id, values: { cooking_method: value, cooking_method_note: customNote } }),
    );
    toast.success(`Cooking with your ${methodLabel(value, customNote)} from now on`);
  };

  return (
    <Card className="grid gap-2">
      <p className="text-[12.5px] text-muted-foreground">
        Lily writes the steps for whatever you cook with — and picks dishes that suit it.
      </p>
      {COOKING_METHODS.map((m) => (
        <button
          key={m.value}
          onClick={() => choose(m.value, m.value === "custom" ? note : "")}
          className={cn(
            "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
            current === m.value ? "bg-caramel/15 ring-1 ring-caramel/40" : "bg-secondary/60 hover:bg-secondary",
          )}
        >
          <span className="text-lg">{m.emoji}</span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold">{m.label}</span>
            <span className="block truncate text-[12px] text-muted-foreground">{m.hint}</span>
          </span>
        </button>
      ))}
      {current === "custom" ? (
        <div className="flex gap-2">
          <Input
            value={note}
            placeholder="Air fryer, slow cooker…"
            onChange={(e) => setNote(e.target.value)}
          />
          <Button variant="secondary" className="rounded-full" onClick={() => choose("custom", note)}>
            Save
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function SettingsPage() {
  const { people } = useApp();
  const navigate = useNavigate();

  return (
    <AppShell title="My details" subtitle="Everything Lily plans around" mood="thinking">
      <LilySays mood="thinking">
        Change your weight or how active you are whenever it shifts — I'll keep your plan sensible, never
        crash-diet strict.
      </LilySays>

      <SectionTitle>My kitchen</SectionTitle>
      <KitchenEquipment />

      <SectionTitle>What Lily remembers</SectionTitle>
      <div className="grid gap-3">
        {people.map((p) => (
          <LilyMemory key={p.id} person={p} />
        ))}
      </div>


      <SectionTitle>The two of you</SectionTitle>
      <div className="grid gap-3">
        {people.map((p) => (
          <PersonEditor key={p.id} person={p} />
        ))}
      </div>

      <Button
        variant="secondary"
        className="mt-6 w-full rounded-full"
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/" });
        }}
      >
        <LogOut className="size-4" /> Sign out
      </Button>
    </AppShell>
  );
}
