import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgres://localhost:5432/bildkeller_test",
      SESSION_SECRET: "0".repeat(64),
      MEDIA_DIR: "./data/test-media",
    },
    globalSetup: "./test/globalSetup.ts",
  },
});
