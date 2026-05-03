import { Worker } from "bullmq";
import { redisQueue, logger } from "./infra.js";
import {
  handleExtractProfile,
  handleExtractProfileFailed,
  type ExtractProfileJob,
} from "./extract-profile-handler.js";

const worker = new Worker<ExtractProfileJob>("extract-profile", handleExtractProfile, {
  connection: redisQueue,
  concurrency: 2,
});

worker.on("failed", async (job, err) => {
  if (job) await handleExtractProfileFailed(job, err.message);
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "job:completed");
});

logger.info("worker started: extract-profile");
