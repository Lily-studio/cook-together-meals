import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { FoodLog } from "@/lib/db";
import { editPlateDiary } from "@/lib/plate.functions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SLOT_LABELS, SLOTS } from "@/lib/nutrition";

export function FoodDiary({ logs, target }: { logs: FoodLog[]; target: number }) {
  const edit = useServerFn(editPlateDiary);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<FoodLog | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = (key: "calories" | "protein" | "carbs" | "fat") => Math.round(logs.reduce((sum, l) => sum + l[key], 0));
  const save = async (log: FoodLog, remove = false) => {
    setBusy(true);
    try {
      await edit({ data: { id: log.id, confirmed: true, values: remove ? null : { description: log.description, slot: SLOTS.includes(log.slot as typeof SLOTS[number]) ? log.slot as typeof SLOTS[number] : "snack_pm", calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat } } });
      await qc.invalidateQueries({ queryKey: ["logs"] }); setDraft(null); setDeleting(null); toast.success(remove ? "Entry deleted" : "Entry updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Nothing changed"); }
    finally { setBusy(false); }
  };
  return <section className="mt-5 border-t border-border pt-5"><h2 className="font-display text-xl font-semibold">Your food diary today</h2><p className="mt-2 text-sm">{total("calories")} kcal eaten · {Math.max(0, target - total("calories"))} kcal remaining</p><p className="text-xs text-muted-foreground">Protein {total("protein")} g · Carbs {total("carbs")} g · Fat {total("fat")} g</p>
    {!logs.length ? <p className="mt-4 text-sm text-muted-foreground">Nothing logged yet.</p> : logs.map(log => <div key={log.id} className="mt-4 border-b border-border pb-4">
      {draft?.id === log.id ? <div className="space-y-2"><Input aria-label="Diary food name" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /><select aria-label="Diary meal category" value={draft.slot} onChange={e => setDraft({ ...draft, slot: e.target.value })} className="min-h-11 rounded-lg border border-input bg-card px-3">{SLOTS.map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}</select><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(["calories", "protein", "carbs", "fat"] as const).map(key => <label key={key} className="text-xs capitalize">{key}<Input aria-label={`Diary ${key}`} type="number" min="0" value={draft[key]} onChange={e => setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value)) })} /></label>)}</div><Button disabled={busy} onClick={() => void save(draft)}>Save changes</Button><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button></div> : <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{log.description}</p><p className="text-xs text-muted-foreground">{SLOT_LABELS[log.slot] ?? "Snack"} · {log.calories} kcal</p></div><Button size="icon" variant="ghost" aria-label={`Edit ${log.description}`} onClick={() => setDraft(log)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${log.description}`} onClick={() => setDeleting(log.id)}><Trash2 className="size-4" /></Button></div>}
      {deleting === log.id ? <div className="mt-2 flex flex-wrap items-center gap-2"><p className="text-sm">Delete this diary entry?</p><Button variant="destructive" disabled={busy} onClick={() => void save(log, true)}>Delete entry</Button><Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button></div> : null}
    </div>)}
  </section>;
}