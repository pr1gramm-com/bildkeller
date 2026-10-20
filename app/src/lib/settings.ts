import { eq } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";

import { DEFAULT_SETTINGS, type Settings } from "./site-settings";
export { DEFAULT_SETTINGS, type Settings } from "./site-settings";

export async function getSettings(userId: number): Promise<Settings> {
  const row = (await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)).limit(1))[0];
  return { ...DEFAULT_SETTINGS, ...(row?.settings as object) } as Settings;
}

/** Applies only known keys, coercing the form string to the default's type. */
export async function updateSettings(userId: number, form: Record<string, string>): Promise<Settings> {
  const patch: Record<string, string | number | boolean> = {};
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (key === "avatar") continue; // only the validated avatar upload endpoint may set media paths
    const raw = form[key];
    if (raw === undefined) continue;
    if (typeof def === "boolean") patch[key] = raw === "1" || raw === "true";
    else if (typeof def === "number") patch[key] = Number(raw) || 0;
    else patch[key] = raw;
  }
  return changeSettings(userId, (current) => ({ ...current, ...patch }));
}

/** Lock the owner even before a settings row exists, so read/modify/write operations cannot lose updates. */
export async function changeSettings(userId: number, change: (current: Settings) => Settings): Promise<Settings> {
  return db.transaction(async (tx) => {
    await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId)).for("update");
    const [row] = await tx.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
    const current = { ...DEFAULT_SETTINGS, ...(row?.settings as object) } as Settings;
    const next = change(current);
    await tx.insert(schema.userSettings).values({ userId, settings: next })
      .onConflictDoUpdate({ target: schema.userSettings.userId, set: { settings: next } });
    return next;
  });
}
