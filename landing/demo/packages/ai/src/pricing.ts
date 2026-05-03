// Per-1k token prices in USD. Source: openrouter.ai pricing page (verify periodically).
const PRICES: Record<string, { input: number; output: number }> = {
  "openai/gpt-5.5": { input: 0.00125, output: 0.01 },
  "openai/gpt-image-2": { input: 0, output: 0.04 },
};

export function priceUsage(input: { model: string; inputTokens: number; outputTokens: number }): number {
  const p = PRICES[input.model] ?? { input: 0, output: 0 };
  return (input.inputTokens / 1000) * p.input + (input.outputTokens / 1000) * p.output;
}
