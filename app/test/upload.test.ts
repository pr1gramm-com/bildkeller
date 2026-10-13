import { describe, beforeAll, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { db, schema } from "@bildkeller/db";
import { handle } from "@/lib/api/router";
import { POST as uploadRoute } from "@/app/api/items/upload/route";
import "@/lib/api/register-all";
import { createTestUser, cookieFor, NOW } from "./helpers";
import { createSession } from "@/lib/auth";

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
function req(path: string, init?: ReqInit) {
  return new NextRequest(`http://localhost:3000${path}`, init);
}
async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

let token = "";
let verifiedToken = "";
let verifiedToken2 = "";
const MEDIA = path.resolve(process.env.MEDIA_DIR ?? "./data/media");
let userDbId = 0;

async function pngBuffer(color = { r: 255, g: 0, b: 0 }): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: color } }).png().toBuffer();
}

async function uploadImage(buf: Buffer, name = "pic.png", cookie = token) {
  const fd = new FormData();
  fd.append("image", new Blob([new Uint8Array(buf)], { type: "image/png" }), name);
  return uploadRoute(new NextRequest("http://localhost:3000/api/items/upload", { method: "POST", body: fd, headers: { cookie: cookieFor(cookie).cookie } }));
}

beforeAll(async () => {
  const user = await createTestUser("uploader");
  const verified = await createTestUser("uploader-verified", { verified: true });
  userDbId = user.id;
  token = await createSession(user.id);
  verifiedToken = await createSession(verified.id);
  verifiedToken2 = await createSession((await createTestUser("uploader-media", { verified: true })).id);
});

describe("items/upload (phase 1)", () => {
  it("rejects guests", async () => {
    const body = await json(await uploadImage(await pngBuffer(), "pic.png", "nope"));
    expect(body.error).toBeTruthy();
  });

  it("stores a png and returns a key", async () => {
    const body = await json(await uploadImage(await pngBuffer()));
    expect(body.error).toBeNull();
    expect(typeof body.key).toBe("string");
    expect((body.key as string).length).toBeGreaterThan(8);
  });

  it("rejects fake mime (exe bytes as .png)", async () => {
    const body = await json(await uploadImage(Buffer.from("MZ\x90\x00fakebinary", "binary")));
    expect(body.error).toBe("invalid");
  });
});

describe("items.post (phase 2)", () => {
  it("creates the item from a staged key, with tags", async () => {
    const up = await json(await uploadImage(await pngBuffer()));
    const key = up.key as string;
    const res = await handle(
      req("/api/items/post", {
        method: "POST",
        body: new URLSearchParams({ key, sfwstatus: "sfw", tags: "Katzen, süß", _nonce: token.slice(0, 16) }),
        headers: { "content-type": "application/x-www-form-urlencoded", ...cookieFor(token) },
      }),
      ["items", "post"],
    );
    const body = await json(res);
    expect(body.error).toBeNull();
    expect(Number(body.itemId)).toBeGreaterThan(0);

    const rows = await db.select().from(schema.items).where(eq(schema.items.id, Number(body.itemId)));
    expect(rows[0].flags).toBe(1);
    expect(rows[0].image).toMatch(/\.png$/);
    expect(rows[0].thumb).toMatch(/\.jpg$/);

    const tags = await db
      .select({ tag: schema.tags.tag })
      .from(schema.itemTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.itemTags.tagId))
      .where(eq(schema.itemTags.itemId, Number(body.itemId)));
    expect(tags.map((t) => t.tag).sort()).toEqual(["katzen", "süß"]);
  });

  it("rejects identical content as similar (repost)", async () => {
    const buf = await pngBuffer();
    await json(await uploadImage(buf));
    const second = await json(await uploadImage(buf));
    const res = await handle(
      req("/api/items/post", {
        method: "POST",
        body: new URLSearchParams({ key: second.key as string, sfwstatus: "sfw", tags: "x", _nonce: token.slice(0, 16) }),
        headers: { "content-type": "application/x-www-form-urlencoded", ...cookieFor(token) },
      }),
      ["items", "post"],
    );
    expect((await json(res)).error).toBe("similar");
  });

  it("requires verification for nsfw", async () => {
    const up = await json(await uploadImage(await pngBuffer({ r: 0, g: 255, b: 0 }), "pic.png", verifiedToken));
    const res = await handle(
      req("/api/items/post", {
        method: "POST",
        body: new URLSearchParams({ key: up.key as string, sfwstatus: "nsfw", tags: "x", _nonce: verifiedToken.slice(0, 16) }),
        headers: { "content-type": "application/x-www-form-urlencoded", ...cookieFor(verifiedToken) },
      }),
      ["items", "post"],
    );
    // verified user CAN post nsfw — flip: unverified gets error
    expect((await json(res)).error).toBeNull();
    const unverifiedUp = await json(await uploadImage(await pngBuffer()));
    const res2 = await handle(
      req("/api/items/post", {
        method: "POST",
        body: new URLSearchParams({ key: unverifiedUp.key as string, sfwstatus: "nsfl", tags: "x", _nonce: token.slice(0, 16) }),
        headers: { "content-type": "application/x-www-form-urlencoded", ...cookieFor(token) },
      }),
      ["items", "post"],
    );
    expect((await json(res2)).error).toBe("verification required");
  });

  it("enforces the upload quota", async () => {
    await db.insert(schema.siteConfig).values({ key: "upload.ratelimit.count", value: 1 }).onConflictDoUpdate({ target: schema.siteConfig.key, set: { value: 1 } });
    const up = await json(await uploadImage(await pngBuffer({ r: 0, g: 0, b: 255 }), "pic.png", verifiedToken));
    void up;
    const left = await json(await handle(req("/api/items/ratelimited", { headers: cookieFor(verifiedToken) }), ["items", "ratelimited"]));
    expect(left.left).toBe(0);
    const third = await json(await uploadImage(await pngBuffer(), "pic.png", verifiedToken));
    expect(third.error).toBe("ratelimited");
    await db.delete(schema.siteConfig).where(eq(schema.siteConfig.key, "upload.ratelimit.count"));
  });
});

describe("media integrity (review findings)", () => {
  const fromKey = async (key: string) =>
    (await db.select().from(schema.uploads).where(eq(schema.uploads.key, key)))[0];

  it("a JPEG keeps its original size; the thumbnail is a separate file", async () => {
    const jpg = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 9, g: 99, b: 199 } } }).jpeg().toBuffer();
    const body = await json(await uploadImage(jpg, "p.jpg", verifiedToken2));
    const up = await fromKey(body.key as string);
    expect(up.image).not.toBe(up.thumb);
    const stored = await sharp(path.join(MEDIA, up.image)).metadata();
    expect([stored.width, stored.height]).toEqual([800, 600]);
    const thumb = await sharp(path.join(MEDIA, up.thumb)).metadata();
    expect(thumb.width).toBe(200);
  });

  it("an animated GIF reports the frame size, not frames stacked", async () => {
    const tmp = path.join(MEDIA, "..", "anim.gif");
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=100x50:rate=3", "-frames:v", "3", tmp]);
    const body = await json(await uploadImage(readFileSync(tmp), "a.gif", verifiedToken2));
    const up = await fromKey(body.key as string);
    expect([up.originalWidth, up.originalHeight]).toEqual([100, 50]);
    const thumb = await sharp(path.join(MEDIA, up.thumb)).metadata();
    expect(thumb.height).toBe(50);
  });

  it("scales proportionally instead of clamping each side", async () => {
    const wide = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
    const up = await fromKey(((await json(await uploadImage(wide, "w.png", verifiedToken2))).key as string));
    expect([up.width, up.height]).toEqual([1280, 853]);
    expect([up.originalWidth, up.originalHeight]).toEqual([3000, 2000]);
  });

  it("rejects files above the size cap", async () => {
    process.env.MAX_UPLOAD_BYTES = "1000";
    try {
      const big = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 5, g: 6, b: 7 } } }).png({ compressionLevel: 0 }).toBuffer();
      expect(big.length).toBeGreaterThan(1000);
      expect((await json(await uploadImage(big, "big.png", verifiedToken2))).error).toBe("too large");
    } finally {
      delete process.env.MAX_UPLOAD_BYTES;
    }
  });

  it("staged-but-unposted uploads count against the quota", async () => {
    const u = await createTestUser("stager", { verified: true });
    const t = await createSession(u.id);
    await db.insert(schema.siteConfig).values({ key: "upload.ratelimit.count", value: 2 }).onConflictDoUpdate({ target: schema.siteConfig.key, set: { value: 2 } });
    try {
      const mk = (n: number) => sharp({ create: { width: 8, height: 8, channels: 3, background: { r: n, g: n, b: n } } }).png().toBuffer();
      expect((await json(await uploadImage(await mk(11), "1.png", t))).error).toBeNull();
      expect((await json(await uploadImage(await mk(22), "2.png", t))).error).toBeNull();
      expect((await json(await uploadImage(await mk(33), "3.png", t))).error).toBe("ratelimited");
    } finally {
      await db.delete(schema.siteConfig).where(eq(schema.siteConfig.key, "upload.ratelimit.count"));
    }
  });
});
