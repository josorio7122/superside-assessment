import { BrandProfileSchema } from "@studio/schemas";
import { z } from "zod";

export const UpdateProfileSchema = z.object({ profile: BrandProfileSchema });
export const HandAuthorBody = z.object({ profile: BrandProfileSchema.optional() });
