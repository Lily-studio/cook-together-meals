import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarPlus, MessageSquarePlus, Minus, Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, SectionTitle } from "@/components/app-shell";
import { accentOf, useApp } from "@/components/app-context";
import { LilySays } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/macro";
import { useAddPartner, usePlan, useRecipes, useRemovePartner } from "@/lib/db";
import {
  EVENT_KINDS,
  eventLabel,
  guestsFor,
  useEventMutations,
  useEvents,
  useFeedback,
  useHouseholdNotes,
  useNoteMutations,
} from "@/lib/household";
import { noticePatterns } from "@/lib/patterns";
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  SLOTS,
  SLOT_LABELS,
  computeTargets,
  isoDate,
  prettyDate,
  type Goal,
} from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/household")({
  head: () => ({
    meta: [
      { title: "My household — Cook with Lily" },
      {
        name: "description",
        content:
          "Everyone who eats here, guests who come for one evening, the days you're out, and the messages your house leaves for Lily.",
      },
      { property: "og:title", content: "My household — Cook with Lily" },
      {
        property: "og:description",
        content: "Any number of people, each with their own goals — one shared meal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HouseholdPage;
});

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

/* ---------------- guests, just for one meal ---------------- */

function GuestMode({ today }: { today: string }) {
  const { householdId } = useApp();
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<string>("dinner");
  const events = useEvents(householdId, today, addDays(today, 27));
  const { setGuests } = useEventMutations(householdId);

  const current = guestsFor(events.data ?? [], date, slot);

  const change = (delta: number) => {
    const next = Math.max(0, current + delta);
    setGuests.mutate(
      { event_date: date, slot, guests: next },
      {
        onSuccess: () =>
          toast.success(
            next === 0
              ? "No extra guests — back to just the house."
              : `${next} extra plate${next === 1 ? "" : "s"} for ${(SLOT_LABELS[slot] ?? slot).toLowerCase()} 🌼`,
          ),
      },
    );
  };

  return (
    <Card className="grid gap-3">
      <p className="text-[12.5px] text-muted-foreground">
        People coming over? Add the plates just for that meal — nobody gets added to your household.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {[0, 1, 2].map((offset) => {
          const iso = addDays(today, offset);
          return (
            <Chip key={iso} active={date === iso} onClick={() => setDate(iso)}>
              {offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : prettyDate(new Date(iso))}
            </Chip>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SLOTS.map((s) => (
          <Chip key={s} active={slot === s} onClick={() => setSlot(s)}>
            {SLOT_LABELS[s]}
          </Chip>
        ))}
      </div>
      <div className="flex items-center justify-center gap-5 rounded-3xl bg-butter/50 py-3">
        <button
          onClick={() => change(-1)}
          aria-label="One fewer guest"
          className="grid size-10 place-items-center rounded-full bg-card text-caramel shadow-soft"
        >
          <Minus className="size-4" />
        </button>
        <span className="flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-semibold tabular-nums">{current}</span>
          <span className="text-[12px] text-muted-foreground">guest{current === 1 ? "" : "s"}</span>
        </span>
        <button
          onClick={() => change(1)}
          aria-label="One more guest"
          className="grid size-10 place-items-center rounded-full bg-card text-caramel shadow-soft"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </Card>
  );
}

/* ---------------- real life ---------------- */

function RealLife({ today }: { today: string }) {
  const { householdId } = useApp();
  const events = useEvents(householdId, today, addDays(today, 27));
  const { add, remove } = useEventMutations(householdId);
  const [kind, setKind] = useState("eating_out");
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<string>("dinner");
  const [count, setCount] = useState(2);
  const [note, setNote] = useState("");

  const chosen = EVENT_KINDS.find((k) => k.value === kind)!;
  const upcoming = (events.data ?? []).filter((e) => e.event_date >= today);

  const save = () => {
    add.mutate(
      {
        event_date: date,
        slot: slot === "all" ? null : slot,
        kind,
        guests: chosen.counts ? count : 0,
        note,
      },
      {
        onSuccess: () => {
          setNote("");
          toast.success(
            chosen.skips
              ? "Noted — I'll leave that meal out of your plan."
              : chosen.quick
                ? "Noted — I'll keep that one quick."
                : "Noted — extra plates it is.",
          );
        },
      },
    );
  };

  return (
    <Card className="grid gap-3">
      <p className="text-[12.5px] text-muted-foreground">
        Tell me what's happening and I'll adjust only those meals — the rest of your plan stays exactly as
        it is.
      </p>
      <div className="grid gap-2">
        {EVENT_KINDS.map((k) => (
          <button
            key={k.value}
            onClick={() => setKind(k.value)}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
              kind === k.value ? "bg-caramel/15 ring-1 ring-caramel/40" : "bg-secondary/60 hover:bg-secondary",
            )}
          >
            <span className="text-lg">{k.emoji}</span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold">{k.label}</span>
              <span className="block truncate text-[12px] text-muted-foreground">{k.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[12px] font-medium text-muted-foreground">
          Which day
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
        </label>
        {chosen.counts ? (
          <label className="text-[12px] font-medium text-muted-foreground">
            How many extra
            <Input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
              className="mt-1"
            />
          </label>
        ) : (
          <label className="text-[12px] font-medium text-muted-foreground">
            A short note
            <Input
              value={note}
              placeholder="Dinner at my parents'"
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
            />
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={slot === "all"} onClick={() => setSlot("all")}>
          Whole day
        </Chip>
        {SLOTS.map((s) => (
          <Chip key={s} active={slot === s} onClick={() => setSlot(s)}>
            {SLOT_LABELS[s]}
          </Chip>
        ))}
      </div>

      <Button className="rounded-full" onClick={save} disabled={add.isPending}>
        <CalendarPlus className="size-4" /> Tell Lily
      </Button>

      {upcoming.length ? (
        <ul className="grid gap-2 border-t border-border/60 pt-3">
          {upcoming.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-2xl bg-secondary/50 px-3 py-2">
              <span className="text-base">{EVENT_KINDS.find((k) => k.value === e.kind)?.emoji ?? "📅"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{eventLabel(e)}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">
                  {e.event_date} · {e.slot ? SLOT_LABELS[e.slot] ?? e.slot : "whole day"}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
              </span>
              <button onClick={() => remove.mutate(e.id)} aria-label="Remove this plan">
                <X className="size-4 text-muted-foreground hover:text-terracotta" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">Nothing coming up — all meals at home 🌼</p>
      )}
    </Card>
  );
}

/* ---------------- everyone who eats here ---------------- */

function People() {
  const { people, householdId, me } = useApp();
  const addPerson = useAddPartner();
  const removePerson = useRemovePartner();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    age: "",
    sex: "female",
    height: "",
    weight: "",
    goal: "maintain",
    activity: "moderate",
  });

  const save = () => {
    if (!householdId) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("What shall I call them?");
      return;
    }
    const num = (v: string) => (v === "" ? null : Number(v));
    const targets = computeTargets({
      sex: form.sex,
      age: num(form.age),
      height_cm: num(form.height),
      weight_kg: num(form.weight),
      activity_level: form.activity,
      goal: form.goal,
    });
    addPerson.mutate(
      {
        household_id: householdId,
        display_name: name,
        sex: form.sex,
        age: num(form.age),
        height_cm: num(form.height),
        weight_kg: num(form.weight),
        goal: form.goal,
        activity_level: form.activity,
        accent: ["caramel", "olive", "terracotta", "butter"][people.length % 4]!,
        ...targets,
      },
      {
        onSuccess: () => {
          toast.success(`${name} is part of the household now 🌼`);
          setOpen(false);
          setForm({ ...form, name: "", age: "", height: "", weight: "" });
        },
      },
    );
  };

  return (
    <div className="grid gap-3">
      {people.map((p) => (
        <Card key={p.id} className="flex items-center gap-3">
          <span className={cn("size-2.5 shrink-0 rounded-full", accentOf(p).dot)} />
          <Link to="/settings" className="min-w-0 flex-1">
            <p className="truncate font-display text-[16px] font-semibold">{p.display_name}</p>
            <p className="truncate text-[12px] text-muted-foreground">
              {GOAL_LABELS[p.goal as Goal] ?? p.goal} · {p.calorie_target} kcal · {p.protein_target} g protein
            </p>
          </Link>
          {p.id !== me?.id && people.length > 1 ? (
            <button
              onClick={() =>
                removePerson.mutate(p.id, {
                  onSuccess: () => toast.success(`${p.display_name} removed from the household`),
                })
              }
              aria-label={`Remove ${p.display_name}`}
              className="shrink-0 text-muted-foreground hover:text-terracotta"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </Card>
      ))}

      {open ? (
        <Card className="grid gap-2">
          <Input
            value={form.name}
            placeholder="Their name"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              placeholder="Age"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Height cm"
              value={form.height}
              onChange={(e) => setForm({ ...form, height: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Weight kg"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["female", "male"].map((s) => (
              <Chip key={s} active={form.sex === s} onClick={() => setForm({ ...form, sex: s })}>
                {s === "female" ? "Female" : "Male"}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
              <Chip key={g} active={form.goal === g} onClick={() => setForm({ ...form, goal: g })}>
                {GOAL_LABELS[g]}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
              <Chip key={key} active={form.activity === key} onClick={() => setForm({ ...form, activity: key })}>
                {label}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 rounded-full" onClick={save} disabled={addPerson.isPending}>
              Add them
            </Button>
            <Button variant="secondary" className="rounded-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          <p className="text-[12px] text-muted-foreground">
            I'll work out their calories, then you can fine-tune everything in My details.
          </p>
        </Card>
      ) : (
        <Button variant="secondary" className="rounded-full" onClick={() => setOpen(true)}>
          <Users className="size-4" /> Add someone to the household
        </Button>
      )}
    </div>
  );
}

/* ---------------- messages from the house ---------------- */

function SharedNotes() {
  const { householdId, me, people } = useApp();
  const notes = useHouseholdNotes(householdId);
  const { add, setHandled, remove } = useNoteMutations(householdId);
  const [from, setFrom] = useState(me?.display_name ?? "");
  const [message, setMessage] = useState("");

  const save = () => {
    const text = message.trim();
    if (!text) return;
    add.mutate(
      { from_name: from.trim() || "Someone at home", message: text },
      {
        onSuccess: () => {
          setMessage("");
          toast.success("Lily has it — she'll plan around it.");
        },
      },
    );
  };

  return (
    <Card className="grid gap-3">
      <p className="text-[12.5px] text-muted-foreground">
        Anyone in the house can leave Lily a message — "{people[1]?.display_name ?? "Nabil"} doesn't want
        fish tonight", "the kids loved the burgers".
      </p>
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <Input value={from} placeholder="From" onChange={(e) => setFrom(e.target.value)} />
        <Input
          value={message}
          placeholder="Tell Lily…"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </div>
      <Button variant="secondary" className="rounded-full" onClick={save} disabled={add.isPending}>
        <MessageSquarePlus className="size-4" /> Leave it for Lily
      </Button>

      {(notes.data ?? []).length ? (
        <ul className="grid gap-2 border-t border-border/60 pt-3">
          {(notes.data ?? []).map((n) => (
            <li
              key={n.id}
              className={cn(
                "flex items-start gap-2 rounded-2xl px-3 py-2",
                n.handled ? "bg-secondary/40 opacity-60" : "bg-butter/45",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px]">{n.message}</span>
                <span className="block text-[11.5px] text-muted-foreground">
                  {n.from_name || "Someone at home"}
                </span>
              </span>
              <button
                onClick={() => setHandled.mutate({ id: n.id, handled: !n.handled })}
                className="shrink-0 text-[11px] font-semibold text-caramel"
              >
                {n.handled ? "Undo" : "Done"}
              </button>
              <button onClick={() => remove.mutate(n.id)} aria-label="Delete this message">
                <X className="size-3.5 text-muted-foreground hover:text-terracotta" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

/* ---------------- what Lily has noticed ---------------- */

function Noticed({ today }: { today: string }) {
  const { householdId } = useApp();
  const range = useMemo(() => ({ from: addDays(today, -21), to: addDays(today, 7) }), [today]);
  const plan = usePlan(householdId, range.from, range.to);
  const events = useEvents(householdId, addDays(today, -28), addDays(today, 27));
  const feedback = useFeedback(householdId);
  const { data: recipes = [] } = useRecipes();

  const insights = useMemo(
    () =>
      noticePatterns({
        entries: plan.data ?? [],
        recipes,
        feedback: feedback.data ?? [],
        events: events.data ?? [],
        today,
      }),
    [plan.data, recipes, feedback.data, events.data, today],
  );

  if (!insights.length)
    return (
      <Card>
        <p className="text-[12.5px] text-muted-foreground">
          Nothing to report yet — cook a few meals and tell me how they went, and I'll start spotting what
          works for you.
        </p>
      </Card>
    );

  return (
    <Card className="grid gap-2">
      {insights.map((i) => (
        <p key={i.text} className="flex items-start gap-2 text-[13px] leading-relaxed">
          <span aria-hidden>{i.emoji}</span>
          <span>{i.text}</span>
        </p>
      ))}
    </Card>
  );
}

function HouseholdPage() {
  const today = useMemo(() => isoDate(new Date()), []);

  return (
    <AppShell title="My household" subtitle="Everyone who eats here 🌼" mood="welcome">
      <LilySays mood="welcome">
        One kitchen, as many people as you like — each with their own goals. Tell me who's eating, who's
        visiting and when you're out, and I'll only change the meals it touches.
      </LilySays>

      <SectionTitle>Guests tonight</SectionTitle>
      <GuestMode today={today} />

      <SectionTitle>Real life</SectionTitle>
      <RealLife today={today} />

      <SectionTitle>Everyone at home</SectionTitle>
      <People />

      <SectionTitle>Messages for Lily</SectionTitle>
      <SharedNotes />

      <SectionTitle>What Lily has noticed</SectionTitle>
      <Noticed today={today} />
    </AppShell>
  );
}
