import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showLily } from "@/lib/vision.functions";

/** Shrinks a phone photo down to something small enough to send. */
async function toDataUrl(file: File, max = 900): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read that photo");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** "Show Lily" — a photo of the dish, the fridge or the packet, and real advice back. */
export function ShowLily({ context = "" }: { context?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (image: string) => {
    setBusy(true);
    setReply(null);
    try {
      const result = await showLily({ data: { image, question, context } });
      if ("error" in result) toast.error(result.error);
      else setReply(result.reply);
    } catch {
      toast.error("Lily couldn't look at that just now — try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await toDataUrl(file);
      setPreview(url);
      await ask(url);
    } catch {
      toast.error("That photo wouldn't open — try another one.");
    }
  };

  return (
    <Card>
      <p className="font-display text-[16px] font-semibold">Show Lily 📸</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        A photo of the pan, the plate or the fridge — she'll tell you what she'd do.
      </p>

      <Input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Anything you want to ask about it?"
        className="mt-2.5 rounded-2xl"
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <Button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mt-2 w-full rounded-full"
      >
        {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Camera className="mr-1 size-4" />}
        {busy ? "Lily's having a look…" : "Take or choose a photo"}
      </Button>

      {preview ? (
        <img
          src={preview}
          alt="The photo you showed Lily"
          className="mt-2.5 max-h-56 w-full rounded-2xl object-cover"
        />
      ) : null}

      {reply ? (
        <p className="mt-2.5 rounded-2xl bg-butter/45 px-3 py-2 text-[13px] whitespace-pre-wrap">
          👩🏻‍🍳 {reply}
        </p>
      ) : null}
    </Card>
  );
}
