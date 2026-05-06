import { z } from "zod";

export const PaletteEntrySchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  role: z.enum(["primary", "secondary", "accent", "neutral"]).nullable(),
});

export const TypographySchema = z.object({
  display: z.string().nullable(),
  body: z.string().nullable(),
  mono: z.string().nullable(),
});

export const LocalizationSchema = z.object({
  locales: z.array(z.string()),
  notes: z.string().nullable(),
});

export const BrandProfileSchema = z.object({
  brand_name: z.string().min(1),
  voice: z.object({
    tone_descriptors: z.array(z.string()).max(8),
    voice_principles: z.array(z.string()),
    do: z.array(z.string()),
    dont: z.array(z.string()),
  }),
  visual: z.object({
    palette: z.array(PaletteEntrySchema),
    typography: TypographySchema,
    logo_usage: z.array(z.string()),
  }),
  localization: LocalizationSchema,
  banned_terms: z.array(z.string()),
});

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

export const emptyBrandProfile = (name = "Untitled"): BrandProfile => ({
  brand_name: name,
  voice: { tone_descriptors: [], voice_principles: [], do: [], dont: [] },
  visual: {
    palette: [],
    typography: { display: null, body: null, mono: null },
    logo_usage: [],
  },
  localization: { locales: [], notes: null },
  banned_terms: [],
});
