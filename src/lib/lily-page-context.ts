export function lilyPageContext(path: string) {
  if (path.startsWith("/recipes/")) return {
    context: `The cook is viewing recipe slug ${decodeURIComponent(path.slice(9))}. Resolve this recipe from the existing catalog before proposing changes.`,
    suggestions: ["Want me to adjust this recipe?".replace("Want me to", "Can you"), "Add this recipe to dinner tomorrow"],
  };
  if (["/today", "/week", "/month"].includes(path)) return {
    context: "The cook is viewing their meal plan. Ask which date and meal if the intended slot is unclear; keep unrelated meals unchanged.",
    suggestions: ["Help me change a meal", "Make dinner quicker today"],
  };
  if (path === "/grocery") return {
    context: "The cook is viewing their grocery list. Use the existing list and stock for shopping adjustments.",
    suggestions: ["Can you make my grocery list cheaper?", "Help me remove something from my list"],
  };
  if (["/discover", "/favorites"].includes(path)) return {
    context: "The cook is browsing Discover and their Meal Book. Resolve the selected recipe before adding it to a meal.",
    suggestions: ["Add a Discover recipe to my meal plan", "Find a meal that suits everyone"],
  };
  if (["/pantry", "/kitchen", "/prep"].includes(path)) return {
    context: "The cook is checking kitchen inventory or meal preparation. Prioritize stock and ingredients that need using soon.",
    suggestions: ["What should I use up first?", "What can I prep ahead?"],
  };
  if (["/household", "/settings", "/onboarding"].includes(path)) return {
    context: "The cook is viewing household information or preferences. Clarify which person before changing their preferences.",
    suggestions: ["Help me update a preference", "We have guests coming"],
  };
  return { context: "Offer contextual kitchen help without assuming the cook wants to change anything.", suggestions: [] as string[] };
}

export function showFloatingLily(path: string) {
  return path !== "/talk";
}