import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  ChefHat,
  Compass,
  Heart,
  LineChart,
  MessagesSquare,
  NotebookPen,
  Package,
  Settings,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilyFull } from "@/components/lily";
import { usePlan } from "@/lib/db";
import { SLOT_LABELS, isoDate } from "@/lib/nutrition";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Your kitchen — Cook with Lily" },
      {
        name: "description",
        content:
          "A warm welcome into your kitchen: what Lily has planned, and every part of Cook with Lily gathered into simple sections.",
      },
      { property: "og:title", content: "Your kitchen — Cook with Lily" },
      {
        property: "og:description",
        content: "Lily welcomes you in and shows you exactly where everything lives.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeHub,
});

type HubPath =
  | "/today"
  | "/week"
  | "/month"
  | "/grocery"
  | "/pantry"
  | "/prep"
  | "/discover"
  | "/favorites"
  | "/tell-lily"
  | "/lily"
  | "/talk"
  | "/settings";

type Tile = {
  emoji: string;
  title: string;
  blurb: string;
  icon: typeof CalendarDays;
  links: { to: HubPath; label: string; icon: typeof CalendarDays }[];
};


const TILES: Tile[] = [
  {
    emoji: "🍽️",
    title: "Meals",
    blurb: "What you're eating today, this week and this month.",
    icon: UtensilsCrossed,
    links: [
      { to: "/today", label: "Today", icon: Sparkles },
      { to: "/week", label: "My week", icon: CalendarDays },
      { to: "/month", label: "My month", icon: CalendarRange },
    ],
  },
  {
    emoji: "🛒",
    title: "Groceries",
    blurb: "Exactly what to buy, sorted the way you walk the shop.",
    icon: ShoppingBasket,
    links: [{ to: "/grocery", label: "Shopping list", icon: ShoppingBasket }],
  },
  {
    emoji: "🏠",
    title: "My kitchen",
    blurb: "What's at home, what to use soon, what's prepped.",
    icon: Package,
    links: [
      { to: "/pantry", label: "My stock", icon: Package },
      { to: "/prep", label: "Prep ahead", icon: ChefHat },
    ],
  },
  {
    emoji: "👩‍🍳",
    title: "Cooking",
    blurb: "Step-by-step cooking and new ideas to try.",
    icon: ChefHat,
    links: [
      { to: "/today", label: "Cook tonight", icon: ChefHat },
      { to: "/discover", label: "Discover something new", icon: Compass },
    ],
  },
  {
    emoji: "❤️",
    title: "Favourites",
    blurb: "The meals you asked Lily to keep.",
    icon: Heart,
    links: [{ to: "/favorites", label: "Saved meals", icon: Heart }],
  },
  {
    emoji: "📊",
    title: "Progress",
    blurb: "What you ate and how the month is going.",
    icon: LineChart,
    links: [
      { to: "/tell-lily", label: "Tell Lily what you ate", icon: NotebookPen },
      { to: "/lily", label: "My summary", icon: LineChart },
    ],
  },
  {
    emoji: "💬",
    title: "Lily",
    blurb: "Don't know where to go? Just ask her.",
    icon: MessagesSquare,
    links: [
      { to: "/talk", label: "Talk to Lily", icon: MessagesSquare },
      { to: "/settings", label: "My household", icon: Settings },
    ],
  },
];

function HomeHub() {
  const { me, householdId } = useApp();
  const today = isoDate(new Date());
  const planQuery = usePlan(householdId, today, today);
  const entries = planQuery.data ?? [];
  const hour = new Date().getHours();
  const nextSlot =
    hour < 10 ? "breakfast" : hour < 12 ? "snack_am" : hour < 15 ? "lunch" : hour < 18 ? "snack_pm" : "dinner";
  const next = entries.find((e) => e.slot === nextSlot) ?? entries[0];
  const partOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <AppShell title="Cook with Lily" subtitle="Lily plans. You cook. 🌼" mood="welcome">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-[2.25rem] bg-butter/50 px-5 pt-6 shadow-soft">
        <div className="pointer-events-none absolute -top-10 -right-8 size-40 rounded-full bg-caramel/10 blur-2xl" />
        <div className="relative flex items-end gap-2">
          <div className="min-w-0 flex-1 pb-6">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-caramel uppercase">
              {partOfDay}
            </p>
            <h2 className="mt-1.5 font-display text-[1.75rem] leading-[1.1] font-semibold">
              Welcome in{me?.display_name ? `, ${me.display_name}` : ""}.
              <br />
              <span className="text-caramel">The kitchen's ready.</span>
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {next?.recipes
                ? `Next up: ${SLOT_LABELS[next.slot] ?? "your meal"} — ${next.recipes.title}.`
                : "Ask me to plan your month and I'll fill the whole calendar."}
            </p>
            <Link
              to="/today"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-caramel px-5 py-2.5 text-sm font-semibold text-caramel-foreground shadow-lift transition-transform active:scale-[0.98]"
            >
              See today <ArrowRight className="size-4" />
            </Link>
          </div>
          <LilyFull className="max-w-[150px] self-end" mood="welcome" />
        </div>
      </section>

      {/* Categories */}
      <h2 className="mt-7 mb-3 font-display text-[15px] font-semibold tracking-wide text-muted-foreground uppercase">
        Everything in its place
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {TILES.map((tile) => (
          <div key={tile.title} className="min-w-0 rounded-3xl bg-card p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-butter/60 text-lg">
                {tile.emoji}
              </span>
              <div className="min-w-0">
                <p className="font-display text-base font-semibold leading-tight">{tile.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{tile.blurb}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tile.links.map((link) => (
                <Link
                  key={link.label + link.to}
                  to={link.to}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-secondary"
                >
                  <link.icon className="size-3.5 text-caramel" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 mb-2 text-center text-[12.5px] text-muted-foreground">
        If you don't know where to go,{" "}
        <Link to="/talk" className="font-semibold text-caramel underline-offset-2 hover:underline">
          just ask Lily
        </Link>
        .
      </p>
    </AppShell>
  );
}
