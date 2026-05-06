import IORedis from "ioredis";
import { env } from "../env.js";

export const redisPub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const redisSub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const redisQueue = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const PROFILE_EVENTS_CHANNEL = "profile:events";
export const GENERATION_EVENTS_CHANNEL = "generation:events";
