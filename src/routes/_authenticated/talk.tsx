import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilyAvatar } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lilyCommand, type LilyAction } from "@/lib/lily-agent.functions";
import { confirmQuestion, isDestructive, useLilyActions } from "@/lib/lily-actions";
import { thisWeekStart, useGrocery, useLogs, usePlan, usePrepBatches } from "@/lib/db";
import { usePantry } from "@/lib/pantry";
import { formatStock } from "@/lib/portions";
import { methodLabel } from "@/lib/cooking-method";
import { SLOT_LABELS, isoDate } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/talk")({
  head: () => ({
    meta: [
      { title: "Talk to Lily · Cook with Lily" },
      {
        name: "description",
        content:
          "Tell Lily what you want and she does it: swap a meal, remember a preference, add to your kitchen or your list, or take you straight to any page.",
      },
      { property: "og:title", content: "Talk to Lily · Cook with Lily" },
      {
        property: "og:description",
        content: "Your kitchen companion who actually changes things for you — not just chats.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TalkToLily,
});

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
};

function TalkToLily() {
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

  const [turns, setTurns] = useState<Bubble[]>([
    {
      role: "assistant",
      content: `Hi ${me?.display_name ?? "love"} 🌼 Tell me anything — swap a meal, remember what you don't like, add something to your kitchen, or ask me to take you somewhere. I'll actually do it.`,
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => {
    const lines: string[] = [];
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
    return lines.join("\n").slice(0, 8800);
  }, [people, me, plan.data, logs.data, pantry.data, grocery.data, prep.data, today, tomorrow]);

  const scrollDown = () =>
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));

  const carryOut = async (actions: LilyAction[], index: number) => {
    try {
      const result = await run(actions);
      setTurns((prev) =>
        prev.map((t, i) =>
          i === index ? { ...t, pending: undefined, done: result.done, link: result.navigate } : t,
        ),
      );
      if (result.done.length) toast.success(result.done[0]!);
    } catch {
      toast.error("I couldn't save that one — try again?");
      setTurns((prev) => prev.map((t, i) => (i === index ? { ...t, pending: undefined } : t)));
    } finally {
      scrollDown();
    }
  };

  const send = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    const history = [...turns, { role: "user" as const, content: trimmed }];
    setTurns(history);
    setText("");
    setBusy(true);
    try {
      const res = await ask({
        data: {
          context,
          messages: history.slice(-12).map((t) => ({ role: t.role, content: t.content })),
        },
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const needsConfirm = isDestructive(res.actions);
      const bubble: Bubble = {
        role: "assistant",
        content: needsConfirm ? `${res.reply}\n\n${confirmQuestion(res.actions)}` : res.reply,
        pending: needsConfirm ? res.actions : undefined,
      };
      let index = 0;
      setTurns((prev) => {
        index = prev.length;
        return [...prev, bubble];
      });
      if (!needsConfirm && res.actions.length) await carryOut(res.actions, index);
    } catch {
      toast.error("Lily couldn't answer just now — try again?");
    } finally {
      setBusy(false);
      scrollDown();
    }
  };

  return (
    <AppShell title="Talk to Lily" subtitle="She runs your kitchen" mood="wink">
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
                  <Button size="sm" className="rounded-full" onClick={() => void carryOut(t.pending!, i)}>
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
                  onClick={() => navigate({ to: t.link!.to })}
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
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => void send(s)}
              className="rounded-2xl bg-secondary/60 px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-secondary"
            >
              {s}
            </button>
          ))}
        </Card>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="sticky bottom-24 z-20 mt-4 flex gap-2 rounded-full bg-card/95 p-1.5 shadow-lift backdrop-blur lg:bottom-6"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell Lily anything…"
          className="rounded-full border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" disabled={busy} className="size-10 shrink-0 rounded-full">
          <Send className="size-4" />
        </Button>
      </form>
    </AppShell>
  );
}
