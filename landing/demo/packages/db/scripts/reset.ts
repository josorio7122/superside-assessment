import { config } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dir, "..", "..", "..", ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
console.log("[db] schema dropped");
await pool.end();
