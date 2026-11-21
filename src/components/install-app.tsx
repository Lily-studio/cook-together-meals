import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallationState {
  prompt: InstallPrompt | null;
  installed: boolean;
  availableHere: boolean;
  isIPhone: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const InstallationContext = createContext<InstallationState | null>(null);

// Capture the browser's optional install event once, across route changes.
// Home-screen support deliberately has no service worker or offline caches.
export function InstallationProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [availableHere, setAvailableHere] = useState(false);
  const [isIPhone, setIsIPhone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const iosNavigator = navigator as Navigator & { standalone?: boolean };
    const updateDisplay = () => setInstalled(standalone.matches || iosNavigator.standalone === true);
    updateDisplay();
    setIsIPhone(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setAvailableHere(window.isSecureContext && window.self === window.top);

    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", onInstalled);
    standalone.addEventListener("change", updateDisplay);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", onInstalled);
      standalone.removeEventListener("change", updateDisplay);
    };
  }, []);

  const install = async () => {
    if (!prompt || !availableHere) return "unavailable" as const;
    setPrompt(null);
    try {
      await prompt.prompt();
      return (await prompt.userChoice).outcome;
    } catch {
      return "unavailable" as const;
    }
  };

  return <InstallationContext.Provider value={{ prompt, installed, availableHere, isIPhone, install }}>{children}</InstallationContext.Provider>;
}

export function InstallAppButton() {
  const installation = useContext(InstallationContext);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  if (!installation || installation.installed) return null;

  const requestInstall = async () => {
    setBusy(true);
    const outcome = await installation.install();
    setBusy(false);
    if (outcome === "accepted") setOpen(false);
    else setNotice(outcome === "dismissed" ? "Installation cancelled. You can try again from your browser menu." : "Use your browser menu to add Lily to your home screen.");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
        <Smartphone className="size-4" /> Add Lily to home screen
      </Button>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
        <DialogHeader>
          <img src="/icons/apple-touch-icon.png" width={72} height={72} alt="Lily app icon" className="mb-2 rounded-2xl shadow-soft" />
          <DialogTitle>Cook with Lily, on your home screen</DialogTitle>
          <DialogDescription>Open Lily from her own icon, in an app-like window. An internet connection is still required.</DialogDescription>
        </DialogHeader>
        {!installation.availableHere && <p className="text-sm text-muted-foreground">Open the published app in your phone’s browser first — installation is not available inside the editor preview.</p>}
        {installation.prompt && installation.availableHere && (
          <Button onClick={requestInstall} disabled={busy} className="min-h-11"><Download className="size-4" /> {busy ? "Opening installation…" : "Install Cook with Lily"}</Button>
        )}
        <div className="space-y-4 text-sm leading-6">
          <section>
            <h3 className="font-semibold">{installation.isIPhone ? "On this iPhone or iPad" : "iPhone / iPad"}</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Open <a className="text-primary underline" href="https://cook-together-meals.lovable.app" target="_blank" rel="noreferrer">cook-together-meals.lovable.app</a> in Safari.</li>
              <li>Tap <Share className="inline size-4" aria-hidden /> Share, then <strong>Add to Home Screen</strong> (scroll down if needed).</li>
              <li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li>
            </ol>
          </section>
          <section>
            <h3 className="font-semibold">Android</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Open the published app in Chrome.</li>
              <li>Tap the three-dot menu, then <strong>Add to home screen</strong> or <strong>Install app</strong>.</li>
              <li>Confirm, then open Lily from your home screen.</li>
            </ol>
          </section>
          <p className="text-muted-foreground">On a computer, use Chrome or Edge’s install option in the address bar or browser menu. Menu labels vary by browser.</p>
          <p className="text-muted-foreground">Your existing account and 4-digit PIN still work. Your phone may ask you to log in the first time.</p>
        </div>
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      </DialogContent>
    </Dialog>
  );
}