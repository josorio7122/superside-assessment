import { config } from "dotenv";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
config({ path: join(ROOT, ".env") });

const PDFS = join(ROOT, "infra/seed-pdfs");
const CACHE = join(ROOT, "infra/seed-extractions");

function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)] as T;
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 3600_000);
}
function jitter(d: Date) {
  return new Date(
    d.getTime() + randInt(0, 23) * 3600_000 + randInt(0, 59) * 60_000 + randInt(0, 59) * 1000,
  );
}

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadOrExtract(
  brandKey: "slack" | "heineken",
  extractFn: (pdf: Buffer) => Promise<{ profile: any; usage: any }>,
) {
  const pdfPath = join(PDFS, brandKey === "slack" ? "slack-2020.pdf" : "heineken.pdf");
  const cachePath = join(CACHE, `${brandKey}.json`);
  if (await exists(cachePath)) {
    return JSON.parse(await readFile(cachePath, "utf8")) as {
      profile: any;
      usage: any;
    };
  }
  console.log(`[seed] extracting ${brandKey} via OpenRouter (one-time, will cache)…`);
  const pdf = await readFile(pdfPath);
  const { profile, usage } = await extractFn(pdf);
  await mkdir(CACHE, { recursive: true });
  await writeFile(cachePath, JSON.stringify({ profile, usage }, null, 2));
  console.log(`[seed] cached ${cachePath}`);
  return { profile, usage };
}

async function uploadSeedPdf(
  brandKey: "slack" | "heineken",
  putPdfBytes: (key: string, body: Buffer) => Promise<void>,
): Promise<{ s3Key: string; sizeBytes: number; filename: string }> {
  const filename = brandKey === "slack" ? "slack-2020.pdf" : "heineken.pdf";
  const buf = await readFile(join(PDFS, filename));
  const s3Key = `profiles/seed-${brandKey}.pdf`;
  await putPdfBytes(s3Key, buf);
  return { s3Key, sizeBytes: buf.length, filename };
}

async function main() {
  const { db, schema } = await import("@studio/db");
  const { extractBrandProfile } = await import("@studio/ai");
  const { putPdfBytes } = await import("../apps/worker/src/infra.js");
  console.log("[seed] truncating tables…");
  await db.execute(
    "TRUNCATE TABLE usage_event, generation, brand_profile, brand, \"user\", org RESTART IDENTITY CASCADE" as any,
  );

  const [org] = await db.insert(schema.orgs).values({ name: "DesignTechCo" }).returning();
  if (!org) throw new Error("org insert failed");

  const users = await db
    .insert(schema.users)
    .values([
      { orgId: org.id, email: "jo@designtech.co", name: "Jo", role: "admin" },
      { orgId: org.id, email: "maya@designtech.co", name: "Maya", role: "brand_manager" },
      { orgId: org.id, email: "alex@designtech.co", name: "Alex", role: "brand_manager" },
      { orgId: org.id, email: "sam@designtech.co", name: "Sam", role: "designer" },
      { orgId: org.id, email: "kai@designtech.co", name: "Kai", role: "designer" },
    ])
    .returning();

  const [slack, heineken] = await db
    .insert(schema.brands)
    .values([
      { orgId: org.id, name: "Slack" },
      { orgId: org.id, name: "Heineken" },
    ])
    .returning();
  if (!slack || !heineken) throw new Error("brand insert failed");

  const brands: Array<{
    brand: { id: string };
    key: "slack" | "heineken";
    pdf: string;
  }> = [
    { brand: slack, key: "slack", pdf: "slack-brand" },
    { brand: heineken, key: "heineken", pdf: "heineken-brand" },
  ];

  for (const { brand, key, pdf } of brands) {
    const { profile, usage } = await loadOrExtract(key, extractBrandProfile);
    const editedProfile = JSON.parse(JSON.stringify(profile)) as typeof profile;
    if (editedProfile.voice?.tone_descriptors?.length > 0) {
      editedProfile.voice.tone_descriptors = editedProfile.voice.tone_descriptors.slice(0, -1);
    }

    const upload = await uploadSeedPdf(key, putPdfBytes);
    console.log(`[seed] uploaded ${key} PDF -> s3://studio-demo/${upload.s3Key} (${upload.sizeBytes} bytes)`);

    const v1At = daysAgo(26);
    const v2At = daysAgo(11);
    const v3At = daysAgo(2);

    await db.insert(schema.brandProfiles).values({
      orgId: org.id,
      brandId: brand.id,
      version: 1,
      profile,
      status: "ready",
      sourcePdfS3Key: upload.s3Key,
      sourcePdfFilename: `${pdf}-v1.pdf`,
      sourcePdfSizeBytes: upload.sizeBytes,
      isCurrent: false,
      createdBy: users[1]!.id,
      createdAt: v1At,
    });
    await db.insert(schema.brandProfiles).values({
      orgId: org.id,
      brandId: brand.id,
      version: 2,
      profile,
      status: "ready",
      sourcePdfS3Key: upload.s3Key,
      sourcePdfFilename: `${pdf}-v2.pdf`,
      sourcePdfSizeBytes: upload.sizeBytes,
      isCurrent: false,
      createdBy: users[1]!.id,
      createdAt: v2At,
    });
    await db.insert(schema.brandProfiles).values({
      orgId: org.id,
      brandId: brand.id,
      version: 3,
      profile: editedProfile,
      status: "ready",
      sourcePdfS3Key: upload.s3Key,
      sourcePdfFilename: `${pdf}-v3.pdf`,
      sourcePdfSizeBytes: upload.sizeBytes,
      isCurrent: true,
      createdBy: users[0]!.id,
      createdAt: v3At,
    });

    await db.insert(schema.usageEvents).values({
      orgId: org.id,
      brandId: brand.id,
      userId: users[1]!.id,
      generationId: null,
      feature: "extract",
      provider: "openrouter",
      model: "openai/gpt-5.5",
      inputTokens: usage?.inputTokens ?? 6000,
      outputTokens: usage?.outputTokens ?? 600,
      costUsd: ((usage?.costUsd ?? 0.012) as number).toFixed(6),
      latencyMs: usage?.latencyMs ?? 23000,
      createdAt: v1At,
    });
  }

  console.log("[seed] generating ~200 generations + ~500 usage events…");
  const types = ["copy_variant", "translate", "image"] as const;
  const status = [
    "done",
    "done",
    "done",
    "done",
    "done",
    "done",
    "done",
    "done",
    "done",
    "failed",
  ] as const;
  const brandIds = [slack.id, heineken.id];
  const figFiles = ["abc123-Marketing-2026Q2", "def456-Web-Site", "ghi789-Q3-Campaign"];

  for (let i = 0; i < 200; i++) {
    const type = pick(types);
    const st = pick(status);
    const created = jitter(daysAgo(randInt(0, 30)));
    const dur = randInt(800, 9000);
    const [gen] = await db
      .insert(schema.generations)
      .values({
        orgId: org.id,
        brandId: pick(brandIds),
        userId: pick(users).id,
        type,
        status: st,
        input:
          type === "copy_variant"
            ? { type: "copy_variant", payload: { prompt: "Localize headline", count: 3 } }
            : type === "translate"
              ? {
                  type: "translate",
                  payload: {
                    source_text: "Take collaboration to the next level.",
                    source_locale: "en",
                    target_locales: pick([["es", "fr"], ["de", "ja"], ["it", "pt-BR"]]),
                  },
                }
              : { type: "image", payload: { prompt: "Hero banner — vibrant", size: "1024x1024", count: 3 } },
        output:
          st === "failed"
            ? null
            : type === "copy_variant"
              ? ["Variant A", "Variant B", "Variant C"]
              : type === "translate"
                ? { es: "Lleva la colaboración al siguiente nivel." }
                : ["s3://var-1.png", "s3://var-2.png", "s3://var-3.png"],
        error: st === "failed" ? "model timeout" : null,
        figmaFileKey: pick(figFiles),
        figmaNodeId: `${randInt(1, 99)}:${randInt(100, 9999)}`,
        startedAt: created,
        completedAt: new Date(created.getTime() + dur),
        createdAt: created,
      })
      .returning();
    if (!gen) continue;

    const calls = type === "copy_variant" ? 1 : type === "translate" ? 2 : 1;
    for (let k = 0; k < calls; k++) {
      const inputT = type === "image" ? null : randInt(200, 1500);
      const outputT = type === "image" ? null : randInt(50, 600);
      const cost =
        type === "image"
          ? 0.04
          : (inputT! / 1000) * 0.00125 + (outputT! / 1000) * 0.01;
      await db.insert(schema.usageEvents).values({
        orgId: org.id,
        brandId: gen.brandId,
        userId: gen.userId,
        generationId: gen.id,
        feature: type,
        provider: "openrouter",
        model: type === "image" ? "openai/gpt-image-2" : "openai/gpt-5.5",
        inputTokens: inputT,
        outputTokens: outputT,
        costUsd: cost.toFixed(6),
        latencyMs: dur,
        createdAt: created,
      });
    }
  }

  console.log("[seed] done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
