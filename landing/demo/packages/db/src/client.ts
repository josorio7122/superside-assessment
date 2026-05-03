import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = [join(__dir, "..", "..", "..", ".env"), join(__dir, "..", "..", "..", "..", ".env")].find((p) =>
  existsSync(p),
);
if (envPath) config({ path: envPath });
else config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export { schema };
export type Db = typeof db;
