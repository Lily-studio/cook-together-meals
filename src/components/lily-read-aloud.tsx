import { useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { Button } from "./ui/button";

/** Optional device speech: no external voice service or additional API charge. */
export function LilyReadAloud({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => { setSupported("speechSynthesis" in window); }, []);
  useEffect(() => () => { if (speaking) { window.speechSynthesis.cancel(); window.dispatchEvent(new CustomEvent("lily-speech", { detail: false })); } }, [speaking]);
  if (!supported) return null;
  const read = () => {
    window.speechSynthesis.cancel();
    window.dispatchEvent(new CustomEvent("lily-speech", { detail: false }));
    if (speaking) { setSpeaking(false); return; }
    const speech = new SpeechSynthesisUtterance(text);
    speech.rate = .95;
    const end = () => { setSpeaking(false); window.dispatchEvent(new CustomEvent("lily-speech", { detail: false })); };
    speech.onstart = () => { setSpeaking(true); window.dispatchEvent(new CustomEvent("lily-speech", { detail: true })); };
    speech.onend = end; speech.onerror = end;
    window.speechSynthesis.speak(speech);
  };
  return <Button size="sm" variant="ghost" onClick={read} aria-label={speaking ? "Stop reading Lily’s reply" : "Read Lily’s reply aloud"}>{speaking ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}{speaking ? "Stop" : "Listen"}</Button>;
}