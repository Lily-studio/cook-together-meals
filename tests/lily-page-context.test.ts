import { expect, test } from "bun:test";
import { lilyPageContext, showFloatingLily } from "../src/lib/lily-page-context";

test("floating Lily is absent only on the dedicated Talk page", () => {
  expect(showFloatingLily("/talk")).toBe(false);
  for (const path of ["/", "/auth", "/today", "/grocery", "/discover", "/household", "/recipes/chicken-tagine"]) {
    expect(showFloatingLily(path)).toBe(true);
  }
});

test("recipe context identifies the actual recipe being viewed", () => {
  expect(lilyPageContext("/recipes/chicken-tagine").context).toContain("recipe slug chicken-tagine");
});

test("meal context protects unrelated meals and resolves unclear slots", () => {
  for (const path of ["/today", "/week", "/month"]) {
    expect(lilyPageContext(path).context).toContain("keep unrelated meals unchanged");
    expect(lilyPageContext(path).context).toContain("Ask which date and meal");
  }
});