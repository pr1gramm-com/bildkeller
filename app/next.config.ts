import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bildkeller/db"],
  serverExternalPackages: ["drizzle-orm"],
};

export default nextConfig;
