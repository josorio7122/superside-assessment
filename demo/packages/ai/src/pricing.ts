type Pricing =
  | { kind: "tokens"; inputPer1k: number; outputPer1k: number }
  | { kind: "image"; perImage: number };

const PRICES: Record<string, Pricing> = {
  "openai/gpt-5.5": { kind: "tokens", inputPer1k: 0.00125, outputPer1k: 0.01 },
  "openai/gpt-image-2": { kind: "image", perImage: 0.04 },
};

export function priceUsage(input: { model: string; inputTokens: number; outputTokens: number }): number {
  const p = PRICES[input.model];
  if (!p || p.kind !== "tokens") return 0;
  return (input.inputTokens / 1000) * p.inputPer1k + (input.outputTokens / 1000) * p.outputPer1k;
}

export function priceImageUsage(input: { model: string; imageCount: number }): number {
  const p = PRICES[input.model];
  if (!p || p.kind !== "image") return 0;
  return p.perImage * input.imageCount;
}
