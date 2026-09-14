import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Compass, MessageCircleHeart, MessagesSquare, Package, Settings, Soup } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { useApp, accentOf } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { ShowLily } from "@/components/show-lily";
import { Button } from "@/components/ui/button";
import {
  useFavorites,
  useGrocery,
  useLogs,
  usePlan,
  usePrepBatches,
  useRecipes,
  useSetPlanEntry,
  thisWeekStart,
} from "@/lib/db";
import { usePantry } from "@/lib/pantry";
import { portionsFor } from "@/lib/planner";
import { monthSummary, weeklySurprise } from "@/lib/quick";
import { isoDate, startOfWeek } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lily")({
  head: () => ({
    meta: [
      { title: "Lily's kitchen — Cook with Lily" },
      {
        name: "description",
        content:
          "Tell Lily what you ate, see what to prep ahead, browse recipes and track your progress toward your goal weight.",
      },
      { property: "og:title", content: "Lily's kitchen — Cook with Lily" },
      {
        property: "og:description",
        content: "Your cosy little kitchen companion: logging, prep-ahead, recipes and gentle progress.",
      },
    ],
  }),
  component: LilyHub,
});

const LINKS: {
  to: "/tell-lily" | "/talk" | "/pantry" | "/prep" | "/discover" | "/settings";
  label: string;
  hint: string;
  icon: typeof Soup;
}[] = [
  { to: "/tell-lily", label: "Tell Lily what I ate", hint: "She'll estimate the calories", icon: MessageCircleHeart },
  { to: "/talk", label: "Talk to Lily", hint: "Ask about swaps, dinner, anything", icon: MessagesSquare },
  { to: "/pantry", label: "My pantry", hint: "What's in stock and what's low", icon: Package },
  { to: "/prep", label: "Prep ahead", hint: "What to cook in advance", icon: Soup },
  { to: "/discover", label: "Recipes", hint: "Browse and favourite", icon: Compass },
  { to: "/settings", label: "My details", hint: "Weight, activity, foods I skip", icon: Settings },
];

function LilyHub() {
  const { people, householdId } = useApp();
  const week = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: isoDate(from), to: isoDate(now) };
  }, []);
  const logs = useLogs(householdId, week.from, week.to);
  const days = new Set((logs.data ?? []).map((l) => l.log_date)).size;

  // The month, seen kindly: what got cooked, what got used up, what that saved.
  const month = useMemo(() => {
    const first = startOfWeek(new Date());
    const last = new Date(first);
    last.setDate(last.getDate() + 27);
    return { from: isoDate(first), to: isoDate(last), weekStart: isoDate(first) };
  }, []);
  const monthPlan = usePlan(householdId, month.from, month.to);
  const monthLogs = useLogs(householdId, month.from, month.to);
  const prep = usePrepBatches(householdId);
  const grocery = useGrocery(householdId, thisWeekStart());
  const pantry = usePantry(householdId);
  const { data: recipes = [] } = useRecipes();
  const favorites = useFavorites(householdId);
  const setEntry = useSetPlanEntry();

  const summary = useMemo(
    () =>
      monthSummary({
        entries: monthPlan.data ?? [],
        logs: monthLogs.data ?? [],
        prep: prep.data ?? [],
        grocery: grocery.data ?? [],
        pantry: pantry.data ?? [],
      }),
    [monthPlan.data, monthLogs.data, prep.data, grocery.data, pantry.data],
  );

  const surprise = useMemo(
    () =>
      recipes.length
        ? weeklySurprise({
            recipes,
            favouriteRecipeIds: (favorites.data ?? []).map((f) => f.recipe_id),
            weekStart: month.weekStart,
            entries: monthPlan.data ?? [],
          })
        : null,
    [recipes, favorites.data, month.weekStart, monthPlan.data],
  );

  const cookSurprise = () => {
    if (!surprise || !householdId) return;
    const when = new Date();
    when.setDate(when.getDate() + 1);
    setEntry.mutate(
      {
        household_id: householdId,
        plan_date: isoDate(when),
        slot: "dinner",
        recipe_id: surprise.id,
        portions: portionsFor(people, "dinner", surprise),
      },
      { onSuccess: () => toast.success(`${surprise.title} tomorrow night — a little treat 🌼`) },
    );
  };

  return (
    <AppShell title="Lily's kitchen" subtitle="One kitchen. One meal. Two goals." mood="heart">
      <LilySays mood={days >= 3 ? "heart" : "wink"}>
        {days >= 3
          ? `You've told me about ${days} of the last 7 days — that's how we keep this honest and kind.`
          : "Tell me what you eat when you can. No scolding, just better plans."}
      </LilySays>

      {surprise ? (
        <Card className="mt-3 bg-butter/40">
          <p className="font-display text-[16px] font-semibold">Lily's surprise this week ✨</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {surprise.emoji} {surprise.title} — {surprise.tagline.toLowerCase()}. It's your kind of thing, and
            it isn't in the plan yet.
          </p>
          <Button size="sm" className="mt-2 rounded-full" onClick={cookSurprise}>
            Put it on tomorrow's dinner
          </Button>
        </Card>
      ) : null}

      <SectionTitle>Your month with me</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              [`${summary.mealsCooked}`, "meals cooked at home"],
              [`${summary.prepPortionsUsed}`, "prepped portions eaten"],
              [`${Math.round(summary.wasteAvoidedGrams / 10) * 10} g`, "food saved as leftovers"],
              [`${summary.savedByLeftovers + summary.savedBySwaps} MAD`, "saved, roughly"],
            ] as const
          ).map(([value, label]) => (
            <div key={label} className="rounded-2xl bg-secondary/40 p-3">
              <p className="font-display text-xl font-semibold">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          No weighing, no guilt — just a kitchen that's working. 🌼
        </p>
      </Card>

      <SectionTitle>Show me your kitchen</SectionTitle>
      <ShowLily
        context={`Household stock: ${(pantry.data ?? [])
          .slice(0, 20)
          .map((p) => p.name)
          .join(", ")}`}
      />


      <SectionTitle>Progress</SectionTitle>
      <div className="grid gap-3">
        {people.map((p) => {
          const start = p.weight_kg ?? null;
          const goal = p.goal_weight_kg ?? null;
          const accent = accentOf(p);
          const toGo = start !== null && goal !== null ? Math.abs(start - goal) : null;
          return (
            <Card key={p.id}>
              <div className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", accent.dot)} />
                <p className="font-display text-[17px] font-semibold">{p.display_name}</p>
              </div>
              {start !== null && goal !== null ? (
                <>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-semibold">{start} kg</span>
                    <span className="text-[13px] text-muted-foreground">→ {goal} kg</span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {toGo === 0
                      ? "Right where you wanted to be 🌼"
                      : `${toGo!.toFixed(1)} kg to go, gently — about ${Math.max(1, Math.round(toGo! / 0.5))} weeks at a comfortable pace.`}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Add a weight and a goal in{" "}
                  <Link to="/settings" className="font-semibold text-caramel hover:underline">
                    My details
                  </Link>
                  .
                </p>
              )}
              <p className="mt-2 text-[12px] text-muted-foreground">
                Daily plan: {p.calorie_target} kcal · {p.protein_target} g protein
              </p>
            </Card>
          );
        })}
      </div>

      <SectionTitle>Lily can help with</SectionTitle>
      <div className="grid gap-2">
        {LINKS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft transition-colors hover:bg-butter/30"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-butter/50 text-caramel">
              <item.icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[16px] font-semibold">{item.label}</span>
              <span className="block truncate text-[12px] text-muted-foreground">{item.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
