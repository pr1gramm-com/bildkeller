import { db, schema } from "@bildkeller/db";

export const NOW = () => Math.floor(Date.now() / 1000);

let suffix = 0;

export async function createTestUser(name?: string, opts?: { verified?: boolean; admin?: boolean; mod?: boolean }) {
  suffix += 1;
  const [user] = await db
    .insert(schema.users)
    .values({
      name: name ?? `testuser${suffix}-${Date.now()}`,
      passwordHash: "x",
      verified: opts?.verified ?? false,
      admin: opts?.admin ?? false,
      mod: opts?.mod ?? false,
      created: NOW(),
    })
    .returning();
  return user;
}

export async function createItem(
  userId: number,
  overrides: Partial<typeof schema.items.$inferInsert> = {},
) {
  suffix += 1;
  const [item] = await db
    .insert(schema.items)
    .values({
      userId,
      flags: 1,
      image: `2026/10/13/img${suffix}.png`,
      thumb: `2026/10/13/img${suffix}.jpg`,
      width: 100,
      height: 100,
      originalWidth: 100,
      originalHeight: 100,
      created: NOW(),
      key: `key-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...overrides,
    })
    .returning();
  return item;
}

export function cookieFor(token: string): Record<string, string> {
  return { cookie: `me=${Buffer.from(JSON.stringify({ id: token }), "utf8").toString("base64url")}` };
}
