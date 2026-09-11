import { useEffect, useMemo, useState } from "react";
import { ChefHat, LifeBuoy, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/macro";
import { useUpdatePlanEntry, type Recipe } from "@/lib/db";
import { formatGrams, splitDish } from "@/lib/dish";
import { minutesInStep, rescueChips, rescueFor, type Rescue } from "@/lib/rescue";
import { cn } from "@/lib/utils";

/**
 * One step at a time, a timer when the step mentions one, and Lily on hand the
 * moment something goes wrong.
 */
export function CookingMode({
  open,
  onOpenChange,
  recipe,
  entryId,
  people = [],
  portions = {},
  swaps = {},
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipe: Recipe;
  entryId?: string | undefined;
  people?: { id: string; display_name: string }[];
  portions?: Record<string, number>;
  swaps?: Record<string, { name: string; amount: string }>;
}) {
  const [index, setIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [problem, setProblem] = useState("");
  const [rescue, setRescue] = useState<Rescue | null>(null);
  const updateEntry = useUpdatePlanEntry();

  const steps = recipe.steps.length ? recipe.steps : ["Cook everything gently until it's done, then serve."];
  const step = steps[Math.min(index, steps.length - 1)]!;
  const last = index >= steps.length - 1;
  const split = useMemo(
    () => (people.length ? splitDish(recipe, people, portions, swaps) : null),
    [recipe, people, portions, swaps],
  );

  const stepMinutes = minutesInStep(step);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setSeconds(stepMinutes ? stepMinutes * 60 : null);
    setRunning(false);
  }, [index, stepMinutes]);

  useEffect(() => {
    if (!running || seconds === null) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s === null) return null;
        if (s <= 1) {
          setRunning(false);
          toast.success("Time's up 🌼");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, seconds]);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setHelpOpen(false);
      setRescue(null);
      setProblem("");
    }
  }, [open]);

  const askRescue = (text: string) => {
    setProblem(text);
    const found = rescueFor(text, recipe);
    setRescue(found);
    if (!found)
      toast.message("Tell me a bit more", {
        description: "Try “too salty”, “sauce is thin”, “chicken is dry”, “I burned the onions”.",
      });
  };

  const finish = () => {
    if (entryId) {
      updateEntry.mutate(
        { id: entryId, values: { cooked: true } },
        { onSuccess: () => toast.success("Cooked and counted 🌼") },
      );
    } else {
      toast.success("Beautifully done 🌼");
    }
    onOpenChange(false);
  };

  const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <ChefHat className="size-5 text-caramel" /> {recipe.title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Step {Math.min(index + 1, steps.length)} of {steps.length}
        </p>
        <p className="font-display text-[20px] leading-snug">{step}</p>

        {seconds !== null ? (
          <div className="mt-1 flex items-center gap-2 rounded-2xl bg-butter/45 px-3 py-2">
            <Timer className="size-4 text-caramel" />
            <span className="font-display text-[20px] font-semibold tabular-nums">{clock(seconds)}</span>
            <button
              onClick={() => setRunning((r) => !r)}
              className="ml-auto flex size-8 items-center justify-center rounded-full bg-card text-caramel shadow-soft"
              aria-label={running ? "Pause the timer" : "Start the timer"}
            >
              {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <button
              onClick={() => {
                setSeconds(stepMinutes ? stepMinutes * 60 : null);
                setRunning(false);
              }}
              className="flex size-8 items-center justify-center rounded-full bg-card text-muted-foreground shadow-soft"
              aria-label="Reset the timer"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
        ) : null}

        <div className="mt-1 flex gap-1">
          {steps.map((s, i) => (
            <span
              key={s}
              className={cn("h-1.5 flex-1 rounded-full", i <= index ? "bg-caramel" : "bg-secondary")}
            />
          ))}
        </div>

        <div className="mt-1 flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-full"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            Back
          </Button>
          {last ? (
            <Button className="h-11 flex-1 rounded-full" onClick={finish}>
              It's ready 🌼
            </Button>
          ) : (
            <Button className="h-11 flex-1 rounded-full" onClick={() => setIndex((i) => i + 1)}>
              Next step
            </Button>
          )}
        </div>

        {last && split ? (
          <p className="rounded-2xl bg-olive/12 px-3 py-2 text-[12px]">
            Weigh the finished dish (≈ {formatGrams(split.total)}) and serve{" "}
            {split.shares
              .filter((s) => s.grams > 0)
              .map((s) => `${s.name} ${formatGrams(s.grams)}`)
              .join(", ")}
            .
          </p>
        ) : null}

        <button
          onClick={() => setHelpOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-caramel"
        >
          <LifeBuoy className="size-4" /> Something's going wrong?
        </button>

        {helpOpen ? (
          <div className="rounded-2xl bg-secondary/50 p-3">
            <div className="flex flex-wrap gap-1.5">
              {rescueChips(recipe).map((c) => (
                <Chip key={c.id} onClick={() => askRescue(c.label)} active={problem === c.label}>
                  {c.label}
                </Chip>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                askRescue(problem);
              }}
            >
              <Input
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="Tell me what happened…"
                className="h-9 rounded-full text-[13px]"
              />
              <Button type="submit" size="sm" className="h-9 rounded-full px-4">
                Help
              </Button>
            </form>
            {rescue ? (
              <div className="mt-2 rounded-2xl bg-card p-3 shadow-soft">
                <p className="font-display text-[15px] font-semibold">👩🏻‍🍳 {rescue.title}</p>
                <ol className="mt-1.5 grid gap-1">
                  {rescue.steps.map((s, i) => (
                    <li key={s} className="flex gap-2 text-[12px]">
                      <span className="font-semibold text-caramel">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
