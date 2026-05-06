import { Worker } from "bullmq";
import {
  type ExtractProfileJob,
  handleExtractProfile,
  handleExtractProfileFailed,
} from "./extract-profile-handler.js";
import {
  type GenerateImageJob,
  handleGenerateImage,
  handleGenerateImageFailed,
} from "./generate-image-handler.js";
import { logger, redisQueue } from "./infra.js";

const extractWorker = new Worker<ExtractProfileJob>("extract-profile", handleExtractProfile, {
  connection: redisQueue,
  concurrency: 2,
});
extractWorker.on("failed", async (job, err) => {
  if (job) await handleExtractProfileFailed(job, err.message);
});
extractWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, queue: "extract-profile" }, "job:completed");
});

const imageWorker = new Worker<GenerateImageJob>("generate-image", handleGenerateImage, {
  connection: redisQueue,
  concurrency: 2,
});
imageWorker.on("failed", async (job, err) => {
  if (job) await handleGenerateImageFailed(job, err.message);
});
imageWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, queue: "generate-image" }, "job:completed");
});

logger.info("worker started: extract-profile, generate-image");
