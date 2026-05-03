import { buildGroundedPrompt } from "@studio/ai";
import { err, ok, RepoError } from "@studio/db";
import type { CreateImageGenerationBody } from "@studio/schemas";
import { brandRepo } from "../brand/repository.js";
import { brandProfileRepo } from "../brand-profile/repository.js";
import { generateImageQueue } from "../../infra/queue.js";
import { genRepo } from "./repository.js";

export const generationService = {
  async createImage(input: {
    orgId: string;
    userId: string;
    body: CreateImageGenerationBody;
  }) {
    const { orgId, userId } = input;
    const { prompt, brandId, layerName } = input.body;

    const brand = await brandRepo.getById(orgId, brandId);
    if (!brand.ok) return brand;

    const profile = await brandProfileRepo.currentForBrand(orgId, brandId);
    if (!profile.ok) {
      return err(new RepoError("conflict", "brand has no ready profile"));
    }
    if (profile.value.status !== "ready" || !profile.value.profile) {
      return err(new RepoError("conflict", "brand profile not ready"));
    }

    const groundedPrompt = buildGroundedPrompt(prompt, profile.value.profile);

    const created = await genRepo.create({
      orgId,
      brandId,
      userId,
      inputJson: {
        prompt,
        groundedPrompt,
        brandId,
        layerName,
        layerSize: "1024x1024",
        profileVersion: profile.value.version,
      },
    });
    if (!created.ok) return created;

    await generateImageQueue.add(
      "generate-image",
      {
        generationId: created.value.id,
        orgId,
        brandId,
        userId,
        groundedPrompt,
      },
      { jobId: created.value.id },
    );
    return ok({ id: created.value.id, status: "running" as const });
  },
};
