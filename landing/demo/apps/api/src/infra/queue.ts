import { Queue } from "bullmq";
import { redisQueue } from "./redis.js";

export type ExtractProfileJob = {
  profileId: string;
  s3Key: string;
  brandId: string;
  orgId: string;
  userId: string;
};

export const extractProfileQueue = new Queue<ExtractProfileJob>("extract-profile", {
  connection: redisQueue,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
