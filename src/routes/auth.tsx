import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LilySays } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Cook with Lily" },
      { name: "description", content: "Sign in to your shared meal plan and keep cooking together." },
      { property: "og:title", content: "Sign in — Cook with Lily" },
      { property: "og:description", content: "Sign in to your shared meal plan and keep cooking together." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/today" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const handle = username.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (handle.length < 3) {
      toast.error("Pick a name with at least 3 letters or numbers.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Your PIN is exactly 4 digits.");
      return;
    }
    // Username + PIN, mapped to a stable hidden login behind the scenes.
    const email = `${handle}@cookwithlily.app`;
    const password = `lily-${handle}-${pin}`;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/today`,
            data: { display_name: username.trim() },
          },
        });
        if (error) throw error;
        toast.success("Welcome! Let's set up your kitchen.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Good to see you again.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="paper flex min-h-screen items-center bg-background">
      <div className="mx-auto w-full max-w-md px-6 py-12">
        <LilySays size={56}>
          {mode === "signup"
            ? "Hello! I'm Lily. Pick a name and a 4-digit PIN — that's all I need."
            : "Welcome back — your plan is right where you left it."}
        </LilySays>

        <form onSubmit={submit} className="mt-7 grid gap-3.5 rounded-3xl bg-card p-5 shadow-soft">
          <div className="grid gap-1.5">
            <Label htmlFor="username">Your name</Label>
            <Input
              id="username"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="lina"
              className="rounded-xl"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pin">4-digit PIN</Label>
            <Input
              id="pin"
              inputMode="numeric"
              required
              maxLength={4}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="rounded-xl tracking-[0.5em]"
            />
            <p className="text-[11px] text-muted-foreground">
              No email, no password to remember. Keep your PIN somewhere safe.
            </p>
          </div>
          <Button type="submit" disabled={busy} className="mt-1 h-11 rounded-full text-[15px]">
            {busy ? "One moment…" : mode === "signup" ? "Create my kitchen" : "Let me in"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="mt-1 text-center text-[13px] text-muted-foreground hover:text-foreground"
          >
            {mode === "signup" ? "I already have an account" : "I'm new here — create an account"}
          </button>
        </form>
      </div>
    </main>
  );
}
