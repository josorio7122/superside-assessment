import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
console.log("[db] schema dropped");
await pool.end();
