import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChartPie,
  Compass,
  Heart,
  Home,
  MessageCircleHeart,
  Settings,
  ShoppingBasket,
  Soup,
  UtensilsCrossed,
} from "lucide-react";
import { LilyAvatar } from "@/components/lily";
import { useApp } from "@/components/app-context";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/today", label: "Today", icon: Home },
  { to: "/week", label: "Week", icon: CalendarDays },
  { to: "/tell-lily", label: "Tell Lily", icon: MessageCircleHeart, center: true },
  { to: "/grocery", label: "Shop", icon: ShoppingBasket },
] as const;

const MORE = [
  { to: "/discover", label: "Discover recipes", icon: Compass },
  { to: "/favorites", label: "Favourites", icon: Heart },
  { to: "/prep", label: "Meal prep", icon: Soup },
  { to: "/dashboard", label: "Progress", icon: ChartPie },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  const { me, loading } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!loading && me && !me.onboarding_complete && pathname !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [loading, me, pathname, navigate]);

  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <div className="paper min-h-screen bg-background pb-28">
      <div className="mx-auto w-full max-w-md px-5">
        <header className="flex items-center gap-3 pt-7 pb-5">
          <LilyAvatar size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-semibold leading-tight">{title}</h1>
            {subtitle ? (
              <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {right}
        </header>
        {children}
      </div>

      {moreOpen ? (
        <div
          className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-[2px]"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-card p-5 pb-28 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <div className="grid gap-1">
              {MORE.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  <item.icon className="size-4.5 text-caramel" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-end justify-between px-5 py-2.5">
          {NAV.map((item) => {
            const active = pathname === item.to;
            if (item.center) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="-mt-7 flex flex-col items-center gap-1"
                  aria-label="Tell Lily what you ate"
                >
                  <span
                    className={cn(
                      "flex size-13 items-center justify-center rounded-full bg-caramel text-caramel-foreground shadow-lift transition-transform",
                      active && "scale-105 ring-4 ring-butter/60",
                    )}
                  >
                    <item.icon className="size-6" />
                  </span>
                  <span className="text-[10px] font-semibold text-caramel">{item.label}</span>
                </Link>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex w-14 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors",
                  active ? "text-caramel" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex w-14 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors",
              moreOpen ? "text-caramel" : "text-muted-foreground",
            )}
          >
            <UtensilsCrossed className="size-5" />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl bg-card p-4 shadow-soft", className)}>{children}</div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-6 mb-2.5 font-display text-[15px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}
