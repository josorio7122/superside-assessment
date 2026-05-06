import { z } from "zod";

export const GenerationsQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  type: z.enum(["copy_variant", "translate", "image"]).optional(),
  status: z.enum(["pending", "running", "done", "failed"]).optional(),
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
