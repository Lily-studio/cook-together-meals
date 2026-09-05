import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, HeartHandshake, Sparkles, Users } from "lucide-react";
import { LilyFull } from "@/components/lily";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cook with Lily — one kitchen, two goals" },
      {
        name: "description",
        content:
          "Plan a week of Moroccan-friendly meals for two people with different calorie goals. Shared dishes, personalised portions, automatic grocery lists.",
      },
      { property: "og:title", content: "Cook with Lily — one kitchen, two goals" },
      {
        property: "og:description",
        content:
          "Shared meals, personalised portions and a warm little cooking companion who tracks what you both eat.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/today" });
  }, [loading, session, navigate]);

  return (
    <main className="paper min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md px-6 pt-12 pb-16">
        <p className="text-[12px] font-semibold tracking-[0.18em] text-caramel uppercase">
          Cook with Lily
        </p>
        <h1 className="mt-3 font-display text-[2.6rem] leading-[1.05] font-semibold">
          One kitchen.
          <br />
          Two goals.
          <br />
          <span className="text-caramel">Zero fuss.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Lily plans a week of warm, affordable Moroccan-friendly meals you cook once — then serves
          each of you the portion that fits your own goal.
        </p>

        <div className="mt-7 flex flex-col gap-2.5">
          <Link
            to="/auth"
            className="flex items-center justify-center gap-2 rounded-full bg-caramel px-6 py-3.5 text-[15px] font-semibold text-caramel-foreground shadow-lift transition-transform active:scale-[0.98]"
          >
            Start cooking together <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/auth"
            className="flex items-center justify-center rounded-full border border-border bg-card px-6 py-3.5 text-[15px] font-semibold transition-colors hover:bg-secondary"
          >
            I already have an account
          </Link>
        </div>

        <div className="relative mt-10 rounded-[2rem] bg-butter/45 p-6 pb-0">
          <LilyFull className="mx-auto max-w-[240px]" />
        </div>

        <ul className="mt-8 grid gap-3">
          {[
            {
              icon: Users,
              title: "Two people, two targets",
              body: "Different calories, different macros — same pot on the stove.",
            },
            {
              icon: Sparkles,
              title: "Tell Lily what you ate",
              body: "Describe your plate in plain words and get an instant calorie estimate.",
            },
            {
              icon: HeartHandshake,
              title: "Shop once a week",
              body: "Your grocery list builds itself from the plan, sorted by aisle.",
            },
          ].map((f) => (
            <li key={f.title} className="flex gap-3 rounded-3xl bg-card p-4 shadow-soft">
              <f.icon className="mt-0.5 size-5 shrink-0 text-caramel" />
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-[13px] text-muted-foreground">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
