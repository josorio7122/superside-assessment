import { z } from "zod";
import { BrandProfileSchema } from "./brand-profile.js";

export const CreateBrandSchema = z.object({ name: z.string().min(1).max(80) });
export const UpdateBrandSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  archived: z.boolean().optional(),
});
export const UpdateProfileSchema = z.object({ profile: BrandProfileSchema });

export const UsageGroupBySchema = z.enum(["user", "brand", "day", "feature"]);
export const UsageQuerySchema = z.object({
  groupBy: UsageGroupBySchema.default("day"),
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export const GenerationsQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  type: z.enum(["copy_variant", "translate", "image"]).optional(),
  status: z.enum(["pending", "running", "done", "failed"]).optional(),
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
