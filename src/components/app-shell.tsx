import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { CalendarDays, Heart, Home, ShoppingBasket } from "lucide-react";
import { LilyAvatar, type LilyMood } from "@/components/lily";
import { useApp } from "@/components/app-context";
import { cn } from "@/lib/utils";

type NavItem = {
  to: "/today" | "/week" | "/grocery" | "/favorites" | "/lily";
  label: string;
  icon?: typeof Home;
  lily?: boolean;
};

const NAV: NavItem[] = [
  { to: "/today", label: "Home", icon: Home },
  { to: "/week", label: "My Week", icon: CalendarDays },
  { to: "/grocery", label: "Groceries", icon: ShoppingBasket },
  { to: "/favorites", label: "Favourites", icon: Heart },
  { to: "/lily", label: "Lily", lily: true },
];

export function AppShell({
  title,
  subtitle,
  children,
  right,
  mood = "welcome",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
  mood?: LilyMood;
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
    <div className="paper min-h-screen bg-background pb-28">
      <div className="mx-auto w-full max-w-md px-5">
        <header className="flex items-center gap-3 pt-7 pb-5">
          <LilyAvatar size={46} mood={mood} />
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

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-end justify-between px-4 py-2.5">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex w-15 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors",
                  active ? "text-caramel" : "text-muted-foreground",
                )}
              >
                {item.lily ? (
                  <LilyAvatar
                    size={22}
                    mood="wink"
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
