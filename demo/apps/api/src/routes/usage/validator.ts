import { z } from "zod";

export const UsageGroupBySchema = z.enum(["user", "brand", "day", "feature"]);
export const UsageQuerySchema = z.object({
  groupBy: UsageGroupBySchema.default("day"),
  days: z.coerce.number().int().min(1).max(90).default(30),
});
