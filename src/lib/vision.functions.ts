import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  /** A data URL: data:image/jpeg;base64,… — resized on the client before sending. */
  image: z
    .string()
    .startsWith("data:image/")
    .max(6_000_000),
  question: z.string().max(400).default(""),
  context: z.string().max(3000).default(""),
});

export type ShowLilyResult = { reply: string } | { error: string };

/**
 * "Show Lily" — send her a photo of the dish, the fridge or an ingredient and
 * get real advice back. The same endpoint will happily take any future
 * image-recognition prompt without the rest of the app changing.
 */
export const showLily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<ShowLilyResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "Lily can't look at photos just yet — her kitchen camera isn't connected." };

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
                "You are Lily, a warm Moroccan-Mediterranean home-cooking companion looking at a photo the cook just took.",
                "Say what you see, then give practical help in under 120 words.",
                "If it's a finished dish: judge it kindly and suggest one improvement.",
                "If it's raw ingredients or a fridge: suggest one or two realistic meals from what's visible.",
                "If it's mid-cooking: say whether it looks ready and what to do next.",
                "If you truly can't tell what it is, say so plainly and ask one short question.",
                "Never mention calories unless asked. Never scold.",
                data.context ? `KITCHEN SUMMARY:\n${data.context}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
            {
              role: "user",
              content: [
                { type: "text", text: data.question || "What do you think, Lily?" },
                { type: "image_url", image_url: { url: data.image } },
              ],
            },
          ],
        }),
      });

      if (response.status === 429) return { error: "One photo at a time! Try again in a moment." };
      if (response.status === 402 || response.status === 403)
        return { error: "Lily's AI credits have run out — top them up and she'll look again." };
      if (!response.ok) return { error: "I couldn't see that clearly — try another photo?" };

      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = payload.choices?.[0]?.message?.content?.trim();
      if (!reply) return { error: "I couldn't see that clearly — try another photo?" };
      return { reply: reply.slice(0, 1500) };
    } catch {
      return { error: "Something went wrong while I was looking — try again?" };
    }
  });
