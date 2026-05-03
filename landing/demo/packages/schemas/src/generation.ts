import { z } from "zod";

export const GenerationTypeSchema = z.enum(["copy_variant", "translate", "image"]);
export const GenerationStatusSchema = z.enum(["pending", "running", "done", "failed"]);

export const CopyInputSchema = z.object({
  prompt: z.string(),
  source_text: z.string().optional(),
  count: z.number().int().min(1).max(5).default(3),
});
export const TranslateInputSchema = z.object({
  source_text: z.string(),
  source_locale: z.string(),
  target_locales: z.array(z.string()),
});
export const ImageInputSchema = z.object({
  prompt: z.string(),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024", "2048x2048"]).default("1024x1024"),
  count: z.number().int().min(1).max(4).default(3),
});

export const GenerationInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("copy_variant"), payload: CopyInputSchema }),
  z.object({ type: z.literal("translate"), payload: TranslateInputSchema }),
  z.object({ type: z.literal("image"), payload: ImageInputSchema }),
]);
export type GenerationInput = z.infer<typeof GenerationInputSchema>;
