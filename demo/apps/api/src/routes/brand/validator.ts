import { z } from "zod";

export const CreateBrandSchema = z.object({ name: z.string().min(1).max(80) });
export const UpdateBrandSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  archived: z.boolean().optional(),
});
