import { useEffect, useRef, useState } from "react";
import happy from "@/assets/lily-sheet/happy.webp.asset.json";
import excited from "@/assets/lily-sheet/excited.webp.asset.json";
import thinking from "@/assets/lily-sheet/thinking.webp.asset.json";
import surprised from "@/assets/lily-sheet/surprised.webp.asset.json";
import wink from "@/assets/lily-sheet/wink.webp.asset.json";
import laughing from "@/assets/lily-sheet/laughing.webp.asset.json";
import proud from "@/assets/lily-sheet/proud.webp.asset.json";
import tasting from "@/assets/lily-sheet/tasting.webp.asset.json";
import focused from "@/assets/lily-sheet/focused.webp.asset.json";
import friendly from "@/assets/lily-sheet/friendly.webp.asset.json";
import book from "@/assets/lily-sheet/book.webp.asset.json";
import chopping from "@/assets/lily-sheet/chopping.webp.asset.json";
import stirring from "@/assets/lily-sheet/stirring.webp.asset.json";
import tagine from "@/assets/lily-sheet/tagine.webp.asset.json";
import laptop from "@/assets/lily-sheet/laptop.webp.asset.json";
import front from "@/assets/lily-sheet/front.webp.asset.json";
import { cn } from "@/lib/utils";

export type CharacterMood =
  | "welcome" | "thinking" | "excited" | "cooking" | "wink" | "relaxed" | "surprised" | "shopping" | "heart"
  | "planning" | "presenting" | "chopping" | "celebrating" | "encouraging" | "focused" | "tasting" | "proud" | "standing";

/** Every frame is cut directly from the approved Lily character sheet — no generated faces. */
const FRAMES: Record<CharacterMood, { src: string; blink?: boolean; label: string }> = {
  welcome: { src: happy.url, blink: true, label: "smiling and welcoming you" },
  excited: { src: excited.url, label: "excited" },
  thinking: { src: thinking.url, label: "thoughtfully looking at your food" },
  surprised: { src: surprised.url, label: "pleasantly surprised" },
  wink: { src: wink.url, label: "winking" },
  heart: { src: wink.url, label: "sending a little heart" },
  relaxed: { src: friendly.url, blink: true, label: "chatting with you" },
  encouraging: { src: friendly.url, blink: true, label: "cheering you on" },
  celebrating: { src: laughing.url, label: "celebrating with you" },
  proud: { src: proud.url, label: "proud of you" },
  tasting: { src: tasting.url, label: "tasting — delicious" },
  focused: { src: focused.url, label: "focused" },
  cooking: { src: stirring.url, label: "stirring a pot" },
  chopping: { src: chopping.url, label: "chopping vegetables" },
  presenting: { src: tagine.url, label: "presenting a tagine" },
  shopping: { src: book.url, label: "reading her cookbook" },
  planning: { src: laptop.url, label: "planning at her laptop" },
  standing: { src: front.url, label: "standing in her apron" },
};

export function reactLily(mood: CharacterMood) {
  window.dispatchEvent(new CustomEvent("lily-reaction", { detail: mood }));
}

/** One Lily for every surface: expression frames from the character sheet, with breathing,
 * blinking (closed-eye frame), talking (expression swap) and reactions. */
export function LilyCharacter({ mood = "welcome", className }: { mood?: CharacterMood; className?: string }) {
  const [reaction, setReaction] = useState<CharacterMood | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [visible, setVisible] = useState(true);
  const rig = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = rig.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(e => e.isIntersecting)));
    observer.observe(node);
    const speech = (event: Event) => setSpeaking(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("lily-speech", speech);
    return () => { observer.disconnect(); window.removeEventListener("lily-speech", speech); };
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const receive = (event: Event) => { setReaction((event as CustomEvent<CharacterMood>).detail); clearTimeout(timer); timer = setTimeout(() => setReaction(null), 4500); };
    window.addEventListener("lily-reaction", receive);
    return () => { window.removeEventListener("lily-reaction", receive); clearTimeout(timer); };
  }, []);
  const state: CharacterMood = speaking ? "relaxed" : reaction ?? mood;
  const frame = FRAMES[state] ?? FRAMES.welcome;
  return <span ref={rig} className={cn("lily-rig", className)} data-mood={state} data-speaking={speaking} data-visible={visible} role="img" aria-label={`Lily, ${frame.label}`}>
    <span className="lily-rig-torso" key={state}>
      <img src={frame.src} alt="" className="lily-rig-frame" draggable={false} decoding="async" />
      {frame.blink ? <img src={proud.url} alt="" className="lily-rig-frame lily-rig-blink" draggable={false} decoding="async" /> : null}
      {speaking ? <img src={happy.url} alt="" className="lily-rig-frame lily-rig-talk" draggable={false} decoding="async" /> : null}
    </span>
  </span>;
}
