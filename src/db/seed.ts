/**
 * Standalone seed script — run with `npm run seed`
 * Re-creates the database with fresh seed data.
 */
import { initDb } from "./schema";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "world.db");

// Remove existing DB for clean reseed
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log("[Seed] Removed existing world.db");
}

initDb(dbPath);
console.log("[Seed] Database seeded successfully.");
