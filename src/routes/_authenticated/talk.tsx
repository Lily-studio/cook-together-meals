import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import { useApp } from "@/components/app-context";
import { LilyAvatar } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askLily, type ChatTurn } from "@/lib/chat.functions";
import { thisWeekStart, useGrocery, useLogs, usePlan } from "@/lib/db";
import { usePantry } from "@/lib/pantry";
import { formatStock } from "@/lib/portions";
import { SLOT_LABELS, isoDate } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/talk")({
  head: () => ({
    meta: [
      { title: "Talk to Lily · Cook with Lily" },
      {
        name: "description",
        content:
          "Ask Lily anything about your plan, your groceries or tonight's dinner — she knows your kitchen, your targets and what's in your pantry.",
      },
      { property: "og:title", content: "Talk to Lily · Cook with Lily" },
      {
        property: "og:description",
        content: "Your own little kitchen companion, ready to swap an ingredient or rescue dinner.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TalkToLily,
});

const SUGGESTIONS = [
  "I don't have chicken tonight — what else?",
  "What can I replace rice with?",
  "I'm hungry, what can I eat right now?",
  "What can I prepare tomorrow?",
];

function TalkToLily() {
  const { people, householdId, me } = useApp();
  const today = useMemo(() => isoDate(new Date()), []);
  const plan = usePlan(householdId, today, today);
  const logs = useLogs(householdId, today, today);
  const grocery = useGrocery(householdId, thisWeekStart());
  const pantry = usePantry(householdId);
  const ask = useServerFn(askLily);

  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content: `Hi ${me?.display_name ?? "love"} 🌼 Ask me anything — a missing ingredient, a swap, or what to cook right now.`,
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => {
    const lines: string[] = [];
    people.forEach((p) => {
      lines.push(
        `Person: ${p.display_name} — goal ${p.goal}, ${p.calorie_target} kcal/day, ${p.protein_target} g protein, activity ${p.activity_level}${
          p.weight_kg ? `, ${p.weight_kg} kg` : ""
        }${p.goal_weight_kg ? ` heading to ${p.goal_weight_kg} kg` : ""}. Avoids: ${
          [...(p.allergies ?? []), ...(p.disliked ?? [])].join(", ") || "nothing"
        }.`,
      );
    });
    lines.push(`Today (${today}) plan:`);
    (plan.data ?? []).forEach((e) => {
      lines.push(
        `- ${SLOT_LABELS[e.slot] ?? e.slot}: ${e.recipes?.title ?? e.custom_title ?? "nothing"} (${
          e.recipes?.calories ?? 0
        } kcal per serving)`,
      );
    });
    const eaten = logs.data ?? [];
    if (eaten.length)
      lines.push(
        `Logged today: ${eaten.map((l) => `${l.description} ${l.calories} kcal`).join("; ")}.`,
      );
    const stock = pantry.data ?? [];
    if (stock.length)
      lines.push(
        `Pantry: ${stock.map((i) => `${i.name} ${formatStock(i.quantity, i.unit)}`).join("; ")}.`,
      );
    const list = grocery.data ?? [];
    if (list.length)
      lines.push(`Grocery list this week: ${list.map((i) => `${i.name} ${i.amount}`).join("; ")}.`);
    return lines.join("\n").slice(0, 5800);
  }, [people, plan.data, logs.data, pantry.data, grocery.data, today]);

  const send = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    const next: ChatTurn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(next);
    setText("");
    setBusy(true);
    try {
      const res = await ask({
        data: { context, messages: next.slice(-12).map((t) => ({ role: t.role, content: t.content })) },
      });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        setTurns((prev) => [...prev, { role: "assistant", content: res.reply }]);
      }
    } catch {
      toast.error("Lily couldn't answer just now — try again?");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  return (
    <AppShell title="Talk to Lily" subtitle="She knows your kitchen" mood="wink">
      <div className="grid gap-3">
        {turns.map((t, i) => (
          <div key={i} className={cn("flex items-start gap-2.5", t.role === "user" && "justify-end")}>
            {t.role === "assistant" ? <LilyAvatar size={40} mood="wink" interactive={false} /> : null}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-soft",
                t.role === "assistant"
                  ? "rounded-tl-sm bg-card"
                  : "rounded-tr-sm bg-caramel text-caramel-foreground",
              )}
            >
              {t.content}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="flex items-center gap-2.5">
            <LilyAvatar size={40} mood="thinking" interactive={false} />
            <div className="rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
              thinking…
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
              onClick={() => send(s)}
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
          placeholder="Ask Lily anything…"
          className="rounded-full border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" disabled={busy} className="size-10 shrink-0 rounded-full">
          <Send className="size-4" />
        </Button>
      </form>
    </AppShell>
  );
}
