import { execSync } from "node:child_process";

const TEST_DB = "postgres://localhost:5432/bildkeller_test";

export default function globalSetup() {
  execSync(
    `psql -h localhost -d postgres -c "DROP DATABASE IF EXISTS bildkeller_test" -c "CREATE DATABASE bildkeller_test"`,
    { stdio: "pipe" },
  );
  execSync("npx drizzle-kit push --force", {
    cwd: path(),
    env: { ...process.env, DATABASE_URL: TEST_DB },
    stdio: "pipe",
  });
}

function path() {
  return new URL("../../packages/db", import.meta.url).pathname;
}
