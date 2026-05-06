import { extractBrandProfile } from "@studio/ai";
import { db, schema } from "@studio/db";
import type { Job } from "bullmq";
import { and, eq } from "drizzle-orm";
import { env, getPdfBytes, logger, redisPub } from "./infra.js";

const PROFILE_EVENTS = "profile:events";
const failedAttemptCounters = new Map<string, number>();

export type ExtractProfileJob = {
  profileId: string;
  s3Key: string;
  brandId: string;
  orgId: string;
  userId: string;
};

export async function handleExtractProfile(job: Job<ExtractProfileJob>) {
  const { profileId, s3Key, brandId, orgId, userId } = job.data;
  const log = logger.child({
    profileId,
    jobId: job.id,
    attempt: job.attemptsMade + 1,
  });
  log.info("extract:start");

  if (env.FORCE_EXTRACT_FAIL) {
    const seen = (failedAttemptCounters.get(profileId) ?? 0) + 1;
    failedAttemptCounters.set(profileId, seen);
    if (seen === 1) throw new Error("forced fail (test harness)");
  }

  const pdf = await getPdfBytes(s3Key);
  const { profile, usage } = await extractBrandProfile(pdf);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.brandProfiles)
      .set({ profile, status: "ready", ingestError: null })
      .where(eq(schema.brandProfiles.id, profileId));
    await tx
      .update(schema.brandProfiles)
      .set({ isCurrent: false })
      .where(and(eq(schema.brandProfiles.brandId, brandId), eq(schema.brandProfiles.isCurrent, true)));
    await tx.update(schema.brandProfiles).set({ isCurrent: true }).where(eq(schema.brandProfiles.id, profileId));
    await tx.insert(schema.usageEvents).values({
      orgId,
      brandId,
      userId,
      generationId: null,
      feature: "extract",
      provider: usage.provider,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: usage.costUsd.toFixed(6),
      latencyMs: usage.latencyMs,
    });
  });

  await redisPub.publish(PROFILE_EVENTS, JSON.stringify({ profileId, event: "ready" }));
  log.info({ latencyMs: usage.latencyMs }, "extract:done");
}

export async function handleExtractProfileFailed(job: Job<ExtractProfileJob>, errMsg: string) {
  const { profileId } = job.data;
  if ((job.attemptsMade ?? 0) < (job.opts.attempts ?? 1)) return;
  await db
    .update(schema.brandProfiles)
    .set({ status: "failed", ingestError: errMsg })
    .where(eq(schema.brandProfiles.id, profileId));
  await redisPub.publish(PROFILE_EVENTS, JSON.stringify({ profileId, event: "failed", error: errMsg }));
  logger.error({ profileId, err: errMsg }, "extract:final-fail");
}
