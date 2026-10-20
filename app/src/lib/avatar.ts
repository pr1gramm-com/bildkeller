import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { MAX_AVATAR_BYTES } from "./avatar-path";
export { MAX_AVATAR_BYTES, avatarPath } from "./avatar-path";

export async function storeAvatar(input: Buffer, x: number, y: number, zoom: number): Promise<string> {
  if (!input.length || input.length > MAX_AVATAR_BYTES || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || x < 0 || x > 100 || y < 0 || y > 100 || zoom < 1 || zoom > 4) throw new Error("invalid avatar");
  const image = sharp(input, { limitInputPixels: 8192 * 8192 });
  const meta = await image.metadata();
  if (!["png", "jpeg"].includes(meta.format ?? "") || !meta.width || !meta.height || Math.min(meta.width, meta.height) < 64 || Math.max(meta.width, meta.height) > 8192) throw new Error("invalid avatar");
  const oriented = await image.rotate().toBuffer({ resolveWithObject: true });
  const size = Math.floor(Math.min(oriented.info.width, oriented.info.height) / zoom);
  const png = await sharp(oriented.data).extract({
    left: Math.round((oriented.info.width - size) * x / 100),
    top: Math.round((oriented.info.height - size) * y / 100), width: size, height: size,
  }).resize(512, 512).png().toBuffer();
  const relative = `avatars/${createHash("sha256").update(png).digest("hex")}.png`;
  const root = process.env.MEDIA_DIR ?? "./data/media";
  await mkdir(path.join(root, "avatars"), { recursive: true });
  await writeFile(path.join(root, relative), png);
  return relative;
}
