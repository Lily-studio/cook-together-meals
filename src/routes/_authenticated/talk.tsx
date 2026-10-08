import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/talk")({
  head: () => ({
    meta: [
      { title: "Talk to Lily · Cook with Lily" },
      {
        name: "description",
        content:
          "Tell Lily what you want and she does it: swap a meal, remember a preference, add to your kitchen or your list, or take you straight to any page.",
      },
      { property: "og:title", content: "Talk to Lily · Cook with Lily" },
      {
        property: "og:description",
        content: "Your kitchen companion who actually changes things for you — not just chats.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});

