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

export function lilyImage(mood: LilyMood = "welcome") {
  return MOODS[mood] ?? MOODS.welcome;
}

/** Small round Lily, used in headers and chat bubbles. */
export function LilyAvatar({
  className,
  size = 56,
  mood = "welcome",
}: {
  className?: string;
  size?: number;
  mood?: LilyMood;
}) {
  const img = lilyImage(mood);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-butter/50 ring-1 ring-caramel/20",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={img.src}
        alt={img.alt}
        width={768}
        height={768}
        loading="lazy"
        className="h-[135%] w-auto max-w-none translate-y-[4%] object-contain"
      />
    </span>
  );
}

/** Full-body Lily for landing/hero moments. */
export function LilyFull({ className, mood = "welcome" }: { className?: string; mood?: LilyMood }) {
  const img = lilyImage(mood);
  return (
    <img
      src={img.src}
      alt={img.alt}
      width={768}
      height={768}
      className={cn("h-auto w-full object-contain drop-shadow-sm", className)}
    />
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
      <LilyAvatar size={size} mood={mood} />
      <div className="relative flex-1 rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm leading-relaxed shadow-soft">
        {children}
      </div>
    </div>
  );
}
