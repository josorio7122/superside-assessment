import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = [join(__dir, "..", ".env"), join(__dir, "..", "..", "..", ".env")].find((p) => existsSync(p));
if (envPath) config({ path: envPath });
else config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  STORAGE_MODE: z.enum(["s3", "local"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("./.local-storage"),
  S3_ENDPOINT: z.string().url().default("http://localhost:4566"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("studio-demo"),
  S3_ACCESS_KEY: z.string().default("test"),
  S3_SECRET_KEY: z.string().default("test"),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
});
export const env = schema.parse(process.env);
