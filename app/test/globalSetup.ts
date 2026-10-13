import { execSync } from "node:child_process";
import pg from "pg";

const BASE = process.env.TEST_PG_URL ?? "postgres://localhost:5432";

export default async function globalSetup() {
  const admin = new pg.Client({ connectionString: `${BASE}/postgres` });
  await admin.connect();
  await admin.query("DROP DATABASE IF EXISTS bildkeller_test");
  await admin.query("CREATE DATABASE bildkeller_test");
  await admin.end();

  execSync("npx drizzle-kit push --force", {
    cwd: new URL("../../packages/db", import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: `${BASE}/bildkeller_test` },
    stdio: "pipe",
  });
}
