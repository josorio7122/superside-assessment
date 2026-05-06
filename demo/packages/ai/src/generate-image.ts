import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { experimental_generateImage as generateImage } from "ai";
import { priceImageUsage } from "./pricing.js";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required for image generation");
}

export type ImageVariantUsage = {
  model: "openai/gpt-image-2";
  provider: "openai";
  inputTokens: 0;
  outputTokens: 1;
  costUsd: number;
  latencyMs: number;
};

export async function generateImageVariant(
  prompt: string,
  opts: { seed: number },
): Promise<{ image: Uint8Array; usage: ImageVariantUsage }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 180_000);
  try {
    const { image } = await generateImage({
      model: openai.image("gpt-image-2"),
      prompt,
      size: "1024x1024",
      seed: opts.seed,
      n: 1,
      abortSignal: ctrl.signal,
    });
    return {
      image: image.uint8Array,
      usage: {
        model: "openai/gpt-image-2",
        provider: "openai",
        inputTokens: 0,
        outputTokens: 1,
        costUsd: priceImageUsage({ model: "openai/gpt-image-2", imageCount: 1 }),
        latencyMs: Date.now() - t0,
      },
    };
  } finally {
    clearTimeout(to);
  }
}
