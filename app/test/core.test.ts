import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { wilson } from "@/lib/wilson";
import { effectiveFlags } from "@/lib/flags";
import { maybePromote } from "@/lib/promote";
import { uploadQuota } from "@/lib/ratelimit";
import type { SessionUser } from "@/lib/types";

const now = Math.floor(Date.now() / 1000);
let itemId = 0;
let quotaUserId = 0;

beforeAll(async () => {
  const [u1] = await db
    .insert(schema.users)
    .values({ name: "corehelper", passwordHash: "x", created: now })
    .returning();
  quotaUserId = u1.id;

  await db.insert(schema.siteConfig).values({ key: "upload.ratelimit.count", value: 4 });

  const [item] = await db
    .insert(schema.items)
    .values({
      userId: u1.id,
      flags: 1,
      image: "x",
      thumb: "x",
      width: 1,
      height: 1,
      originalWidth: 1,
      originalHeight: 1,
      created: now,
      key: `core-${now}`,
      up: 4,
      down: 0,
    })
    .returning();
  itemId = item.id;
});

describe("wilson", () => {
  it("orders confidence sensibly", () => {
    expect(wilson(5, 0)).toBeCloseTo(0.5655, 3); // matches observed reference-API confidence
    expect(wilson(5, 0)).toBeGreaterThan(wilson(6, 1));
    expect(wilson(6, 1)).toBeGreaterThan(wilson(10, 8));
    expect(wilson(10, 8)).toBeGreaterThan(wilson(1, 0));
    expect(wilson(0, 0)).toBe(0);
  });
});

describe("effectiveFlags", () => {
  const guest = null;
  const unverified: SessionUser = {
    id: "t",
    userId: 1,
    name: "u",
    mark: 2,
    verified: false,
    admin: false,
    mod: false,
    flags: 1,
  };
  const verified = { ...unverified, verified: true };

  it("guests are pinned to SFW", () => {
    expect(effectiveFlags(guest, 31)).toBe(1);
  });

  it("unverified users see SFW + NSFP", () => {
    expect(effectiveFlags(unverified, 31)).toBe(9);
  });

  it("verified users see everything requested", () => {
    expect(effectiveFlags(verified, 31)).toBe(31);
  });
});

describe("maybePromote", () => {
  it("promotes when net score reaches the threshold", async () => {
    await maybePromote(itemId);
    const rows = await db.select().from(schema.items).where(eq(schema.items.id, itemId));
    expect(rows[0].promoted).toBeGreaterThan(0);
  });

  it("leaves items below threshold unpromoted", async () => {
    const [item] = await db
      .insert(schema.items)
      .values({
        userId: quotaUserId,
        flags: 1,
        image: "y",
        thumb: "y",
        width: 1,
        height: 1,
        originalWidth: 1,
        originalHeight: 1,
        created: now,
        key: `core-b-${now}`,
        up: 1,
        down: 0,
      })
      .returning();
    await maybePromote(item.id);
    const rows = await db.select().from(schema.items).where(eq(schema.items.id, item.id));
    expect(rows[0].promoted).toBe(0);
  });
});

describe("uploadQuota", () => {
  it("counts uploads inside the window against the configured limit", async () => {
    for (let i = 0; i < 3; i++) {
      await db.insert(schema.items).values({
        userId: quotaUserId,
        flags: 1,
        image: `q${i}`,
        thumb: `q${i}`,
        width: 1,
        height: 1,
        originalWidth: 1,
        originalHeight: 1,
        created: now,
        key: `quota-${now}-${i}`,
      });
    }
    const left = await uploadQuota(quotaUserId);
    expect(left).toBe(0); // limit 4, 5 items by this user (incl. fixtures) → clamped to 0
  });
});
