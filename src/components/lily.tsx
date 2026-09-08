import { useEffect, useState } from "react";
import lilyWelcome from "@/assets/lily-welcome.png";
import lilyThinking from "@/assets/lily-thinking.png";
import lilyExcited from "@/assets/lily-excited.png";
import lilyCooking from "@/assets/lily-cooking.png";
import lilyWink from "@/assets/lily-wink.png";
import lilyRelaxed from "@/assets/lily-relaxed.png";
import lilySurprised from "@/assets/lily-surprised.png";
import lilyShopping from "@/assets/lily-shopping.png";
import lilyHeart from "@/assets/lily-heart.png";
import { cn } from "@/lib/utils";

export type LilyMood =
  | "welcome"
  | "thinking"
  | "excited"
  | "cooking"
  | "wink"
  | "relaxed"
  | "surprised"
  | "shopping"
  | "heart";

const MOODS: Record<LilyMood, { src: string; alt: string }> = {
  welcome: { src: lilyWelcome, alt: "Lily waving hello" },
  thinking: { src: lilyThinking, alt: "Lily thinking about your plan" },
  excited: { src: lilyExcited, alt: "Lily excited about a recipe" },
  cooking: { src: lilyCooking, alt: "Lily cooking at the stove" },
  wink: { src: lilyWink, alt: "Lily winking with a tip" },
  relaxed: { src: lilyRelaxed, alt: "Lily holding meal-prep boxes" },
  surprised: { src: lilySurprised, alt: "Lily pleasantly surprised" },
  shopping: { src: lilyShopping, alt: "Lily with a market basket" },
  heart: { src: lilyHeart, alt: "Lily cheering you on" },
};

/** Little things she says when you tap her. */
const REACTIONS = [
  "Hi love! 🌼",
  "Hungry already?",
  "I've got your week sorted.",
  "Tea while it simmers?",
  "You're doing great 🥰",
];

export function lilyImage(mood: LilyMood = "welcome") {
  return MOODS[mood] ?? MOODS.welcome;
}

/** The blinking eyelid + gentle breathing that make her feel alive. */
function Alive({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      {children}
      <span
        aria-hidden
        className="animate-lily-blink pointer-events-none absolute inset-x-0 top-[26%] h-[10%] rounded-full"
        style={{ background: "linear-gradient(oklch(0.31 0.035 55 / 35%), transparent)" }}
      />
    </span>
  );
}

/**
 * Small full-body Lily, used in headers, nav and chat bubbles — no circle,
 * she simply stands there. `size` is her height. Tap her for a reaction.
 */
export function LilyAvatar({
  className,
  size = 56,
  mood = "welcome",
  interactive = true,
}: {
  className?: string;
  size?: number;
  mood?: LilyMood;
  interactive?: boolean;
}) {
  const img = lilyImage(mood);
  const [say, setSay] = useState<string | null>(null);
  const [poked, setPoked] = useState(0);

  useEffect(() => {
    if (!say) return;
    const t = setTimeout(() => setSay(null), 2200);
    return () => clearTimeout(t);
  }, [say]);

  const poke = () => {
    if (!interactive) return;
    setPoked((n) => n + 1);
    setSay(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]!);
  };

  return (
    <span className="relative inline-flex shrink-0">
      <Alive>
        <span
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={poke}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && poke()}
          aria-label={interactive ? "Say hello to Lily" : undefined}
          className={cn(
            "animate-lily-bob inline-flex shrink-0 items-end justify-center",
            interactive && "cursor-pointer",
            className,
          )}
          style={{ height: size * 1.5, width: size }}
        >
          <img
            key={poked}
            src={img.src}
            alt={img.alt}
            width={768}
            height={768}
            loading="lazy"
            className={cn(
              "h-full w-auto max-w-none object-contain object-bottom drop-shadow-sm",
              poked > 0 && "animate-lily-pop",
            )}
          />
        </span>
      </Alive>
      {say ? (
        <span className="animate-in fade-in slide-in-from-bottom-1 absolute -top-1 left-full z-30 ml-1 w-max rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shadow-soft">
          {say}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Lily standing beside a section, with a little line of her own.
 * Full body, no frame — she belongs to the page.
 */
export function LilyBeside({
  children,
  mood = "welcome",
  height = 132,
  className,
  flip = false,
}: {
  children?: React.ReactNode;
  mood?: LilyMood;
  height?: number;
  className?: string;
  flip?: boolean;
}) {
  const img = lilyImage(mood);
  return (
    <div className={cn("flex items-end gap-3", flip && "flex-row-reverse", className)}>
      <Alive className="shrink-0">
        <img
          src={img.src}
          alt={img.alt}
          width={768}
          height={768}
          loading="lazy"
          style={{ height }}
          className="animate-lily-sway w-auto max-w-none object-contain object-bottom drop-shadow-sm"
        />
      </Alive>
      {children ? (
        <div className="relative mb-3 flex-1 rounded-3xl rounded-bl-sm bg-card px-4 py-3 text-sm leading-relaxed shadow-soft">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Full-body Lily for landing/hero moments — she sways and waves gently. */
export function LilyFull({ className, mood = "welcome" }: { className?: string; mood?: LilyMood }) {
  const img = lilyImage(mood);
  const [waving, setWaving] = useState(false);

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setWaving(true)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setWaving(true)}
      onAnimationEnd={() => setWaving(false)}
      aria-label="Wave at Lily"
      className="relative inline-flex w-full cursor-pointer justify-center"
    >
      <Alive className="w-full justify-center">
        <img
          src={img.src}
          alt={img.alt}
          width={768}
          height={768}
          className={cn(
            "h-auto w-full object-contain drop-shadow-sm",
            waving ? "animate-lily-wave" : "animate-lily-sway",
            className,
          )}
        />
      </Alive>
    </span>
  );
}

/** Lily saying something, with the expression matching what she's doing. */
export function LilySays({
  children,
  size = 52,
  mood = "welcome",
  className,
}: {
  children: React.ReactNode;
  size?: number;
  mood?: LilyMood;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <LilyAvatar size={size} mood={mood} interactive={false} />
      <div className="relative flex-1 rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm leading-relaxed shadow-soft">
        {children}
      </div>
    </div>
  );
}
