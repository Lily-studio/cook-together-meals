import { useState } from "react";
import { LilyCharacter, reactLily, type CharacterMood } from "./lily-character";
import head from "@/assets/lily-rig/head.asset.json";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export type LilyMood = CharacterMood;
export function lilyImage(_mood: LilyMood = "welcome") { return { src: head.url, alt: "Lily, your warm illustrated cooking companion" }; }
export function LilyAvatar({ className, size = 56, mood = "welcome", interactive = true }: { className?: string; size?: number; mood?: LilyMood; interactive?: boolean }) {
  const character = <LilyCharacter mood={mood} className="h-full w-full" />;
  return <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size * 1.5 }}>
    {interactive ? <Button variant="ghost" aria-label="Say hello to Lily" className="h-full w-full p-0 hover:bg-transparent" onClick={() => reactLily("excited")}>{character}</Button> : character}
  </span>;
}
export function LilyBeside({ children, mood = "welcome", height = 132, className, flip = false }: { children?: React.ReactNode; mood?: LilyMood; height?: number; className?: string; flip?: boolean }) {
  return <div className={cn("flex items-end gap-3", flip && "flex-row-reverse", className)}>
    <span className="shrink-0" style={{ height, width: height * .72 }}><LilyCharacter mood={mood} className="h-full w-full" /></span>
    {children ? <div className="mb-3 min-w-0 flex-1 rounded-3xl rounded-bl-sm bg-card px-4 py-3 text-sm leading-relaxed shadow-soft">{children}</div> : null}
  </div>;
}
export function LilyFull({ className, mood = "welcome" }: { className?: string; mood?: LilyMood }) {
  const [wave, setWave] = useState(false);
  return <Button variant="ghost" aria-label="Wave at Lily" className={cn("h-auto w-full p-0 hover:bg-transparent", className)} onClick={() => { setWave(true); reactLily("excited"); }}><LilyCharacter mood={wave ? "excited" : mood} className="aspect-[3/4] w-full" /></Button>;
}
export function LilySays({ children, size = 52, mood = "welcome", className }: { children: React.ReactNode; size?: number; mood?: LilyMood; className?: string }) {
  return <div className={cn("flex items-start gap-3", className)}><LilyAvatar size={size} mood={mood} interactive={false} /><div className="relative min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm leading-relaxed shadow-soft">{children}</div></div>;
}