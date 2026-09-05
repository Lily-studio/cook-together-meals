import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Estimate = {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  note: string;
};

const inputSchema = z.object({ text: z.string().min(2).max(400) });

export const estimateMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<Estimate | null> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return null;

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.7-flash",
          messages: [
            {
              role: "system",
              content:
                "You are Lily, a warm Moroccan home-cooking companion who estimates nutrition from short meal descriptions. Assume typical Moroccan home portions when unspecified. Reply ONLY with JSON: {\"description\":string,\"calories\":number,\"protein\":number,\"carbs\":number,\"fat\":number,\"note\":string}. description is a tidy 2-6 word summary. note is one short friendly sentence, max 90 characters.",
            },
            { role: "user", content: data.text },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) return null;
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return null;
      const parsed = JSON.parse(content) as Partial<Estimate>;
      const round = (n: unknown, fallback = 0) =>
        typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
      return {
        description: (parsed.description ?? data.text).slice(0, 80),
        calories: round(parsed.calories),
        protein: round(parsed.protein),
        carbs: round(parsed.carbs),
        fat: round(parsed.fat),
        note: (parsed.note ?? "").slice(0, 120),
      };
    } catch {
      return null;
    }
  });
