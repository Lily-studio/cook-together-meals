import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Heart,
  Home,
  LogOut,
  Menu,
  MessagesSquare,
  Package,
  Settings,
  ShoppingBasket,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LilyAvatar, type LilyMood } from "@/components/lily";
import { FloatingVeg } from "@/components/floating-veg";
import { useApp } from "@/components/app-context";
import { cn } from "@/lib/utils";

type NavItem = {
  to:
    | "/home"
    | "/today"
    | "/week"
    | "/month"
    | "/grocery"
    | "/favorites"
    | "/lily"
    | "/pantry"
    | "/prep"
    | "/kitchen"
    | "/household"
    | "/talk"
    | "/discover"
    | "/settings";
  label: string;
  icon?: typeof Home;
  lily?: boolean;
  desktopOnly?: boolean;
  /** Which category this belongs to in the laptop sidebar. */
  group?: string;
};

const NAV: NavItem[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/today", label: "Today", icon: Sparkles, group: "🍽️ Meals" },
  { to: "/week", label: "My Week", icon: CalendarDays, desktopOnly: true, group: "🍽️ Meals" },
  { to: "/month", label: "My Month", icon: CalendarRange, desktopOnly: true, group: "🍽️ Meals" },
  { to: "/discover", label: "Discover & Meal Book", icon: BookOpen, desktopOnly: true, group: "📖 Recipes" },
  { to: "/favorites", label: "Favourites", icon: Heart, desktopOnly: true, group: "📖 Recipes" },
  { to: "/grocery", label: "Groceries", icon: ShoppingBasket, group: "🛒 Groceries" },
  { to: "/kitchen", label: "My kitchen today", icon: Home, desktopOnly: true, group: "🏠 My kitchen" },
  { to: "/pantry", label: "My Stock", icon: Package, desktopOnly: true, group: "🏠 My kitchen" },
  { to: "/prep", label: "Prep ahead", icon: Sparkles, desktopOnly: true, group: "🏠 My kitchen" },
  { to: "/household", label: "My household", icon: Users, desktopOnly: true, group: "👨‍👩‍👧 Household" },
  { to: "/settings", label: "Settings", icon: Settings, desktopOnly: true, group: "👨‍👩‍👧 Household" },
  { to: "/lily", label: "Lily", lily: true, group: "💬 Lily" },
  { to: "/talk", label: "Talk to Lily", icon: MessagesSquare, desktopOnly: true, group: "💬 Lily" },
];

function MoreSheet({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const items = NAV.filter((i) => i.desktopOnly);
  const active = items.some((i) => i.to === pathname);
  useEffect(() => setOpen(false), [pathname]);
  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <>
      <button
        type="button"
        aria-label="More"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-w-15 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors",
          active || open ? "text-caramel" : "text-muted-foreground",
        )}
      >
        <Menu className="size-5" />
        More
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="All sections">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[2rem] bg-card px-5 pt-3 pb-8 shadow-soft">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg font-semibold">Everything in your kitchen</p>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-full p-2 text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex min-h-14 items-center gap-2.5 rounded-2xl px-3 py-3 text-sm font-semibold",
                    pathname === item.to ? "bg-butter/70 text-caramel" : "bg-secondary/60 text-foreground",
                  )}
                >
                  {item.icon ? <item.icon className="size-4.5 shrink-0" /> : null}
                  <span className="min-w-0 leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-semibold text-muted-foreground"
            >
              <LogOut className="size-4" /> Log out
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}


export function AppShell({
  title,
  subtitle,
  children,
  right,
  mood = "welcome",
  aside,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
  mood?: LilyMood;
  /** Extra panel shown beside the content on laptops. */
  aside?: ReactNode;
}) {
  const { me, loading } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && me && !me.onboarding_complete && pathname !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [loading, me, pathname, navigate]);

  return (
    <div className="paper min-h-screen bg-background pb-28 lg:flex lg:gap-0 lg:pb-0">
      <FloatingVeg />

      {/* Laptop sidebar */}
      <aside className="sticky top-0 z-20 hidden h-screen w-64 shrink-0 flex-col border-r border-border/70 bg-card/70 px-4 py-7 backdrop-blur lg:flex">
        <div className="flex items-center gap-3 px-2">
          <LilyAvatar size={44} mood="welcome" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold leading-tight">Cook with Lily</p>
            <p className="truncate text-[11px] text-muted-foreground">Lily plans. You cook. 🌼</p>
          </div>
        </div>
        <nav className="mt-7 grid gap-1">
          {NAV.map((item, i) => {
            const active = pathname === item.to;
            const newGroup = item.group && item.group !== NAV[i - 1]?.group;
            return (
              <div key={item.to} className="grid">
                {newGroup ? (
                  <p className="mt-3 mb-1 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {item.group}
                  </p>
                ) : null}
                <Link
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-butter/70 text-caramel"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  )}
                >
                  {item.lily ? (
                    <LilyAvatar size={22} mood="wink" interactive={false} />
                  ) : item.icon ? (
                    <item.icon className="size-4.5" />
                  ) : null}
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>

        <p className="mt-auto px-3 text-[11px] leading-relaxed text-muted-foreground">
          One kitchen. One meal. Two goals.
        </p>
      </aside>

      <div className="relative z-10 mx-auto w-full max-w-md min-w-0 px-5 lg:mx-0 lg:max-w-none lg:flex-1 lg:px-10">
        <header className="flex items-center gap-3 pt-7 pb-5">
          <span className="lg:hidden">
            <LilyAvatar size={46} mood={mood} />
          </span>
          <span className="hidden lg:inline-flex">
            <LilyAvatar size={60} mood={mood} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-semibold leading-tight lg:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="truncate text-[13px] text-muted-foreground lg:text-sm">{subtitle}</p>
            ) : null}
          </div>
          {right}
        </header>

        {aside ? (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8 lg:pb-12">
            <div className="min-w-0">{children}</div>
            <div className="mt-6 lg:sticky lg:top-7 lg:mt-0">{aside}</div>
          </div>
        ) : (
          <div className="mx-auto w-full lg:max-w-3xl lg:pb-12">{children}</div>
        )}
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-md items-end justify-between px-4 py-2.5">
          {NAV.filter((i) => !i.desktopOnly).map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-w-15 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors",
                  active ? "text-caramel" : "text-muted-foreground",
                )}
              >
                {item.lily ? (
                  <LilyAvatar size={20} mood="wink" interactive={false} />
                ) : item.icon ? (
                  <item.icon className="size-5" />
                ) : null}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0 rounded-3xl bg-card p-4 shadow-soft", className)}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-6 mb-2.5 font-display text-[15px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}
