import { describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  experimental_generateImage: vi.fn(async () => ({
    image: { uint8Array: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
  })),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: { image: (m: string) => ({ provider: "openai", modelId: m }) },
}));

import { experimental_generateImage } from "ai";
import { generateImageVariant } from "./generate-image.js";

describe("generateImageVariant", () => {
  it("returns image bytes + usage with correct cost", async () => {
    const r = await generateImageVariant("a cat", { seed: 42 });
    expect(r.image).toBeInstanceOf(Uint8Array);
    expect(r.image.length).toBeGreaterThan(0);
    expect(r.usage.provider).toBe("openai");
    expect(r.usage.model).toBe("openai/gpt-image-2");
    expect(r.usage.inputTokens).toBe(0);
    expect(r.usage.outputTokens).toBe(1);
    expect(r.usage.costUsd).toBe(0.04);
    expect(r.usage.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("passes seed + size to model call", async () => {
    await generateImageVariant("a dog", { seed: 7 });
    const calls = (experimental_generateImage as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const last = calls[calls.length - 1]![0] as { prompt: string; size: string; seed: number; n: number };
    expect(last.prompt).toBe("a dog");
    expect(last.size).toBe("1024x1024");
    expect(last.seed).toBe(7);
    expect(last.n).toBe(1);
  });
});
