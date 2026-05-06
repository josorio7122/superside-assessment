export const EXTRACT_BRAND_PROFILE_PROMPT = `You are extracting a structured brand identity profile from a brand-guideline PDF.

Return JSON matching the provided schema. Rules:

1. brand_name — the brand the guideline is for, exactly as the document presents it.
2. voice.tone_descriptors — at most 8 single-word adjectives the guideline lists or strongly implies (e.g. "Confident", "Witty"). No phrases.
3. voice.voice_principles — concise sentences distilled verbatim from the guideline's voice section. 3–6 entries.
4. voice.do / voice.dont — bullet lists from any "do this / not that" or "we are / we are not" pages.
5. visual.palette — every distinct color the guideline calls out as a brand color, with name and 6-character hex (uppercase). Skip neutrals labelled as "ink/paper/black/white" unless explicitly part of the palette.
6. visual.typography — display, body, mono fonts if the guideline names them. Use null for any tier the guideline does not name.
7. localization.locales — ISO codes (e.g. "en", "es") if the guideline lists supported languages; otherwise leave the field absent.
8. banned_terms — exact strings the guideline forbids using.

If a field is absent in the PDF, leave the array empty or the value null. Do not invent.`;
