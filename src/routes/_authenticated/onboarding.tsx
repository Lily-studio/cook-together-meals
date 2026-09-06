import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { LilySays } from "@/components/lily";
import { Chip } from "@/components/macro";
import { ACCENTS, useApp } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddPartner, useRecipes, useSetPlanEntry, useUpdateProfile } from "@/lib/db";
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  computeTargets,
  isoDate,
  startOfWeek,
  weekDates,
  type Goal,
} from "@/lib/nutrition";
import { buildWeekPlan } from "@/lib/planner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

type Person = {
  display_name: string;
  goal_weight_kg: string;
  sex: string;
  age: string;
  height_cm: string;
  weight_kg: string;
  activity_level: string;
  goal: string;
  accent: string;
};

/** Sensible starting points; everything stays editable. */
const herDefaults = (accent: string): Person => ({
  display_name: "",
  goal_weight_kg: "68",
  sex: "female",
  age: "29",
  height_cm: "169",
  weight_kg: "85",
  activity_level: "low",
  goal: "lose",
  accent,
});

const hisDefaults = (accent: string): Person => ({
  display_name: "",
  goal_weight_kg: "",
  sex: "male",
  age: "29",
  height_cm: "178",
  weight_kg: "",
  activity_level: "moderate",
  goal: "gain",
  accent,
});

const DIET_PREFS = [
  { key: "budget", label: "Affordable, local ingredients" },
  { key: "moroccan", label: "Moroccan classics" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "high_protein", label: "High protein" },
  { key: "quick", label: "Quick to cook" },
];

const COMMON_AVOID = ["Pork", "Peanuts", "Shellfish", "Eggs", "Milk", "Gluten", "Aubergine", "Coriander", "Spicy food"];

function toNum(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function Onboarding() {
  const { me, people, householdId, loading } = useApp();
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const addPartner = useAddPartner();
  const setPlanEntry = useSetPlanEntry();
  const { data: recipes = [] } = useRecipes();

  const [step, setStep] = useState(0);
  const [a, setA] = useState<Person>(herDefaults("caramel"));
  const [b, setB] = useState<Person>(hisDefaults("olive"));
  const [prefs, setPrefs] = useState<string[]>(["budget", "moroccan"]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [customAvoid, setCustomAvoid] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me && !a.display_name && me.display_name) {
      setA((p) => ({ ...p, display_name: me.display_name === "You" ? "" : me.display_name }));
    }
  }, [me, a.display_name]);

  useEffect(() => {
    if (!loading && me?.onboarding_complete) navigate({ to: "/today" });
  }, [loading, me, navigate]);

  const targetsA = computeTargets({
    sex: a.sex,
    age: toNum(a.age, 30),
    height_cm: toNum(a.height_cm, 168),
    weight_kg: toNum(a.weight_kg, 65),
    activity_level: a.activity_level,
    goal: a.goal,
  });
  const targetsB = computeTargets({
    sex: b.sex,
    age: toNum(b.age, 30),
    height_cm: toNum(b.height_cm, 178),
    weight_kg: toNum(b.weight_kg, 78),
    activity_level: b.activity_level,
    goal: b.goal,
  });

  const finish = async () => {
    if (!me || !householdId) return;
    setSaving(true);
    try {
      const allAvoid = [...avoid, ...customAvoid.split(",").map((s) => s.trim()).filter(Boolean)];
      await updateProfile.mutateAsync({
        id: me.id,
        values: {
          display_name: a.display_name.trim() || "You",
          accent: a.accent,
          sex: a.sex,
          age: toNum(a.age, 30),
          height_cm: toNum(a.height_cm, 168),
          weight_kg: toNum(a.weight_kg, 65),
          activity_level: a.activity_level,
          goal: a.goal,
          goal_weight_kg: a.goal_weight_kg ? Number(a.goal_weight_kg) : null,
          diet_prefs: prefs,
          allergies: allAvoid,
          onboarding_complete: true,
          ...targetsA,
        },
      });

      const partnerExists = people.some((p) => !p.is_owner);
      if (!partnerExists && b.display_name.trim()) {
        await addPartner.mutateAsync({
          household_id: householdId,
          display_name: b.display_name.trim(),
          accent: b.accent,
          sex: b.sex,
          age: toNum(b.age, 30),
          height_cm: toNum(b.height_cm, 178),
          weight_kg: toNum(b.weight_kg, 78),
          activity_level: b.activity_level,
          goal: b.goal,
          goal_weight_kg: b.goal_weight_kg ? Number(b.goal_weight_kg) : null,
          diet_prefs: prefs,
          allergies: allAvoid,
          ...targetsB,
        });
      }

      // First week plan, using the freshly chosen goals.
      const peopleForPlan = [
        { ...me, id: me.id, ...targetsA, allergies: allAvoid, diet_prefs: prefs },
        ...(b.display_name.trim()
          ? [
              {
                ...me,
                id: "partner",
                display_name: b.display_name,
                ...targetsB,
                allergies: allAvoid,
                diet_prefs: prefs,
              },
            ]
          : []),
      ];
      if (recipes.length) {
        const dates = weekDates(startOfWeek(new Date()));
        const entries = buildWeekPlan(dates, recipes, peopleForPlan, 0);
        for (const entry of entries) {
          await setPlanEntry.mutateAsync({
            household_id: householdId,
            plan_date: entry.plan_date,
            slot: entry.slot,
            recipe_id: entry.recipe_id,
            portions: {},
          });
        }
        void isoDate;
      }

      toast.success("Your kitchen is ready!");
      navigate({ to: "/today" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that");
    } finally {
      setSaving(false);
    }
  };

  const steps = ["About you", "Your partner", "Food you love", "All set"];

  return (
    <main className="paper min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md px-6 pt-9 pb-16">
        <div className="mb-5 flex gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-caramel" : "bg-secondary",
              )}
            />
          ))}
        </div>

        {step === 0 ? (
          <>
            <LilySays>Let's start with you. I'll work out your daily calories.</LilySays>
            <PersonForm person={a} onChange={setA} targets={targetsA} label="your" />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <LilySays>
              Now the person you cook with. Tell me his weight now and how active he is, and I'll work
              out his own target — different goals are my speciality.
            </LilySays>
            <PersonForm person={b} onChange={setB} targets={targetsB} label="their" optional />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <LilySays>What should I lean on, and what should I keep off the table?</LilySays>
            <div className="mt-4 rounded-3xl bg-card p-5 shadow-soft">
              <p className="text-sm font-semibold">We like…</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DIET_PREFS.map((p) => (
                  <Chip
                    key={p.key}
                    active={prefs.includes(p.key)}
                    onClick={() =>
                      setPrefs((cur) =>
                        cur.includes(p.key) ? cur.filter((x) => x !== p.key) : [...cur, p.key],
                      )
                    }
                  >
                    {p.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-5 text-sm font-semibold">Never cook with…</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COMMON_AVOID.map((item) => (
                  <Chip
                    key={item}
                    active={avoid.includes(item)}
                    onClick={() =>
                      setAvoid((cur) =>
                        cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item],
                      )
                    }
                  >
                    {item}
                  </Chip>
                ))}
              </div>
              <div className="mt-4 grid gap-1.5">
                <Label htmlFor="avoid">Anything else? (comma separated)</Label>
                <Input
                  id="avoid"
                  value={customAvoid}
                  onChange={(e) => setCustomAvoid(e.target.value)}
                  placeholder="okra, blue cheese"
                  className="rounded-xl"
                />
              </div>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <LilySays>
              Here's the plan: I'll fill your whole week with 3 meals and 2 snacks a day.
            </LilySays>
            <div className="mt-4 grid gap-3">
              <SummaryCard name={a.display_name || "You"} goal={a.goal} targets={targetsA} accent={a.accent} />
              {b.display_name.trim() ? (
                <SummaryCard name={b.display_name} goal={b.goal} targets={targetsB} accent={b.accent} />
              ) : null}
            </div>
          </>
        ) : null}

        <div className="mt-6 flex gap-2">
          {step > 0 ? (
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="h-11 rounded-full px-5"
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
          ) : null}
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 0 && !a.display_name.trim()) ||
                (step === 1 && !!b.display_name.trim() && !b.weight_kg.trim())
              }
              className="h-11 flex-1 rounded-full text-[15px]"
            >
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={saving} className="h-11 flex-1 rounded-full text-[15px]">
              {saving ? "Filling your week…" : "Build my week"} <Check className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  name,
  goal,
  targets,
  accent,
}: {
  name: string;
  goal: string;
  targets: ReturnType<typeof computeTargets>;
  accent: string;
}) {
  const tone = ACCENTS[accent] ?? ACCENTS["caramel"]!;
  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <span className={cn("size-2.5 rounded-full", tone.dot)} />
        <p className="font-display text-[17px] font-semibold">{name}</p>
      </div>
      <p className="text-[13px] text-muted-foreground">{GOAL_LABELS[goal as Goal] ?? goal}</p>
      <p className="mt-2 text-sm">
        <span className="font-semibold text-caramel">{targets.calorie_target} kcal</span> · {targets.protein_target}g
        protein · {targets.carb_target}g carbs · {targets.fat_target}g fat
      </p>
    </div>
  );
}

function PersonForm({
  person,
  onChange,
  targets,
  label,
  optional,
}: {
  person: Person;
  onChange: (p: Person) => void;
  targets: ReturnType<typeof computeTargets>;
  label: string;
  optional?: boolean;
}) {
  const set = (patch: Partial<Person>) => onChange({ ...person, ...patch });
  return (
    <div className="mt-4 grid gap-4 rounded-3xl bg-card p-5 shadow-soft">
      <div className="grid gap-1.5">
        <Label>Name{optional ? " (leave blank to cook solo)" : ""}</Label>
        <Input
          value={person.display_name}
          onChange={(e) => set({ display_name: e.target.value })}
          placeholder={optional ? "Youssef" : "Lina"}
          className="rounded-xl"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Age</Label>
          <Input
            inputMode="numeric"
            value={person.age}
            onChange={(e) => set({ age: e.target.value })}
            className="rounded-xl"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Sex</Label>
          <div className="flex gap-1.5">
            {["female", "male"].map((s) => (
              <Chip key={s} active={person.sex === s} onClick={() => set({ sex: s })} className="py-1.5">
                {s === "female" ? "Female" : "Male"}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Height (cm)</Label>
          <Input
            inputMode="numeric"
            value={person.height_cm}
            onChange={(e) => set({ height_cm: e.target.value })}
            className="rounded-xl"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Weight now (kg)</Label>
          <Input
            inputMode="numeric"
            value={person.weight_kg}
            onChange={(e) => set({ weight_kg: e.target.value })}
            placeholder="e.g. 78"
            className="rounded-xl"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Goal weight (kg)</Label>
          <Input
            inputMode="numeric"
            value={person.goal_weight_kg}
            onChange={(e) => set({ goal_weight_kg: e.target.value })}
            placeholder="optional"
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>How active?</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(ACTIVITY_LABELS).map(([key, text]) => (
            <Chip key={key} active={person.activity_level === key} onClick={() => set({ activity_level: key })}>
              {text}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Goal</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(GOAL_LABELS).map(([key, text]) => (
            <Chip key={key} active={person.goal === key} onClick={() => set({ goal: key })}>
              {text}
            </Chip>
          ))}
        </div>
      </div>
      <p className="rounded-2xl bg-butter/40 px-3 py-2.5 text-[13px]">
        Based on {label} details: <strong>{targets.calorie_target} kcal</strong> a day,{" "}
        {targets.protein_target}g protein.
      </p>
    </div>
  );
}
