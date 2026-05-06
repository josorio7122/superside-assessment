import type { BrandProfile } from "@studio/schemas";

export function buildGroundedPrompt(userPrompt: string, profile: BrandProfile): string {
  const colors = profile.visual.palette
    .slice(0, 5)
    .map((p) => `${p.name} (${p.hex})`)
    .join(", ");
  const logoCue = profile.visual.logo_usage[0];
  const colorLine = colors ? `\nVisual must align with brand palette: ${colors}.` : "";
  const logoLine = logoCue ? `\nLogo guideline: ${logoCue}.` : "";
  return `${userPrompt}

Brand: ${profile.brand_name}.${colorLine}${logoLine}
Style: photographic, marketing-grade, no on-image text.`;
}
