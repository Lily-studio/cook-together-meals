/**
 * Cute hand-drawn vegetables bobbing gently in the background.
 * Purely decorative: pointer-events-none so nothing blocks buttons or text.
 */

const VEG = [
  { emoji: "🥕", top: "8%", left: "4%", size: 30, delay: "0s", dur: "9s" },
  { emoji: "🍅", top: "22%", left: "88%", size: 26, delay: "1.4s", dur: "11s" },
  { emoji: "🍋", top: "46%", left: "6%", size: 24, delay: "2.2s", dur: "10s" },
  { emoji: "🥬", top: "62%", left: "90%", size: 30, delay: "0.6s", dur: "12s" },
  { emoji: "🌽", top: "78%", left: "8%", size: 26, delay: "3s", dur: "10.5s" },
  { emoji: "🫑", top: "88%", left: "84%", size: 24, delay: "1.8s", dur: "9.5s" },
  { emoji: "🍓", top: "35%", left: "94%", size: 22, delay: "2.6s", dur: "13s" },
];

export function FloatingVeg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {VEG.map((v, i) => (
        <span
          key={i}
          className="absolute animate-veg-float opacity-25 blur-[0.2px]"
          style={{
            top: v.top,
            left: v.left,
            fontSize: v.size,
            animationDelay: v.delay,
            animationDuration: v.dur,
          }}
        >
          {v.emoji}
        </span>
      ))}
    </div>
  );
}
