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
  const [method, setMethod] = useState<"name" | "phone">("name");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/today" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let handle: string;
    if (method === "phone") {
      const digits = phone.replace(/\D/g, "").replace(/^00/, "");
      if (digits.length < 8 || digits.length > 15) {
        toast.error("Enter your full phone number, e.g. +212 6 12 34 56 78.");
        return;
      }
      handle = `p${digits}`;
    } else {
      handle = username.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (handle.length < 3) {
        toast.error("Pick a name with at least 3 letters or numbers.");
        return;
      }
    }
    if (mode === "signup" && method === "phone" && username.trim().length < 1) {
      toast.error("Tell me your first name so I know what to call you.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Your PIN is exactly 4 digits.");
      return;
    }
    // Name/phone + PIN, mapped to a stable hidden login. The PIN is never stored as text —
    // the auth service only keeps a salted hash of the derived password.
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
      const msg = error instanceof Error ? error.message : "Something went wrong";
      toast.error(
        /invalid login/i.test(msg)
          ? "That name/phone and PIN don't match. Try again."
          : /already registered/i.test(msg)
            ? "That account already exists — tap “I already have an account”."
            : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="paper flex min-h-screen items-center bg-background">
      <div className="mx-auto w-full max-w-md px-6 py-12">
        <LilySays size={56}>
          {mode === "signup"
            ? "Hello! I'm Lily. Pick a name or phone number and a 4-digit PIN — that's all I need."
            : "Welcome back — your plan is right where you left it."}
        </LilySays>

        <form onSubmit={submit} className="mt-7 grid gap-3.5 rounded-3xl bg-card p-5 shadow-soft">
          <div role="tablist" aria-label="Sign in with" className="grid grid-cols-2 gap-1 rounded-full bg-secondary/70 p-1">
            {(["name", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => setMethod(m)}
                className={`rounded-full py-2 text-[13px] font-semibold transition-colors ${method === m ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground"}`}
              >
                {m === "name" ? "Username" : "Phone number"}
              </button>
            ))}
          </div>
          {method === "phone" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ""))}
                placeholder="+212 6 12 34 56 78"
                className="rounded-xl"
              />
            </div>
          ) : null}
          {method === "name" || mode === "signup" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="username">{method === "phone" ? "Your first name" : "Your name"}</Label>
            <Input
              id="username"
              required
              autoComplete={method === "phone" ? "given-name" : "username"}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="lina"
              className="rounded-xl"
            />
          </div>
          ) : null}
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
