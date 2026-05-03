import { randomUUID } from "node:crypto";
import { err, ok, RepoError } from "@studio/db";
import { type BrandProfile, emptyBrandProfile } from "@studio/schemas";
import { extractProfileQueue } from "../../infra/queue.js";
import { putPdf } from "../../infra/storage.js";
import { brandProfileRepo } from "./repository.js";

export const brandProfileService = {
  list: brandProfileRepo.listByBrand,
  get: brandProfileRepo.getById,
  edit: brandProfileRepo.editAsNewVersion,
  setCurrent: brandProfileRepo.setCurrent,

  async createFromPdf(input: {
    orgId: string;
    brandId: string;
    userId: string;
    file: { buffer: Buffer; name: string; size: number };
  }) {
    if (input.file.size > 20 * 1024 * 1024) {
      return err(new RepoError("validation", "PDF must be ≤ 20 MB"));
    }
    const s3Key = `profiles/${randomUUID()}.pdf`;
    await putPdf(s3Key, input.file.buffer);
    const r = await brandProfileRepo.insertProcessing({
      orgId: input.orgId,
      brandId: input.brandId,
      userId: input.userId,
      s3Key,
      filename: input.file.name,
      sizeBytes: input.file.size,
    });
    if (!r.ok) return r;
    await extractProfileQueue.add(
      "extract",
      {
        profileId: r.value.id,
        s3Key,
        brandId: input.brandId,
        orgId: input.orgId,
        userId: input.userId,
      },
      { jobId: r.value.id },
    );
    return ok(r.value);
  },

  async createHandAuthored(input: { orgId: string; brandId: string; userId: string; profile?: BrandProfile }) {
    return brandProfileRepo.insertHandAuthored({
      orgId: input.orgId,
      brandId: input.brandId,
      userId: input.userId,
      profile: input.profile ?? emptyBrandProfile(),
    });
  },

  async retry(input: { orgId: string; userId: string; profileId: string }) {
    const { orgId, userId, profileId } = input;
    const r = await brandProfileRepo.markRetry(orgId, profileId);
    if (!r.ok) return r;
    if (!r.value.sourcePdfS3Key) {
      return err(new RepoError("conflict", "profile has no source PDF to retry"));
    }
    await extractProfileQueue.add(
      "extract",
      {
        profileId,
        s3Key: r.value.sourcePdfS3Key,
        brandId: r.value.brandId,
        orgId,
        userId,
      },
      { jobId: `${profileId}-retry-${Date.now()}` },
    );
    return ok(r.value);
  },
};
