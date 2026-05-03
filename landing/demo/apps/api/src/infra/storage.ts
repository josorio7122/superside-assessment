import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const localRoot = join(__dir, "..", "..", "..", "..", env.LOCAL_STORAGE_DIR);

const s3 =
  env.STORAGE_MODE === "s3"
    ? new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
      })
    : null;

export async function putPdf(key: string, body: Buffer, contentType = "application/pdf") {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }
  const path = join(localRoot, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

export async function getPdf(key: string): Promise<Buffer> {
  if (s3) {
    const obj = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    const chunks: Buffer[] = [];
    for await (const c of obj.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }
  return readFile(join(localRoot, key));
}

export async function signedReadUrl(key: string, expiresInSec = 3600) {
  if (s3) {
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
      expiresIn: expiresInSec,
    });
  }
  return `/api/_storage/${encodeURIComponent(key)}`;
}

export async function readLocalForRoute(key: string): Promise<Buffer> {
  return readFile(join(localRoot, key));
}
