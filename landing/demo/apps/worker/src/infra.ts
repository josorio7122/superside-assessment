import { config } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import IORedis from "ioredis";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import pino from "pino";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dir, "..", "..", "..", ".env") });

export const env = {
  REDIS_URL: process.env.REDIS_URL!,
  STORAGE_MODE: (process.env.STORAGE_MODE ?? "local") as "s3" | "local",
  LOCAL_STORAGE_DIR: process.env.LOCAL_STORAGE_DIR ?? "./.local-storage",
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:4566",
  S3_REGION: process.env.S3_REGION ?? "us-east-1",
  S3_BUCKET: process.env.S3_BUCKET ?? "studio-demo",
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? "test",
  S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? "test",
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === "true",
  FORCE_EXTRACT_FAIL: process.env.FORCE_EXTRACT_FAIL === "1",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
};

const localRoot = join(__dir, "..", "..", "..", env.LOCAL_STORAGE_DIR);

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export const redisQueue = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const redisPub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const s3 =
  env.STORAGE_MODE === "s3"
    ? new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
      })
    : null;

export async function getPdfBytes(key: string): Promise<Buffer> {
  if (s3) {
    const obj = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    const chunks: Buffer[] = [];
    for await (const c of obj.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }
  return readFile(join(localRoot, key));
}

export async function putPdfBytes(key: string, body: Buffer): Promise<void> {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: "application/pdf",
      }),
    );
    return;
  }
  const path = join(localRoot, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}
