import "dotenv/config";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required");
}

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    "HTTP-Referer": "http://localhost:5173",
    "X-OpenRouter-Title": "Studio Demo",
  },
});

export const extractionModel = openrouter("openai/gpt-5.5", {
  plugins: [{ id: "response-healing" }],
} as Parameters<typeof openrouter>[1]);
