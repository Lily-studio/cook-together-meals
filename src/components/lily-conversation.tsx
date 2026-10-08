import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BookOpen, Check, FileText, Paperclip, Send, Undo2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilyAvatar } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lilyCommand, type LilyAction, type LilyAttachment, type ProposedRecipe } from "@/lib/lily-agent.functions";
import { SERVER_KINDS, runLilyServerActions, saveMealBookRecipes, type ServerAction } from "@/lib/lily-exec.functions";
import { confirmQuestion, isDestructive, useLilyActions } from "@/lib/lily-actions";
import { thisWeekStart, useGrocery, useLogs, usePlan, usePrepBatches } from "@/lib/db";
import { usePantry } from "@/lib/pantry";
import { formatStock } from "@/lib/portions";
import { methodLabel } from "@/lib/cooking-method";
import { useEvents, useFeedback, useHouseholdNotes } from "@/lib/household";
import { SLOT_LABELS, isoDate } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { lilyPageContext } from "@/lib/lily-page-context";

const SUGGESTIONS = [
  "From now on, no carrot sticks as snacks",
  "I don't like today's lunch — same calories please",
  "I bought yoghurt today, it expires on the 4th",
  "Take me to my grocery list",
];

type Bubble = {
  role: "user" | "assistant";
  content: string;
  done?: string[] | undefined;
  link?: { to: string; label: string } | null | undefined;
  pending?: LilyAction[] | undefined;
  files?: { name: string; preview?: string | undefined; n?: number | undefined }[] | undefined;
  failed?: string[] | undefined;
  undoable?: boolean | undefined;
  undone?: boolean | undefined;
  proposals?: ProposedRecipe[] | undefined;
  saved?: number[] | undefined;
};

type Picture = { n: number; name: string; path: string; url: string };
const MAX_PICTURES = 20;
const db = supabase as unknown as { from: (t: string) => any; storage: any };

/** Real-life actions that go through the logged (undoable) server path. */
function toServerRecord(a: LilyAction): LilyAction {
  if (a.kind === "add_event")
    return {
      kind: "record_create",
      table: "household_events",
      values: {
        event_date: a.date,
        slot: a.slot ?? null,
        kind: a.event,
        guests: Math.max(0, Math.round(a.guests ?? 0)),
        note: a.note ?? "",
      },
    };
  if (a.kind === "household_note")
    return { kind: "record_create", table: "household_notes", values: { from_name: a.from ?? "", message: a.message } };
  return a;
}

const MAX_FILE = 5 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|csv|json|html?|xml|ya?ml|rtf)$/i;

function readAs(file: File, how: "url" | "text") {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    if (how === "url") r.readAsDataURL(file);
    else r.readAsText(file);
  });
}

async function shrinkImage(file: File): Promise<string> {
  const url = await readAs(file, "url");
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare this picture");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function toAttachment(file: File): Promise<LilyAttachment> {
  if (file.size > MAX_FILE) throw new Error(`${file.name} is over 5 MB`);
  if (file.type.startsWith("image/"))
    return { name: file.name, mime: "image/jpeg", kind: "image", data: await shrinkImage(file) };
  if (file.type.startsWith("text/") || TEXT_EXT.test(file.name))
    return { name: file.name, mime: file.type || "text/plain", kind: "text", data: await readAs(file, "text") };
  return { name: file.name, mime: file.type || "application/octet-stream", kind: "file", data: await readAs(file, "url") };
}

export default function LilyConversation({ embedded = false, pagePath = "/talk", pageTitle = "", onNavigate }: { embedded?: boolean; pagePath?: string; pageTitle?: string; onNavigate?: () => void }) {
  const { people, householdId, me } = useApp();
  const navigate = useNavigate();
  const today = useMemo(() => isoDate(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }, []);
  const plan = usePlan(householdId, today, tomorrow);
  const logs = useLogs(householdId, today, today);
  const grocery = useGrocery(householdId, thisWeekStart());
  const pantry = usePantry(householdId);
  const prep = usePrepBatches(householdId);
  const ask = useServerFn(lilyCommand);
  const { run } = useLilyActions();
  const runServer = useServerFn(runLilyServerActions);
  const qc = useQueryClient();
  const [files, setFiles] = useState<LilyAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const events = useEvents(householdId, today, isoDate(new Date(Date.now() + 14 * 86_400_000)));
  const notes = useHouseholdNotes(householdId);
  const feedback = useFeedback(householdId);

  const greeting: Bubble = {
    role: "assistant",
    content: `Hi ${me?.display_name ?? "love"} 🌼 Tell me anything — swap a meal, remember what you don't like, add something to your kitchen, or send me up to 20 food pictures and I'll turn them into your own recipes.`,
  };
  const [turns, setTurns] = useState<Bubble[]>([greeting]);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(0);
  const saveRecipes = useServerFn(saveMealBookRecipes);
  const { userId } = useApp();

  // Pick the open conversation back up — it stays until the cook closes it.
  useEffect(() => {
    if (!userId || loaded) return;
    void (async () => {
      const { data } = await db
        .from("lily_conversations")
        .select("id, turns")
        .eq("profile_id", userId)
        .eq("closed", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const saved = data?.turns as { turns?: Bubble[]; pictures?: Picture[] } | undefined;
      if (data && saved?.turns?.length) {
        setConvoId(data.id);
        setTurns(saved.turns);
        setPictures(saved.pictures ?? []);
      }
      setLoaded(true);
    })();
  }, [userId, loaded]);

  // Keep it saved as it grows.
  useEffect(() => {
    if (!loaded || !householdId || !userId || turns.length <= 1) return;
    const t = setTimeout(async () => {
      const payload = { turns, pictures };
      if (convoId) await db.from("lily_conversations").update({ turns: payload }).eq("id", convoId);
      else {
        const { data } = await db
          .from("lily_conversations")
          .insert([{ household_id: householdId, profile_id: userId, turns: payload }])
          .select("id")
          .single();
        if (data) setConvoId(data.id);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [turns, pictures, loaded, convoId, householdId, userId]);

  const closeConversation = async () => {
    if (convoId) await db.from("lily_conversations").update({ closed: true }).eq("id", convoId);
    setConvoId(null);
    setPictures([]);
    setFiles([]);
    setTurns([greeting]);
    toast.success("Conversation closed. Fresh page 🌼");
  };

  const addPicture = async (file: File) => {
    if (!householdId) return;
    const data = await shrinkImage(file);
    const blob = await (await fetch(data)).blob();
    const path = `${householdId}/${crypto.randomUUID()}.jpg`;
    const { error } = await db.storage.from("lily-images").upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw new Error(`Couldn't upload ${file.name}`);
    const { data: signed, error: sErr } = await db.storage
      .from("lily-images")
      .createSignedUrl(path, 60 * 60 * 24 * 60);
    if (sErr) throw new Error(`Couldn't open ${file.name}`);
    setPictures((prev) => {
      if (prev.length >= MAX_PICTURES) return prev;
      return [...prev, { n: prev.length + 1, name: file.name, path, url: signed.signedUrl }];
    });
  };
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => {
    const lines: string[] = [`CURRENT PAGE: ${pagePath}. ${pageTitle ? `Visible page: ${pageTitle}. ` : ""}${lilyPageContext(pagePath).context}`];
    lines.push(`TODAY: ${today} (tomorrow is ${tomorrow}). Slots: breakfast, snack_am, lunch, snack_pm, dinner.`);
    lines.push(`Kitchen equipment: ${methodLabel(me?.cooking_method ?? "regular", me?.cooking_method_note ?? "")}.`);
    people.forEach((p) => {
      lines.push(
        `Person: ${p.display_name} — goal ${p.goal}, ${p.calorie_target} kcal/day, ${p.protein_target} g protein, activity ${p.activity_level}${
          p.weight_kg ? `, ${p.weight_kg} kg` : ""
        }${p.goal_weight_kg ? ` heading to ${p.goal_weight_kg} kg` : ""}. Avoids: ${
          [...(p.allergies ?? []), ...(p.disliked ?? [])].join(", ") || "nothing"
        }. Wants more of: ${(p.prefer_more ?? []).join(", ") || "nothing in particular"}.`,
      );
      if ((p.lily_notes ?? []).length) lines.push(`Remembered for ${p.display_name}: ${p.lily_notes.join("; ")}.`);
    });
    (plan.data ?? []).forEach((e) => {
      lines.push(
        `Plan ${e.plan_date} ${e.slot} (${SLOT_LABELS[e.slot] ?? e.slot}): ${
          e.recipes?.title ?? e.custom_title ?? "nothing"
        } (${e.recipes?.calories ?? 0} kcal per serving)`,
      );
    });
    const eaten = logs.data ?? [];
    if (eaten.length)
      lines.push(`Logged today: ${eaten.map((l) => `${l.description} ${l.calories} kcal`).join("; ")}.`);
    const stock = pantry.data ?? [];
    if (stock.length)
      lines.push(
        `Kitchen stock: ${stock
          .map(
            (i) =>
              `${i.name} ${formatStock(i.quantity, i.unit)}${i.expires_on ? ` (best before ${i.expires_on})` : ""}`,
          )
          .join("; ")}.`,
      );
    const batches = (prep.data ?? []).filter((b) => b.portions_left > 0);
    if (batches.length)
      lines.push(`Prepped and waiting: ${batches.map((b) => `${b.title} ×${b.portions_left}`).join("; ")}.`);
    const list = grocery.data ?? [];
    if (list.length)
      lines.push(`Grocery list this week: ${list.map((i) => `${i.name} ${i.amount}`).join("; ")}.`);
    const upcoming = events.data ?? [];
    if (upcoming.length)
      lines.push(
        `Real life coming up: ${upcoming
          .map(
            (e) =>
              `${e.event_date}${e.slot ? ` ${e.slot}` : " all day"} ${e.kind}${
                e.guests ? ` (+${e.guests} guests)` : ""
              }${e.note ? ` — ${e.note}` : ""}`,
          )
          .join("; ")}.`,
      );
    const messages = (notes.data ?? []).filter((n) => !n.handled);
    if (messages.length)
      lines.push(
        `Household messages waiting: ${messages
          .map((n) => `${n.from_name || "someone"}: ${n.message}`)
          .join("; ")}.`,
      );
    const rated = feedback.data ?? [];
    if (rated.length)
      lines.push(
        `Recent meal feedback: ${rated
          .slice(0, 12)
          .map((f) => `${f.plan_date ?? ""} ${f.slot ?? ""} ${f.rating}`)
          .join("; ")}.`,
      );
    return lines.join("\n").slice(0, 8800);
  }, [
    pagePath,
    pageTitle,
    people,
    me,
    plan.data,
    logs.data,
    pantry.data,
    grocery.data,
    prep.data,
    events.data,
    notes.data,
    feedback.data,
    today,
    tomorrow,
  ]);

  const lastUndoable = turns.reduce((acc, t, i) => (t.undoable && !t.undone ? i : acc), -1);

  const scrollDown = () =>
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));

  const undoLast = async (index: number) => {
    try {
      const res = await runServer({ data: { actions: [{ kind: "undo_last" }], confirmed: true } });
      if (res.needsConfirm) return;
      const r = res.results[0];
      if (!r) return;
      if (!r.ok) return void toast.error(r.message);
      ["plan", "grocery", "pantry", "events", "household-notes", "notes", "feedback", "favorites", "prep", "logs", "recipes"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
      setTurns((prev) => prev.map((t, i) => (i === index ? { ...t, undone: true, done: [...(t.done ?? []), r.message] } : t)));
      toast.success(r.message);
    } catch {
      toast.error("I couldn't undo that — nothing changed.");
    }
  };

  const approve = async (index: number, which: number[]) => {
    const bubble = turns[index];
    if (!bubble?.proposals) return;
    const pick = which.filter((k) => !(bubble.saved ?? []).includes(k));
    if (!pick.length) return;
    try {
      const res = await saveRecipes({
        data: {
          recipes: pick.map((k) => {
            const proposed = bubble.proposals?.[k];
            if (!proposed) throw new Error("Recipe proposal not found");
            const { picture, uncertain: _u, ...r } = proposed;
            const meal_types = r.meal_types.filter((m) => ["breakfast", "lunch", "dinner", "snack", "side"].includes(m)) as (
              "breakfast" | "lunch" | "dinner" | "snack" | "side"
            )[];
            return {
              ...r,
              meal_types: meal_types.length ? meal_types : ["dinner"],
              ingredients: r.ingredients.map((g) => ({ name: g.name, amount: g.amount ?? "", category: g.category || "Other" })),
              picturePath: picture ? (pictures.find((p) => p.n === picture)?.path ?? null) : null,
            };
          }),
        },
      });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setTurns((prev) =>
        prev.map((t, i) =>
          i === index
            ? { ...t, saved: [...(t.saved ?? []), ...pick], done: [...(t.done ?? []), res.message], undoable: true, undone: false }
            : t,
        ),
      );
      toast.success(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? `Not saved: ${e.message}` : "Not saved — try again?");
    }
  };

  const carryOut = async (raw: LilyAction[], index: number) => {
    const actions = raw.filter((a) => a.kind !== "propose_recipes").map(toServerRecord);
    try {
      const isServer = (a: LilyAction) => (SERVER_KINDS as readonly string[]).includes(a.kind);
      const serverActs = actions.filter(isServer) as unknown as ServerAction[];
      const result = await run(actions.filter((a) => !isServer(a)));
      const done = [...result.done];
      const failed: string[] = [];
      let undoable = false;
      let undidOne = false;
      if (serverActs.length) {
        const res = await runServer({ data: { actions: serverActs, confirmed: true } });
        if (!res.needsConfirm) {
          res.results.forEach((r) => (r.ok ? done : failed).push(r.message));
          undoable = res.results.some((r) => r.ok && r.kind !== "undo_last");
          undidOne = res.results.some((r) => r.ok && r.kind === "undo_last");
          ["plan", "grocery", "pantry", "events", "household-notes", "notes", "feedback", "favorites", "prep", "logs", "recipes"].forEach((k) =>
            qc.invalidateQueries({ queryKey: [k] }),
          );
        }
      }
      setTurns((prev) => {
        // An undo through chat retires the Undo button on the change it reversed.
        let target = -1;
        if (undidOne)
          for (let k = index - 1; k >= 0; k--) if (prev[k]?.undoable && !prev[k]?.undone) { target = k; break; }
        return prev.map((t, i) =>
          i === index
            ? { ...t, pending: undefined, done, failed, link: result.navigate, undoable }
            : i === target
              ? { ...t, undone: true }
              : t,
        );
      });
      if (done.length) toast.success(done[0] ?? "Saved");
      else if (failed.length) toast.error(failed[0] ?? "Not saved");
    } catch {
      toast.error("I couldn't save that one — try again?");
      setTurns((prev) => prev.map((t, i) => (i === index ? { ...t, pending: undefined } : t)));
    } finally {
      scrollDown();
    }
  };

  const send = async (message: string) => {
    const trimmed = message.trim();
    if ((!trimmed && !files.length && !pictures.some((p) => !turns.some((t) => t.files?.some((f) => f.n === p.n)))) || busy || uploading) return;
    const attached = files;
    const fresh = pictures.filter((p) => !turns.some((t) => t.files?.some((f) => f.n === p.n)));
    const content = trimmed || "Have a look at this.";
    const history: Bubble[] = [
      ...turns,
      {
        role: "user" as const,
        content,
        files: [
          ...fresh.map((p) => ({ name: `Picture ${p.n}`, preview: p.url, n: p.n })),
          ...attached.map((f) => ({ name: f.name })),
        ],
      },
    ];
    setTurns(history);
    setText("");
    setFiles([]);
    setBusy(true);
    try {
      const res = await ask({
        data: {
          context,
          attachments: attached,
          pictures: pictures.map(({ n, name, url }) => ({ n, name, url })),
          messages: history.slice(-30).map((t) => {
            let c = t.content;
            if (t.files?.length) c += `\n[attached: ${t.files.map((f) => f.name).join(", ")}]`;
            if (t.proposals?.length)
              c += `\n[my proposed recipes: ${t.proposals
                .map((p, k) => `${k + 1}. ${p.title}${p.picture ? ` (from Picture ${p.picture})` : ""}${t.saved?.includes(k) ? " — saved" : ""}`)
                .join("; ")}]`;
            return { role: t.role, content: c.slice(0, 4000) };
          }),
        },
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const needsConfirm = isDestructive(res.actions);
      const proposal = res.actions.find((a) => a.kind === "propose_recipes");
      const proposals =
        proposal && "recipes" in proposal && Array.isArray(proposal.recipes)
          ? proposal.recipes.filter((r) => r && r.title && Array.isArray(r.ingredients) && Array.isArray(r.steps)).slice(0, 20)
          : undefined;
      const bubble: Bubble = {
        role: "assistant",
        content: needsConfirm ? `${res.reply}\n\n${confirmQuestion(res.actions)}` : res.reply,
        pending: needsConfirm ? res.actions : undefined,
        proposals: proposals?.length ? proposals : undefined,
      };
      const index = history.length;
      setTurns([...history, bubble]);
      if (!needsConfirm && res.actions.some((a) => a.kind !== "propose_recipes")) await carryOut(res.actions, index);
    } catch {
      toast.error("Lily couldn't answer just now — try again?");
    } finally {
      setBusy(false);
      scrollDown();
    }
  };

  const content = (
    <>
      <div className="grid gap-3">
        {turns.map((t, i) => (
          <div key={i} className={cn("flex items-start gap-2.5", t.role === "user" && "justify-end")}>
            {t.role === "assistant" ? <LilyAvatar size={40} mood="wink" interactive={false} /> : null}
            <div className="min-w-0 max-w-[80%] space-y-2">
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-soft",
                  t.role === "assistant"
                    ? "rounded-tl-sm bg-card"
                    : "rounded-tr-sm bg-caramel text-caramel-foreground",
                )}
              >
                {t.content}
              </div>

              {t.files?.length ? (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {t.files.map((f, k) =>
                    f.preview ? (
                      <img key={k} src={f.preview} alt={f.name} className="size-20 rounded-xl object-cover shadow-soft" />
                    ) : (
                      <span key={k} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11.5px]">
                        <FileText className="size-3.5" /> {f.name}
                      </span>
                    ),
                  )}
                </div>
              ) : null}

              {t.failed?.length ? (
                <ul className="grid gap-1 rounded-2xl bg-destructive/10 px-3 py-2 text-[12.5px] text-foreground/80">
                  {t.failed.map((d, k) => (
                    <li key={k}>{d}</li>
                  ))}
                </ul>
              ) : null}

              {t.undoable && !t.undone && t.role === "assistant" && i === lastUndoable ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full px-2 text-[12px]"
                  onClick={() => void undoLast(i)}
                >
                  <Undo2 className="mr-1 size-3.5" /> Undo
                </Button>
              ) : null}

              {t.proposals?.length ? (
                <div className="grid gap-2">
                  {t.proposals.map((r, k) => {
                    const pic = r.picture ? pictures.find((p) => p.n === r.picture) : null;
                    const isSaved = t.saved?.includes(k);
                    return (
                      <details key={k} className="overflow-hidden rounded-2xl bg-card shadow-soft">
                        <summary className="flex cursor-pointer items-center gap-3 p-2.5">
                          {pic ? (
                            <img src={pic.url} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">{r.emoji}</span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-semibold leading-tight">
                              {k + 1}. {r.title}
                            </span>
                            <span className="block text-[11.5px] text-muted-foreground">
                              {r.cuisine} · {(r.meal_types ?? []).join("/")} · {r.calories} kcal · {r.protein} g protein ·{" "}
                              {(r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)} min
                            </span>
                          </span>
                          {isSaved ? <Check className="size-4 shrink-0 text-olive" /> : null}
                        </summary>
                        <div className="grid gap-2 px-3 pb-3 text-[12.5px]">
                          {r.tagline ? <p className="text-muted-foreground">{r.tagline}</p> : null}
                          <p>
                            <b>Serves</b> {r.base_servings} · <b>Equipment</b> {(r.equipment ?? []).join(", ") || "basic kitchen"}
                          </p>
                          <ul className="list-disc pl-4">
                            {r.ingredients.map((g, j) => (
                              <li key={j}>
                                {g.amount} {g.name}
                              </li>
                            ))}
                          </ul>
                          <ol className="list-decimal pl-4">
                            {r.steps.map((st, j) => (
                              <li key={j}>{st}</li>
                            ))}
                          </ol>
                          {r.uncertain?.length ? (
                            <p className="rounded-xl bg-secondary/60 px-2.5 py-1.5 text-[12px]">
                              Not sure about: {r.uncertain.join("; ")}
                            </p>
                          ) : null}
                          {!isSaved ? (
                            <Button size="sm" className="justify-self-start rounded-full" onClick={() => void approve(i, [k])}>
                              <BookOpen className="mr-1 size-3.5" /> Save to my Meal Book
                            </Button>
                          ) : null}
                        </div>
                      </details>
                    );
                  })}
                  {t.proposals.length > 1 && (t.saved?.length ?? 0) < t.proposals.length ? (
                    <Button size="sm" className="justify-self-start rounded-full" onClick={() => void approve(i, (t.proposals ?? []).map((_, k) => k))}>
                      <Check className="mr-1 size-3.5" /> Approve all & save
                    </Button>
                  ) : null}
                  <p className="text-[11.5px] text-muted-foreground">Want changes? Just tell me — e.g. "make the second one spicier".</p>
                </div>
              ) : null}

              {t.done?.length ? (
                <ul className="grid gap-1 rounded-2xl bg-olive/10 px-3 py-2 text-[12.5px] text-foreground/80">
                  {t.done.map((d, k) => (
                    <li key={k} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-olive" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {t.pending ? (
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-full" onClick={() => void carryOut(t.pending ?? [], i)}>
                    Yes, do it
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() =>
                      setTurns((prev) =>
                        prev.map((b, k) =>
                          k === i ? { ...b, pending: undefined, done: ["Left just as it was."] } : b,
                        ),
                      )
                    }
                  >
                    No, leave it
                  </Button>
                </div>
              ) : null}

              {t.link ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => { if (t.link) { onNavigate?.(); void navigate({ to: t.link.to }); } }}
                >
                  {t.link.label}
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="flex items-center gap-2.5">
            <LilyAvatar size={40} mood="thinking" interactive={false} />
            <div className="rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
              on it…
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {turns.length <= 1 ? (
        <Card className="mt-4 grid gap-2">
          {[...lilyPageContext(pagePath).suggestions, ...SUGGESTIONS].slice(0, 4).map((s) => (
            <Button variant="secondary"
              key={s}
              onClick={() => void send(s)}
              className="h-auto justify-start whitespace-normal rounded-2xl px-3 py-2.5 text-left text-[13px] font-medium"
            >
              {s}
            </Button>
          ))}
        </Card>
      ) : null}

      {turns.length > 1 ? (
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="ghost" className="rounded-full text-[12px]" onClick={() => void closeConversation()}>
            <X className="mr-1 size-3.5" /> Close conversation
          </Button>
        </div>
      ) : null}

      {pictures.some((p) => !turns.some((t) => t.files?.some((f) => f.n === p.n))) || uploading ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {pictures
            .filter((p) => !turns.some((t) => t.files?.some((f) => f.n === p.n)))
            .map((p) => (
              <span key={p.n} className="relative">
                <img src={p.url} alt={`Picture ${p.n}`} className="size-14 rounded-xl object-cover shadow-soft" />
                <span className="absolute left-1 top-1 rounded-full bg-card px-1.5 text-[10px] font-bold">{p.n}</span>
              </span>
            ))}
          {uploading ? <span className="self-center text-[12px] text-muted-foreground">Uploading {uploading}…</span> : null}
        </div>
      ) : null}

      {files.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {files.map((f, k) => (
            <span key={k} className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-[12px] shadow-soft">
              {f.kind === "image" ? <img src={f.data} alt="" className="size-5 rounded object-cover" /> : <FileText className="size-3.5" />}
              <span className="max-w-[140px] truncate">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((_, j) => j !== k))}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className={cn("sticky z-20 mt-4 flex gap-2 rounded-full bg-card/95 p-1.5 shadow-lift backdrop-blur", embedded ? "bottom-0" : "bottom-24 lg:bottom-6")}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,text/*"
          className="hidden"
          onChange={async (e) => {
            const list = Array.from(e.target.files ?? []);
            e.target.value = "";
            for (const f of list) {
              try {
                if (f.type.startsWith("image/")) {
                  if (pictures.length + uploading >= MAX_PICTURES) {
                    toast.error(`Up to ${MAX_PICTURES} pictures per conversation — close it to start fresh.`);
                    continue;
                  }
                  setUploading((u) => u + 1);
                  try {
                    await addPicture(f);
                  } finally {
                    setUploading((u) => u - 1);
                  }
                  continue;
                }
                const a = await toAttachment(f);
                setFiles((p) => (p.length >= 4 ? p : [...p, a]));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : `Couldn't read ${f.name}`);
              }
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Attach a photo or file"
          className="size-10 shrink-0 rounded-full"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="size-4" />
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Message Lily"
          placeholder="Tell Lily anything…"
          className="rounded-full border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button type="submit" aria-label="Send message" size="icon" disabled={busy || uploading > 0} className="size-10 shrink-0 rounded-full">
          <Send className="size-4" />
        </Button>
      </form>
    </>
  );
  return embedded ? <div className="lily-conversation-body">{content}</div> : <AppShell title="Talk to Lily" subtitle="She runs your kitchen" mood="wink">{content}</AppShell>;
}
