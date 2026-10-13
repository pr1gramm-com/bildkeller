import { eq } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";

const DEFAULTS: Record<string, unknown> = {
  "promotion.threshold": 3,
  "upload.ratelimit.hours": 24,
  "upload.ratelimit.count": 60,
  "invites.required": true,
};

export async function config(key: string): Promise<unknown> {
  const rows = await db
    .select()
    .from(schema.siteConfig)
    .where(eq(schema.siteConfig.key, key))
    .limit(1);
  return rows[0]?.value ?? DEFAULTS[key];
}

export async function configInt(key: string): Promise<number> {
  const v = await config(key);
  return typeof v === "number" ? v : Number(v ?? 0);
}
