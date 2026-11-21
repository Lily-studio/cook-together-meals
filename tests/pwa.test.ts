import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));

test("Cook with Lily launches from its own home-screen icon in a standalone window", () => {
  expect(manifest.name).toBe("Cook with Lily");
  expect(manifest.short_name).toBe("Lily");
  expect(manifest.display).toBe("standalone");
  expect(manifest.id).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(manifest.start_url).toBe("/home");
});

test("installation includes real 192 and 512 pixel PNG icons plus a maskable icon", () => {
  for (const [size, purpose] of [[192, "any"], [512, "any"], [512, "maskable"]] as const) {
    const icon = manifest.icons.find((entry: { sizes: string; purpose: string }) => entry.sizes === `${size}x${size}` && entry.purpose === purpose);
    expect(icon).toBeDefined();
    const file = readFileSync(new URL(`../public${icon.src}`, import.meta.url));
    expect(file.subarray(1, 4).toString()).toBe("PNG");
    expect(file.readUInt32BE(16)).toBe(size);
    expect(file.readUInt32BE(20)).toBe(size);
  }
});