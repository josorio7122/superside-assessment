import type { Job } from "bullmq";
import { db, schema } from "@studio/db";
import { generateImageVariant } from "@studio/ai";
import { eq } from "drizzle-orm";
import { GENERATION_EVENTS_CHANNEL, logger, putBytes, redisPub } from "./infra.js";

export type GenerateImageJob = {
  generationId: string;
  orgId: string;
  brandId: string;
  userId: string;
  groundedPrompt: string;
};

type VariantMeta = { index: number; s3Key: string; size: "1024x1024" };

export async function handleGenerateImage(job: Job<GenerateImageJob>) {
  const { generationId, orgId, brandId, userId, groundedPrompt } = job.data;
  const log = logger.child({
    generationId,
    jobId: job.id,
    attempt: job.attemptsMade + 1,
  });
  log.info("genimg:start");

  const t0 = Date.now();

  const tasks = [0, 1, 2].map(async (index) => {
    const { image, usage } = await generateImageVariant(groundedPrompt, {
      seed: 1000 + index,
    });
    const s3Key = `gen-${generationId}/${index}.png`;
    await putBytes(s3Key, Buffer.from(image), "image/png");
    await redisPub.publish(
      GENERATION_EVENTS_CHANNEL,
      JSON.stringify({
        generationId,
        event: "variant_ready",
        index,
        s3Key,
        size: "1024x1024",
      }),
    );
    return { index, s3Key, size: "1024x1024" as const, usage };
  });

  const results = await Promise.all(tasks);
  const totalCostUsd = results.reduce((s, r) => s + r.usage.costUsd, 0);
  const maxLatencyMs = Math.max(...results.map((r) => r.usage.latencyMs));
  const variants: VariantMeta[] = results.map(({ index, s3Key, size }) => ({
    index,
    s3Key,
    size,
  }));
  const output = { variants, model: "gpt-image-2", provider: "openai" } as const;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.generations)
      .set({ status: "done", output, completedAt: new Date() })
      .where(eq(schema.generations.id, generationId));
    await tx.insert(schema.usageEvents).values({
      orgId,
      brandId,
      userId,
      generationId,
      feature: "image",
      provider: "openai",
      model: "gpt-image-2",
      inputTokens: 0,
      outputTokens: 3,
      costUsd: totalCostUsd.toFixed(6),
      latencyMs: maxLatencyMs,
    });
  });

  await redisPub.publish(
    GENERATION_EVENTS_CHANNEL,
    JSON.stringify({ generationId, event: "done", output }),
  );
  log.info({ latencyMs: Date.now() - t0, costUsd: totalCostUsd }, "genimg:done");
}

export async function handleGenerateImageFailed(job: Job<GenerateImageJob>, errMsg: string) {
  const { generationId } = job.data;
  if ((job.attemptsMade ?? 0) < (job.opts.attempts ?? 1)) return;
  await db
    .update(schema.generations)
    .set({ status: "failed", error: errMsg, completedAt: new Date() })
    .where(eq(schema.generations.id, generationId));
  await redisPub.publish(
    GENERATION_EVENTS_CHANNEL,
    JSON.stringify({ generationId, event: "failed", error: errMsg }),
  );
  logger.error({ generationId, err: errMsg }, "genimg:final-fail");
}
