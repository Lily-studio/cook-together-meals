import { cn } from "@/lib/utils";

export function CalorieRing({
  value,
  target,
  size = 76,
  label,
}: {
  value: number;
  target: number;
  size?: number;
  label?: string;
}) {
  const pct = target > 0 ? Math.min(1.15, value / target) : 0;
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} className="stroke-secondary" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn("transition-all duration-500", pct > 1.05 ? "stroke-terracotta" : "stroke-caramel")}
        />
      </svg>
      <div className="absolute text-center leading-none">
        <div className="font-display text-base font-semibold">{Math.round(value)}</div>
        <div className="text-[10px] text-muted-foreground">{label ?? `/ ${target}`}</div>
      </div>
    </div>
  );
}

export function MacroBar({
  label,
  value,
  target,
  tone = "caramel",
}: {
  label: string;
  value: number;
  target: number;
  tone?: "caramel" | "olive" | "terracotta";
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const tones = {
    caramel: "bg-caramel",
    olive: "bg-olive",
    terracotta: "bg-terracotta",
  } as const;
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {Math.round(value)}/{target}g
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full transition-all", tones[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Chip({
  children,
  className,
  onClick,
  active,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
        onClick && "transition-colors hover:border-caramel/40 hover:text-foreground",
        active && "border-caramel/60 bg-caramel/12 text-caramel",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
