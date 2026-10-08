import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { lilyPageContext, showFloatingLily } from "@/lib/lily-page-context";
import lily from "@/assets/lily-3d-home-refined.jpg";

const LilyConversation = lazy(() => import("@/components/lily-conversation"));

export function FloatingLily() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pageTitle, setPageTitle] = useState("");
  const [lift, setLift] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const dedicated = !showFloatingLily(path);
  const suggestion = lilyPageContext(path).suggestions[0];

  useEffect(() => {
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.innerWidth >= 1024) { setLift(0); return; }
        const obstacles = Array.from(document.querySelectorAll<HTMLElement>("button, a, input, textarea, select, .meal-card"))
          .filter((el) => !el.closest(".lily-floating-dock, .lily-panel, .lily-dedicated-host, nav"))
          .map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height);
        const right = window.innerWidth - 12;
        const bottom = window.innerHeight - (session ? 82 : 12);
        for (let offset = 0; offset < Math.min(400, window.innerHeight - 180); offset += 8) {
          const top = bottom - offset - 78;
          if (!obstacles.some((r) => r.left < right + 4 && r.right > right - 60 && r.top < top + 82 && r.bottom > top - 4)) {
            setLift(offset); return;
          }
        }
        setLift(0);
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    const observer = new MutationObserver(place);
    observer.observe(document.querySelector("#root") ?? document.body, { childList: true, subtree: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [path, session, open]);

  useEffect(() => {
    setPageTitle(document.querySelector("main h1, h1")?.textContent ?? "");
    setOpen(false);
    if (dedicated) setStarted(true);
  }, [path, dedicated]);

  useEffect(() => {
    const focus = () => {
      const active = document.activeElement;
      setEditing(active instanceof HTMLElement && active.matches("input, textarea, select, [contenteditable=true]"));
    };
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", focus);
    return () => { document.removeEventListener("focusin", focus); document.removeEventListener("focusout", focus); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("button, a, input")?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      if (event.key === "Tab") {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not([type="file"]), textarea, summary, [tabindex="0"]') ?? []).filter((el) => el.getClientRects().length);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); };
  }, [open]);

  const dismiss = () => { setOpen(false); trigger.current?.focus(); };
  return (
    <>
      {!dedicated && !open ? (
        <div style={{ marginBottom: lift }} className={`lily-floating-dock ${session ? "lily-floating-dock-app" : ""} ${editing ? "lily-floating-dock-editing" : ""}`}>
          <Button ref={trigger} variant="ghost" className="lily-floating-trigger" aria-label="Talk to Lily" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setStarted(true); setOpen(true); }}>
            <img src={lily} alt="" className="lily-floating-character" />
            {suggestion ? <span className="lily-suggestion-dot" aria-hidden="true" /> : null}
          </Button>
          <span className="lily-floating-caption">Lily</span>
          <span className="lily-floating-hint" role="tooltip">{suggestion ?? "Talk to Lily"}</span>
        </div>
      ) : null}
      {open ? <div className="lily-panel-backdrop" onClick={dismiss} aria-hidden="true" /> : null}
      <div ref={panel} className={dedicated ? "lily-dedicated-host" : "lily-panel"} hidden={!dedicated && !open} role={open ? "dialog" : undefined} aria-modal={open ? true : undefined} aria-labelledby={open ? "floating-lily-title" : undefined}>
        {!dedicated ? <header className="lily-panel-header">
          <div><h2 id="floating-lily-title" className="font-display text-xl font-semibold">Talk to Lily</h2><p className="text-xs text-muted-foreground">{suggestion ?? "Your kitchen companion"}</p></div>
          <Button variant="ghost" size="icon" aria-label="Hide Lily chat" className="size-11 shrink-0 rounded-full" onClick={dismiss}><X className="size-5" /></Button>
        </header> : null}
        {session && (started || dedicated) ? (
          <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Getting your conversation…</p>}>
            <LilyConversation key={session.user.id} embedded={!dedicated} pagePath={path} pageTitle={pageTitle} onNavigate={() => setOpen(false)} />
          </Suspense>
        ) : open ? <div className="p-6"><p className="mb-5 text-sm text-muted-foreground">Log in to continue your conversation with Lily.</p><Button asChild><Link to="/auth" onClick={dismiss}>Log in</Link></Button></div> : null}
      </div>
    </>
  );
}