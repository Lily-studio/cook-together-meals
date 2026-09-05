import lilyImg from "@/assets/lily.png";
import { cn } from "@/lib/utils";

export function LilyAvatar({ className, size = 56 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-butter/50 ring-1 ring-caramel/20",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={lilyImg}
        alt="Lily, your cooking companion"
        width={1024}
        height={1024}
        loading="lazy"
        className="h-[150%] w-auto max-w-none translate-y-[6%] object-contain"
      />
    </span>
  );
}

export function LilyFull({ className }: { className?: string }) {
  return (
    <img
      src={lilyImg}
      alt="Lily, your cooking companion, holding a tagine"
      width={1024}
      height={1024}
      className={cn("h-auto w-full object-contain drop-shadow-sm", className)}
    />
  );
}

export function LilySays({
  children,
  size = 48,
  className,
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <LilyAvatar size={size} />
      <div className="relative flex-1 rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm leading-relaxed shadow-soft">
        {children}
      </div>
    </div>
  );
}
