import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  context: z.string().max(6000),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(30),
});

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Ask Lily anything — she gets a summary of the kitchen with every question. */
export const askLily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ reply: string } | { error: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "Lily's kitchen radio isn't connected yet." };

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.7-flash",
          messages: [
            {
              role: "system",
              content: [
                "You are Lily: a warm, cosy Moroccan-Mediterranean home-cooking companion inside the Cook with Lily app.",
                "You plan meals for a couple with different goals: one kitchen, one meal, two goals.",
                "Be brief and practical (max 120 words), kind, never clinical, never preachy about weight.",
                "Prefer affordable ingredients easily found in Morocco. Give exact quantities in g/ml/pieces when useful.",
                "Use the kitchen summary below as the truth about this household. If something isn't in it, say you don't know rather than inventing it.",
                "KITCHEN SUMMARY:",
                data.context,
              ].join("\n"),
            },
            ...data.messages,
          ],
        }),
      });

      if (response.status === 429) return { error: "So many questions at once! Give me a minute." };
      if (response.status === 402 || response.status === 403)
        return { error: "Lily's AI credits have run out — top them up to keep chatting." };
      if (!response.ok) return { error: "I couldn't think straight just now — try again?" };

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = payload.choices?.[0]?.message?.content?.trim();
      if (!reply) return { error: "I couldn't think straight just now — try again?" };
      return { reply: reply.slice(0, 1500) };
    } catch {
      return { error: "Something went wrong in the kitchen — try again?" };
    }
  });
