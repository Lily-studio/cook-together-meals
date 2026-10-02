import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import lily3dHome from "@/assets/lily-3d-home.jpg";
import lilyPlans from "@/assets/home-lily-plans.jpg";
import shopWeekly from "@/assets/home-shop-weekly.jpg";
import twoPortions from "@/assets/home-two-portions.jpg";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/home" });
  }, [loading, session, navigate]);

  return (
    <main className="landing-scene min-h-screen overflow-hidden bg-background">
      <nav className="relative z-30 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10 lg:py-7">
        <Link to="/" className="group inline-flex items-center gap-3" aria-label="Cook with Lily home">
          <span className="landing-brand-mark grid size-10 place-items-center rounded-[14px] font-display text-xl font-semibold italic text-caramel">
            L
          </span>
          <span className="font-display text-xl font-semibold sm:text-2xl">
            Cook with <span className="italic text-caramel">Lily</span>
          </span>
        </Link>
        <Link
          to="/auth"
          className="landing-secondary-action inline-flex min-h-11 items-center justify-center rounded-full border border-border/80 bg-card/80 px-5 text-sm font-semibold shadow-soft backdrop-blur transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Sign in
        </Link>
      </nav>

      <section className="relative mx-auto grid min-h-[calc(100svh-84px)] w-full max-w-7xl items-center gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-10 lg:pb-24">
        <div className="relative z-20 pt-8 lg:pt-0">
          <div className="landing-kicker inline-flex items-center gap-2 rounded-full border border-caramel/20 bg-card/70 px-4 py-2 shadow-soft backdrop-blur">
            <Sparkles className="size-3.5 text-caramel" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-caramel uppercase">
              Lily plans. You cook. 🌼
            </span>
          </div>

          <h1 className="landing-title mt-7 max-w-xl font-display text-[clamp(3.25rem,8vw,6.75rem)] leading-[0.92] font-semibold">
            One kitchen.
            <br />
            Two goals.
            <br />
            <span className="italic text-caramel">Zero fuss.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            Lily plans a week of warm, affordable Moroccan-friendly meals you cook once — then serves
            each of you the portion that fits your own goal.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="landing-primary-action group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-caramel px-7 text-[15px] font-semibold text-caramel-foreground shadow-lift transition-transform hover:-translate-y-1 active:translate-y-0"
            >
              Start cooking together
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/auth"
              className="landing-secondary-action inline-flex min-h-14 items-center justify-center rounded-full border border-border bg-card/85 px-7 text-[15px] font-semibold shadow-soft backdrop-blur transition-transform hover:-translate-y-1 active:translate-y-0"
            >
              I already have an account
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            {["Shared meals", "Personal portions", "Automatic shopping"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-mint/30 text-olive">
                  <Check className="size-3" strokeWidth={2.5} />
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="landing-stage relative z-10 mx-auto w-full max-w-[650px] [perspective:1400px]">
          <div className="landing-orbit landing-orbit-one" aria-hidden />
          <div className="landing-orbit landing-orbit-two" aria-hidden />
          <div className="landing-hero-frame relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-card/80 bg-secondary shadow-hero sm:rounded-[2.5rem]">
            <img
              src={lily3dHome}
              alt="Lily presenting one shared Moroccan-inspired meal in two portions"
              width={1200}
              height={1500}
              className="h-full w-full object-cover"
              fetchPriority="high"
            />
            <div className="landing-photo-shade absolute inset-0" aria-hidden />
            <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-card/50 bg-card/75 p-4 shadow-lift backdrop-blur-md sm:inset-x-7 sm:bottom-7 sm:p-5">
              <p className="text-[10px] font-bold tracking-[0.16em] text-caramel uppercase">Tonight, sorted</p>
              <p className="mt-1 font-display text-xl font-semibold sm:text-2xl">One beautiful meal, portioned for both.</p>
            </div>
          </div>

          <div className="landing-float-card landing-float-top absolute -top-4 right-2 hidden items-center gap-3 rounded-2xl border border-card bg-card/90 p-3 shadow-float backdrop-blur sm:flex lg:-right-7 lg:top-20">
            <span className="grid size-10 place-items-center rounded-xl bg-butter/50 text-xl">🌼</span>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Lily has planned</p>
              <p className="text-sm font-semibold">Your whole week</p>
            </div>
          </div>
          <div className="landing-float-card landing-float-bottom absolute -bottom-5 left-3 hidden items-center gap-3 rounded-2xl border border-card bg-card/90 p-3 shadow-float backdrop-blur sm:flex lg:-left-8 lg:bottom-20">
            <span className="grid size-10 place-items-center rounded-xl bg-mint/25 text-xl">✓</span>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Same cooking</p>
              <p className="text-sm font-semibold">Personal portions</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 border-y border-border/60 bg-card/45 py-20 backdrop-blur-sm sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-caramel uppercase">Everything taken care of</p>
            <h2 className="mt-3 font-display text-4xl leading-tight font-semibold sm:text-5xl">
              A calmer way to cook together.
            </h2>
          </div>

          <ul className="mt-12 grid gap-5 md:grid-cols-3 md:gap-6 [perspective:1200px]">
            {[
              {
                image: twoPortions,
                title: "Two people, two targets",
                body: "Different calories, different macros — same pot on the stove.",
                alt: "Two coordinated Moroccan bowls in different portion sizes",
              },
              {
                image: lilyPlans,
                title: "Tell Lily what you ate",
                body: "Describe your plate in plain words and get an instant calorie estimate.",
                alt: "A tactile recipe planner and measuring spoon",
              },
              {
                image: shopWeekly,
                title: "Shop once a week",
                body: "Your grocery list builds itself from the plan, sorted by aisle.",
                alt: "A woven market basket filled with fresh produce",
              },
            ].map((feature, index) => (
              <li key={feature.title} className="landing-feature group relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-soft">
                <div className="aspect-[5/4] overflow-hidden bg-secondary">
                  <img
                    src={feature.image}
                    alt={feature.alt}
                    width={768}
                    height={768}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
                  />
                </div>
                <div className="relative p-5 sm:p-6">
                  <span className="absolute -top-5 right-5 grid size-10 place-items-center rounded-full border border-card bg-background font-display text-sm font-semibold text-caramel shadow-soft">
                    0{index + 1}
                  </span>
                  <h3 className="font-display text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
