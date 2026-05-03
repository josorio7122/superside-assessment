import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtractionResult } from "@studio/ai";
import { type Db, type schema as DbSchema, sql } from "@studio/db";
import type { BrandProfile } from "@studio/schemas";
import { config } from "dotenv";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
config({ path: join(ROOT, ".env") });

const PDFS = join(ROOT, "infra/seed-pdfs");
const CACHE = join(ROOT, "infra/seed-extractions");

type BrandKey = "slack" | "heineken";
type ExtractFn = (pdf: Buffer) => Promise<ExtractionResult>;
type PutPdfFn = (key: string, body: Buffer) => Promise<void>;
type CachedExtraction = { profile: BrandProfile; usage: ExtractionResult["usage"] };
type GenerationInputJson =
  | { type: "copy_variant"; payload: { prompt: string; count: number } }
  | {
      type: "translate";
      payload: { source_text: string; source_locale: string; target_locales: string[] };
    }
  | { type: "image"; payload: { prompt: string; size: string; count: number } };
type GenerationOutputJson = string[] | { es: string } | null;
type GenType = "copy_variant" | "translate" | "image";
type GenStatus = "done" | "failed";

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
  return new Date(d.getTime() + randInt(0, 23) * 3600_000 + randInt(0, 59) * 60_000 + randInt(0, 59) * 1000);
}

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function pdfFilenameFor(brandKey: BrandKey): string {
  return brandKey === "slack" ? "slack-2020.pdf" : "heineken.pdf";
}

async function loadOrExtract(brandKey: BrandKey, extractFn: ExtractFn): Promise<CachedExtraction> {
  const pdfPath = join(PDFS, pdfFilenameFor(brandKey));
  const cachePath = join(CACHE, `${brandKey}.json`);
  if (await exists(cachePath)) {
    return JSON.parse(await readFile(cachePath, "utf8")) as CachedExtraction;
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
  brandKey: BrandKey,
  putPdfBytes: PutPdfFn,
): Promise<{ s3Key: string; sizeBytes: number; filename: string }> {
  const filename = pdfFilenameFor(brandKey);
  const buf = await readFile(join(PDFS, filename));
  const s3Key = `profiles/seed-${brandKey}.pdf`;
  await putPdfBytes(s3Key, buf);
  return { s3Key, sizeBytes: buf.length, filename };
}

type Schema = typeof DbSchema;
type DbCtx = { db: Db; schema: Schema };
type OrgRow = Schema["orgs"]["$inferSelect"];
type UserRow = Schema["users"]["$inferSelect"];
type BrandRow = Schema["brands"]["$inferSelect"];

async function seedOrgUsersBrands(
  ctx: DbCtx,
): Promise<{ org: OrgRow; users: UserRow[]; slack: BrandRow; heineken: BrandRow }> {
  const { db, schema } = ctx;
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

  return { org, users, slack, heineken };
}

async function seedBrandProfiles(
  ctx: DbCtx,
  args: {
    org: OrgRow;
    brand: BrandRow;
    key: BrandKey;
    pdf: string;
    profile: BrandProfile;
    editedProfile: BrandProfile;
    upload: { s3Key: string; sizeBytes: number };
    adminId: string;
    managerId: string;
  },
): Promise<{ v1At: Date }> {
  const { db, schema } = ctx;
  const { org, brand, pdf, profile, editedProfile, upload, adminId, managerId } = args;
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
    createdBy: managerId,
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
    createdBy: managerId,
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
    createdBy: adminId,
    createdAt: v3At,
  });

  return { v1At };
}

function trimToneDescriptors(profile: BrandProfile): BrandProfile {
  const cloned = JSON.parse(JSON.stringify(profile)) as BrandProfile;
  if (cloned.voice?.tone_descriptors && cloned.voice.tone_descriptors.length > 0) {
    cloned.voice.tone_descriptors = cloned.voice.tone_descriptors.slice(0, -1);
  }
  return cloned;
}

async function seedBrand(
  ctx: DbCtx,
  args: {
    org: OrgRow;
    users: UserRow[];
    brand: BrandRow;
    key: BrandKey;
    pdf: string;
    extractFn: ExtractFn;
    putPdfBytes: PutPdfFn;
  },
) {
  const { db, schema } = ctx;
  const { org, users, brand, key, pdf, extractFn, putPdfBytes } = args;
  const adminUser = users[0];
  const managerUser = users[1];
  if (!adminUser || !managerUser) throw new Error("missing seeded users");

  const { profile, usage } = await loadOrExtract(key, extractFn);
  const editedProfile = trimToneDescriptors(profile);
  const upload = await uploadSeedPdf(key, putPdfBytes);
  console.log(`[seed] uploaded ${key} PDF -> s3://studio-demo/${upload.s3Key} (${upload.sizeBytes} bytes)`);

  const { v1At } = await seedBrandProfiles(ctx, {
    org,
    brand,
    key,
    pdf,
    profile,
    editedProfile,
    upload,
    adminId: adminUser.id,
    managerId: managerUser.id,
  });

  await db.insert(schema.usageEvents).values({
    orgId: org.id,
    brandId: brand.id,
    userId: managerUser.id,
    generationId: null,
    feature: "extract",
    provider: "openrouter",
    model: "openai/gpt-5.5",
    inputTokens: usage?.inputTokens ?? 6000,
    outputTokens: usage?.outputTokens ?? 600,
    costUsd: (usage?.costUsd ?? 0.012).toFixed(6),
    latencyMs: usage?.latencyMs ?? 23000,
    createdAt: v1At,
  });
}

function buildGenerationInput(type: GenType): GenerationInputJson {
  if (type === "copy_variant") {
    return { type: "copy_variant", payload: { prompt: "Localize headline", count: 3 } };
  }
  if (type === "translate") {
    return {
      type: "translate",
      payload: {
        source_text: "Take collaboration to the next level.",
        source_locale: "en",
        target_locales: pick([
          ["es", "fr"],
          ["de", "ja"],
          ["it", "pt-BR"],
        ]),
      },
    };
  }
  return { type: "image", payload: { prompt: "Hero banner — vibrant", size: "1024x1024", count: 3 } };
}

function buildGenerationOutput(type: GenType, status: GenStatus): GenerationOutputJson {
  if (status === "failed") return null;
  if (type === "copy_variant") return ["Variant A", "Variant B", "Variant C"];
  if (type === "translate") return { es: "Lleva la colaboración al siguiente nivel." };
  return ["s3://var-1.png", "s3://var-2.png", "s3://var-3.png"];
}

const CALLS_BY_TYPE: Record<GenType, number> = { copy_variant: 1, translate: 2, image: 1 };

function computeUsage(type: GenType): { inputT: number | null; outputT: number | null; cost: number } {
  if (type === "image") {
    return { inputT: null, outputT: null, cost: 0.04 };
  }
  const inputT = randInt(200, 1500);
  const outputT = randInt(50, 600);
  const cost = (inputT / 1000) * 0.00125 + (outputT / 1000) * 0.01;
  return { inputT, outputT, cost };
}

async function seedGenerationsAndUsage(
  ctx: DbCtx,
  args: { org: OrgRow; users: UserRow[]; slackId: string; heinekenId: string },
) {
  const { db, schema } = ctx;
  const { org, users, slackId, heinekenId } = args;
  const types: readonly GenType[] = ["copy_variant", "translate", "image"];
  const status: readonly GenStatus[] = [
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
  ];
  const brandIds = [slackId, heinekenId];
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
        input: buildGenerationInput(type),
        output: buildGenerationOutput(type, st),
        error: st === "failed" ? "model timeout" : null,
        figmaFileKey: pick(figFiles),
        figmaNodeId: `${randInt(1, 99)}:${randInt(100, 9999)}`,
        startedAt: created,
        completedAt: new Date(created.getTime() + dur),
        createdAt: created,
      })
      .returning();
    if (!gen) continue;

    const calls = CALLS_BY_TYPE[type];
    for (let k = 0; k < calls; k++) {
      const { inputT, outputT, cost } = computeUsage(type);
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
}

async function main() {
  const { db, schema } = await import("@studio/db");
  const { extractBrandProfile } = await import("@studio/ai");
  const { putPdfBytes } = await import("../apps/worker/src/infra.js");
  console.log("[seed] truncating tables…");
  await db.execute(
    sql`TRUNCATE TABLE usage_event, generation, brand_profile, brand, "user", org RESTART IDENTITY CASCADE`,
  );

  const ctx: DbCtx = { db, schema };
  const { org, users, slack, heineken } = await seedOrgUsersBrands(ctx);

  const brands: Array<{ brand: BrandRow; key: BrandKey; pdf: string }> = [
    { brand: slack, key: "slack", pdf: "slack-brand" },
    { brand: heineken, key: "heineken", pdf: "heineken-brand" },
  ];

  for (const { brand, key, pdf } of brands) {
    await seedBrand(ctx, { org, users, brand, key, pdf, extractFn: extractBrandProfile, putPdfBytes });
  }

  console.log("[seed] generating ~200 generations + ~500 usage events…");
  await seedGenerationsAndUsage(ctx, { org, users, slackId: slack.id, heinekenId: heineken.id });

  console.log("[seed] done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
