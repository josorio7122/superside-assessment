import { describe, expect, it } from "vitest";
import { emptyBrandProfile, type BrandProfile } from "@studio/schemas";
import { buildGroundedPrompt } from "./build-grounded-prompt.js";

const baseProfile: BrandProfile = {
  ...emptyBrandProfile("Slack"),
  visual: {
    palette: [
      { name: "Aubergine", hex: "#4A154B", role: "primary" },
      { name: "Sunny Yellow", hex: "#ECB22E", role: "accent" },
    ],
    typography: { display: null, body: null, mono: null },
    logo_usage: ["Always 16px clear space around logo."],
  },
};

describe("buildGroundedPrompt", () => {
  it("includes user prompt verbatim at the top", () => {
    const out = buildGroundedPrompt("modern team office", baseProfile);
    expect(out.startsWith("modern team office\n")).toBe(true);
  });

  it("appends brand name", () => {
    const out = buildGroundedPrompt("x", baseProfile);
    expect(out).toContain("Brand: Slack.");
  });

  it("appends palette colors when present", () => {
    const out = buildGroundedPrompt("x", baseProfile);
    expect(out).toContain("Aubergine (#4A154B)");
    expect(out).toContain("Sunny Yellow (#ECB22E)");
  });

  it("appends logo guideline when present", () => {
    const out = buildGroundedPrompt("x", baseProfile);
    expect(out).toContain("Always 16px clear space around logo.");
  });

  it("omits palette line when palette empty", () => {
    const profile = emptyBrandProfile("Empty");
    const out = buildGroundedPrompt("x", profile);
    expect(out).not.toContain("Visual must align");
  });

  it("omits logo line when logo_usage empty", () => {
    const profile = emptyBrandProfile("NoLogo");
    const out = buildGroundedPrompt("x", profile);
    expect(out).not.toContain("Logo guideline");
  });

  it("includes style suffix", () => {
    const out = buildGroundedPrompt("x", baseProfile);
    expect(out).toContain("Style: photographic, marketing-grade, no on-image text.");
  });
});
