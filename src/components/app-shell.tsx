import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  CalendarDays,
  Heart,
  Home,
  Package,
  ShoppingBasket,
  Sparkles,
} from "lucide-react";
import { LilyAvatar, type LilyMood } from "@/components/lily";
import { FloatingVeg } from "@/components/floating-veg";
import { useApp } from "@/components/app-context";
import { cn } from "@/lib/utils";

type NavItem = {
  to: "/today" | "/week" | "/grocery" | "/favorites" | "/lily" | "/pantry" | "/prep" | "/talk";
  label: string;
  icon?: typeof Home;
  lily?: boolean;
  desktopOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: "/today", label: "Home", icon: Home },
  { to: "/week", label: "My Week", icon: CalendarDays },
  { to: "/grocery", label: "Groceries", icon: ShoppingBasket },
  { to: "/favorites", label: "Favourites", icon: Heart },
  { to: "/lily", label: "Lily", lily: true },
  { to: "/talk", label: "Talk to Lily", icon: MessagesSquare, desktopOnly: true },
  { to: "/pantry", label: "My Pantry", icon: Package, desktopOnly: true },
  { to: "/prep", label: "Prep ahead", icon: Sparkles, desktopOnly: true },
];

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
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
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
            );
          })}
        </nav>
        <p className="mt-auto px-3 text-[11px] leading-relaxed text-muted-foreground">
          One kitchen. One meal. Two goals.
        </p>
      </aside>

      <div className="relative z-10 mx-auto w-full max-w-md px-5 lg:mx-0 lg:max-w-none lg:flex-1 lg:px-10">
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
                  <LilyAvatar
                    size={22}
                    mood="wink"
                    interactive={false}
                    className={cn("ring-2", active ? "ring-caramel" : "ring-transparent")}
                  />
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
  return <div className={cn("rounded-3xl bg-card p-4 shadow-soft", className)}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-6 mb-2.5 font-display text-[15px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}
