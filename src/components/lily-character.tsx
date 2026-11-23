import { useEffect, useState } from "react";
import head from "@/assets/lily-rig/head.asset.json";
import body from "@/assets/lily-rig/body.asset.json";
import wave from "@/assets/lily-rig/wave.asset.json";
import arm from "@/assets/lily-rig/arm.asset.json";
import blink from "@/assets/lily-rig/blink.asset.json";
import think from "@/assets/lily-rig/think.asset.json";
import { cn } from "@/lib/utils";

export type CharacterMood = "welcome" | "thinking" | "excited" | "cooking" | "wink" | "relaxed" | "surprised" | "shopping" | "heart";
export function reactLily(mood: CharacterMood) {
  window.dispatchEvent(new CustomEvent("lily-reaction", { detail: mood }));
}
/** Hierarchical cut-out rig: shoulder, neck and hair have independent pivots.
 * Face swaps blink without covering the illustration in a fake eyelid overlay. */
export function LilyCharacter({ mood = "welcome", className }: { mood?: CharacterMood; className?: string }) {
  const [reaction, setReaction] = useState<CharacterMood | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const receive = (event: Event) => { setReaction((event as CustomEvent<CharacterMood>).detail); clearTimeout(timer); timer = setTimeout(() => setReaction(null), 4500); };
    window.addEventListener("lily-reaction", receive);
    return () => { window.removeEventListener("lily-reaction", receive); clearTimeout(timer); };
  }, []);
  const state = reaction ?? mood;
  return <span className={cn("lily-rig", className)} data-mood={state} role="img" aria-label={`Lily, ${state === "thinking" ? "thoughtfully looking at your food" : "your smiling cooking companion"}`}>
    <span className="lily-rig-torso">
      <img src={body.url} alt="" className="lily-rig-body" draggable={false} />
      <span className="lily-rig-arm-left"><img src={arm.url} alt="" draggable={false} /></span>
      <span className="lily-rig-arm-wave"><img src={wave.url} alt="" draggable={false} /></span>
      <span className="lily-rig-neck">
        <span className="lily-rig-hair"><img src={head.url} alt="" draggable={false} /></span>
        <img src={head.url} alt="" className="lily-rig-face lily-rig-face-open" draggable={false} />
        <img src={blink.url} alt="" className="lily-rig-face lily-rig-face-blink" draggable={false} />
        <img src={think.url} alt="" className="lily-rig-face lily-rig-face-think" draggable={false} />
      </span>
    </span>
  </span>;
}