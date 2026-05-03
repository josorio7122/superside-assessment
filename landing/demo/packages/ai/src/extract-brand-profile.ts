import { generateObject } from "ai";
import { BrandProfileSchema, type BrandProfile } from "@studio/schemas";
import { extractionModel } from "./client.js";
import { EXTRACT_BRAND_PROFILE_PROMPT } from "./prompts/extract-brand-profile.js";
import { priceUsage } from "./pricing.js";

export type ExtractionResult = {
  profile: BrandProfile;
  usage: {
    model: string;
    provider: "openrouter";
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
  };
};

export async function extractBrandProfile(pdf: Buffer): Promise<ExtractionResult> {
  const start = Date.now();
  const result = await generateObject({
    model: extractionModel,
    schema: BrandProfileSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACT_BRAND_PROFILE_PROMPT },
          { type: "file", data: pdf, mediaType: "application/pdf" },
        ],
      },
    ],
  });
  const latencyMs = Date.now() - start;
  const usage = result.usage as
    | { promptTokens?: number; completionTokens?: number; inputTokens?: number; outputTokens?: number }
    | undefined;
  const inputTokens = usage?.promptTokens ?? usage?.inputTokens ?? 0;
  const outputTokens = usage?.completionTokens ?? usage?.outputTokens ?? 0;
  return {
    profile: result.object,
    usage: {
      model: "openai/gpt-5.5",
      provider: "openrouter",
      inputTokens,
      outputTokens,
      costUsd: priceUsage("openai/gpt-5.5", inputTokens, outputTokens),
      latencyMs,
    },
  };
}
