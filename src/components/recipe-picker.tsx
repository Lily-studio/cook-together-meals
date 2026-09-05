import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useApp } from "@/components/app-context";
import { useRecipes, type Recipe } from "@/lib/db";
import { candidatesFor, restrictionsFor } from "@/lib/planner";
import { SLOT_LABELS } from "@/lib/nutrition";

export function RecipePicker({
  open,
  onOpenChange,
  slot,
  onPick,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slot?: string;
  onPick: (recipe: Recipe) => void;
  title?: string;
}) {
  const { people } = useApp();
  const { data: recipes = [] } = useRecipes();
  const [q, setQ] = useState("");
  const [onlySlot, setOnlySlot] = useState(true);

  const list = useMemo(() => {
    const r = restrictionsFor(people);
    const base = slot && onlySlot ? candidatesFor(recipes, slot, r) : recipes;
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter((rec) =>
      `${rec.title} ${rec.tagline} ${rec.tags.join(" ")}`.toLowerCase().includes(needle),
    );
  }, [recipes, people, slot, onlySlot, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-3xl p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="font-display text-lg">
            {title ?? (slot ? `Choose a new ${SLOT_LABELS[slot]?.toLowerCase()}` : "Choose a recipe")}
          </DialogTitle>
        </DialogHeader>
        <div className="px-5 pt-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tagine, lentils, quick…"
              className="rounded-full pl-9"
            />
          </div>
          {slot ? (
            <button
              onClick={() => setOnlySlot((v) => !v)}
              className="mt-2 text-[11px] font-medium text-caramel underline-offset-2 hover:underline"
            >
              {onlySlot ? "Show all recipes instead" : `Only show ${SLOT_LABELS[slot]?.toLowerCase()} ideas`}
            </button>
          ) : null}
        </div>
        <div className="mt-3 max-h-[58vh] overflow-y-auto px-5 pb-5">
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing matches that — try another word.
            </p>
          ) : (
            <ul className="grid gap-2">
              {list.map((rec) => (
                <li key={rec.id}>
                  <button
                    onClick={() => {
                      onPick(rec);
                      onOpenChange(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-secondary/60 p-3 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="text-2xl" aria-hidden>
                      {rec.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{rec.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {rec.calories} kcal · {rec.protein}g protein · {rec.prep_minutes + rec.cook_minutes} min
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
