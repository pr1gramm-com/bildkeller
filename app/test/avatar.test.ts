import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/user/avatar/route";
import { createSession } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/settings";
import { avatarPath, storeAvatar, MAX_AVATAR_BYTES } from "@/lib/avatar";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createTestUser, cookieFor } from "./helpers";

let token = "", other = "", owner = 0, otherId = 0, name = "";
const image = (width = 128, height = 64) => sharp({ create: { width, height, channels: 3, background: "red" } }).png().toBuffer();
beforeAll(async () => {
  const user = await createTestUser("avatar-owner"); owner = user.id; name = user.name; token = await createSession(owner);
  otherId = (await createTestUser("avatar-other")).id; other = await createSession(otherId);
});
async function post(buffer?: Buffer, extra: Record<string, string> = {}, session = token) {
  const form = new FormData(); form.set("_nonce", session.slice(0, 16));
  if (buffer) form.set("image", new Blob([new Uint8Array(buffer)], { type: "image/png" }), "avatar.png");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return (await POST(new NextRequest("http://localhost/api/user/avatar", { method: "POST", body: form, headers: cookieFor(session) }))).json();
}
describe("profile avatars", () => {
  it("requires an authenticated account and nonce", async () => {
    expect((await post(await image(), {}, "")).error).toBe("not logged in");
    expect((await post(await image(), { _nonce: "wrong" })).error).toBe("csrf");
  });
  it("rejects invalid image formats, dimensions and crop coordinates", async () => {
    expect((await post(Buffer.from("invalid"))).error).toBe("invalid avatar");
    expect((await post(await image(32, 64))).error).toBe("invalid avatar");
    expect((await post(await image(), { x: "101" })).error).toBe("invalid avatar");
    expect((await post(await image(), { zoom: "NaN" })).error).toBe("invalid avatar");
    const gif = await sharp(await image()).gif().toBuffer();
    await expect(storeAvatar(gif, 50, 50, 1)).rejects.toThrow();
  });
  it("rejects oversized extra fields even without a Content-Length header", async () => {
    const body = `--test\r\nContent-Disposition: form-data; name="_nonce"\r\n\r\n${token.slice(0, 16)}\r\n--test\r\nContent-Disposition: form-data; name="extra"\r\n\r\n${"x".repeat(MAX_AVATAR_BYTES + 65536)}\r\n--test--\r\n`;
    const request = new NextRequest("http://localhost/api/user/avatar", { method: "POST", body, headers: { ...cookieFor(token), "content-type": "multipart/form-data; boundary=test" } });
    expect(request.headers.has("content-length")).toBe(false);
    expect((await (await POST(request)).json()).error).toBe("too large");
  });
  it("stores a normalized 512px image and exposes it publicly on the profile", async () => {
    const result = await post(await image(), { x: "75", y: "25", zoom: "2" });
    expect(result.error).toBeNull(); expect(avatarPath(result.settings.avatar)).toBe(result.settings.avatar);
    const buffer = await readFile(path.join(process.env.MEDIA_DIR!, result.settings.avatar));
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(512); expect(meta.height).toBe(512); expect(meta.format).toBe("png"); expect(meta.exif).toBeUndefined();
    const profile = await (await handle(new NextRequest(`http://localhost/api/profile/info?name=${name}`), ["profile", "info"])).json();
    expect(profile.user.avatar).toBe(result.settings.avatar);
    await updateSettings(owner, { avatar: "../private.png" });
    expect((await getSettings(owner)).avatar).toBe(result.settings.avatar);
  });
  it("removes only the authenticated account's avatar", async () => {
    expect((await post(undefined, { remove: "1" }, other)).error).toBeNull();
    expect((await getSettings(owner)).avatar).not.toBe("");
    expect((await getSettings(otherId)).avatar).toBe("");
    expect((await post(undefined, { remove: "1" })).settings.avatar).toBe("");
  });
});
