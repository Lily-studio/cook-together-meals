import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LilySays } from "@/components/lily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/today" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/today` },
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

  const google = async () => {
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    }
  };

  return (
    <main className="paper flex min-h-screen items-center bg-background">
      <div className="mx-auto w-full max-w-md px-6 py-12">
        <LilySays size={56}>
          {mode === "signup"
            ? "Hello! I'm Lily. Make an account and I'll plan your week."
            : "Welcome back — your plan is right where you left it."}
        </LilySays>

        <form onSubmit={submit} className="mt-7 grid gap-3.5 rounded-3xl bg-card p-5 shadow-soft">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-xl"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="rounded-xl"
            />
          </div>
          <Button type="submit" disabled={busy} className="mt-1 h-11 rounded-full text-[15px]">
            {busy ? "One moment…" : mode === "signup" ? "Create my kitchen" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={google}
            className="h-11 rounded-full text-[15px]"
          >
            Continue with Google
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
