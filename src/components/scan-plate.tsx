import { useId, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, ScanLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { analyzePlate, savePlateDiary } from "@/lib/plate.functions";
import { plateTotals, type Plate } from "@/lib/plate";
import { saveMealBookRecipes } from "@/lib/lily-exec.functions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { LilyAvatar } from "./lily";
import { reactLily } from "./lily-character";
import { toDataUrl } from "./show-lily";
import { SLOTS, SLOT_LABELS } from "@/lib/nutrition";
import { supabase } from "@/integrations/supabase/client";

export function ScanPlate() {
  const prefix = useId();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const analyze = useServerFn(analyzePlate);
  const addDiary = useServerFn(savePlateDiary);
  const saveRecipe = useServerFn(saveMealBookRecipes);
  const qc = useQueryClient();
  const [photo, setPhoto] = useState("");
  const [plate, setPlate] = useState<Plate | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recipeSaved, setRecipeSaved] = useState(false);
  const [id, setId] = useState("");
  const [slot, setSlot] = useState<"breakfast" | "lunch" | "dinner" | "snack_am" | "snack_pm">("lunch");
  const [corrections, setCorrections] = useState("");
  const [error, setError] = useState("");
  const [needsAnalysis, setNeedsAnalysis] = useState(false);
  const saveLock = useRef(false);
  const totals = plate ? plateTotals(plate.components) : null;

  const inspect = async (image: string) => {
    setBusy(true); setError(""); reactLily("thinking");
    try {
      const current = plate ? `Current corrected components: ${plate.components.map(c => `${c.name}: ${c.grams} g`).join("; ")}. Preserve these quantities unless the cook explicitly changes them.` : "";
      const result = await analyze({ data: { image, corrections: `${corrections}\n${current}`.slice(0, 2000) } });
      if ("error" in result) { setError(result.error); return; }
      setPlate(result.plate); setId(previous => previous || crypto.randomUUID()); setSaved(false); setRecipeSaved(false); setNeedsAnalysis(false); reactLily("excited");
    } catch { setError("Lily can't reach your account right now. Nothing was saved."); }
    finally { setBusy(false); }
  };
  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) { setError("Choose an image under 20 MB."); return; }
    setPlate(null); setSaved(false); setRecipeSaved(false); setId(crypto.randomUUID()); setCorrections(""); setError(""); setBusy(true);
    try { const image = await toDataUrl(file, 1200); setPhoto(image); await inspect(image); }
    catch { setError("This photo could not be opened. Try a JPEG or PNG from your gallery."); setBusy(false); }
  };
  const confirm = async () => {
    if (!plate || !totals || saved || saving || needsAnalysis || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      await addDiary({ data: { id, confirmed: true, values: { description: plate.name, slot, calories: totals.calories, protein: totals.protein, carbs: totals.carbs, fat: totals.fat } } });
      await qc.invalidateQueries({ queryKey: ["logs"] }); setSaved(true); reactLily("heart"); toast.success("Added to your food diary");
    } catch (e) { setError(e instanceof Error ? e.message : "Not saved. Please try again."); }
    finally { setSaving(false); saveLock.current = false; }
  };
  const approveRecipe = async () => {
    if (!plate || !totals || recipeSaved || saving || needsAnalysis || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const account = await supabase.auth.getUser();
      if (!account.data.user) throw new Error("Sign in before saving a recipe.");
      const profile = await supabase.from("profiles").select("household_id").eq("id", account.data.user.id).single();
      if (profile.error || !profile.data?.household_id) throw new Error("Your household is unavailable. Recipe not saved.");
      const picturePath = `${profile.data.household_id}/${id}.jpg`;
      const blob = await (await fetch(photo)).blob();
      const upload = await supabase.storage.from("lily-images").upload(picturePath, blob, { contentType: "image/jpeg", upsert: true });
      if (upload.error) throw new Error("Could not save the plate photo. Recipe not saved.");
      await saveRecipe({ data: { recipes: [{ title: plate.name, tagline: "A likely reconstruction of your plate; nutrition is estimated.", cuisine: "Home", meal_types: [slot.startsWith("snack") ? "snack" : slot as "breakfast" | "lunch" | "dinner"], base_servings: 1, ingredients: plate.components.map(c => ({ name: c.name, amount: `${c.grams} g`, category: "Other" })), steps: plate.steps, equipment: [], ...totals, fiber: totals.fiber ?? 0, tags: ["plate-scan", "estimated-nutrition"], picturePath }] } });
      await qc.invalidateQueries({ queryKey: ["recipes"] }); setRecipeSaved(true); reactLily("excited"); toast.success("Saved to Discover and your Meal Book");
    } catch (e) { setError(e instanceof Error ? e.message : "Recipe not saved."); }
    finally { setSaving(false); saveLock.current = false; }
  };
  return <section className="scan-plate my-5 overflow-hidden rounded-[2rem] border border-border/70 bg-card p-4 shadow-soft sm:p-5" aria-labelledby={`${prefix}-title`}>
    <div className="scan-plate-header -m-4 mb-4 flex items-center gap-3 p-4 sm:-m-5 sm:mb-5 sm:p-5"><LilyAvatar size={52} mood={busy ? "thinking" : saved ? "heart" : "welcome"} interactive={false} /><div><p className="text-[10px] font-bold text-caramel uppercase">Your plate, understood gently</p><h2 id={`${prefix}-title`} className="font-display text-2xl font-semibold">Scan My Plate</h2><p className="mt-0.5 text-sm text-muted-foreground">Let me have a look at what’s on your plate.</p></div></div>
    <input ref={camera} aria-label="Take a food photo" type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    <input ref={gallery} aria-label="Choose a food photo" type="file" accept="image/*" className="hidden" onChange={e => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    <div className="scan-photo-actions rounded-[1.5rem] border border-dashed border-caramel/35 bg-secondary/45 p-4"><p className="mb-3 text-center text-[12px] text-muted-foreground">A clear photo in daylight helps Lily estimate your plate.</p><div className="flex flex-wrap justify-center gap-2"><Button className="rounded-full" disabled={busy || saving} onClick={() => camera.current?.click()}><Camera className="size-4" />Take a photo</Button><Button variant="outline" className="rounded-full bg-card" disabled={busy || saving} onClick={() => gallery.current?.click()}><ImagePlus className="size-4" />Choose photo</Button></div></div>
    {photo ? <div className="relative mt-4 overflow-hidden rounded-[1.5rem] bg-secondary shadow-soft"><img src={photo} alt="Your food plate for review" className="max-h-80 min-h-48 w-full object-contain" /><span className="absolute right-3 bottom-3 rounded-full bg-card/90 px-3 py-1 text-[10px] font-bold text-caramel uppercase shadow-soft">Review before saving</span></div> : null}
    {busy ? <p role="status" className="mt-3 text-sm text-muted-foreground">Lily is identifying your plate…</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    {photo && !busy && !plate ? <Button variant="outline" className="mt-3" onClick={() => void inspect(photo)}><ScanLine className="size-4" />Try analysis again</Button> : null}
    {plate && totals ? <div className="plate-review mt-4 space-y-4 rounded-[1.5rem] border border-border/60 bg-background/55 p-4">
      <Label htmlFor={`${prefix}-name`}>Food name</Label><Input id={`${prefix}-name`} value={plate.name} disabled={saved} onChange={e => setPlate({ ...plate, name: e.target.value })} />
      <p className="text-sm text-muted-foreground">{plate.portion} · {plate.method}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.entries(totals).map(([key, value]) => <div key={key} className="border-l-2 border-terracotta pl-3"><p className="text-xs capitalize text-muted-foreground">{key === "calories" ? "Calories" : key}</p><p className="font-semibold">{value ?? "Unknown"}{value !== null ? key === "calories" ? " kcal" : " g" : ""}</p></div>)}</div>
      <p className="text-sm text-muted-foreground">Photo estimates are approximate, especially hidden oils and sauces. {plate.uncertainty}</p>
      {plate.questions.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{plate.questions.map(q => <li key={q}>{q}</li>)}</ul> : null}
      <h3 className="font-display text-lg font-semibold">Plate components</h3>
      <div className="space-y-3">{plate.components.map((c, i) => <div key={i} className="border-b border-border pb-3">
        <div className="flex items-center gap-2"><Input aria-label={`Ingredient ${i + 1}`} disabled={saved || busy} value={c.name} onChange={e => { setNeedsAnalysis(true); setPlate({ ...plate, components: plate.components.map((item, j) => j === i ? { ...item, name: e.target.value } : item) }); }} /><Input aria-label={`Grams of component ${i + 1}`} disabled={saved || busy} type="number" min="0" max="3000" value={c.grams} className="w-24 shrink-0" onChange={e => setPlate({ ...plate, components: plate.components.map((item, j) => j === i ? { ...item, grams: Math.min(3000, Math.max(0, Number(e.target.value))) } : item) })} /><span className="text-xs">g</span><Button variant="ghost" size="icon" disabled={saved || busy || plate.components.length < 2} aria-label={`Remove component ${i + 1}`} onClick={() => setPlate({ ...plate, components: plate.components.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></Button></div>
        <p className="mt-1 text-xs text-muted-foreground">{plateTotals([c]).calories} kcal · {plateTotals([c]).protein} g protein · {plateTotals([c]).carbs} g carbs · {plateTotals([c]).fat} g fat</p>
      </div>)}</div>
      <Label htmlFor={`${prefix}-corrections`}>Ingredient changes, hidden oils or sauces</Label><Textarea id={`${prefix}-corrections`} disabled={saved || busy} value={corrections} onChange={e => { setCorrections(e.target.value); setNeedsAnalysis(true); }} placeholder="It’s tofu, not chicken; one teaspoon of olive oil…" />
      {needsAnalysis ? <p className="text-sm text-muted-foreground">Recalculate your ingredient corrections before saving.</p> : null}
      <Button variant="outline" disabled={busy || saving || saved || (!needsAnalysis && !corrections.trim())} onClick={() => void inspect(photo)}>Recalculate with corrections</Button>
      <div><Label htmlFor={`${prefix}-slot`}>Which meal?</Label><select id={`${prefix}-slot`} disabled={saved} value={slot} onChange={e => setSlot(e.target.value as typeof slot)} className="mt-1 block min-h-11 w-full rounded-lg border border-input bg-card px-3">{SLOTS.map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}</select></div>
      <Button className="min-h-11 w-full" disabled={saving || busy || saved || needsAnalysis || !plate.name.trim() || !plate.components.every(c => c.name.trim())} onClick={() => void confirm()}>{saved ? "Added to Food Diary" : saving ? "Saving…" : "Confirm and Add to Food Diary"}</Button>
      <details className="border-t border-border pt-4"><summary className="cursor-pointer font-display text-lg font-semibold">Reconstructed recipe · 1 serving</summary><p className="mt-2 text-sm text-muted-foreground">{totals.calories} kcal per serving · a likely recipe, not an exact identification</p><ol className="my-3 list-decimal space-y-2 pl-5 text-sm">{plate.steps.map((step, i) => <li key={i}><Textarea aria-label={`Recipe step ${i + 1}`} disabled={recipeSaved || busy || saving} value={step} onChange={e => setPlate({ ...plate, steps: plate.steps.map((s, j) => j === i ? e.target.value : s) })} /></li>)}</ol><Button className="h-auto min-h-11 whitespace-normal" disabled={saving || busy || recipeSaved || needsAnalysis} onClick={() => void approveRecipe()}>{recipeSaved ? "Saved to Discover & Meal Book" : "Approve and Save to Discover & Meal Book"}</Button></details>
    </div> : null}
  </section>;
}