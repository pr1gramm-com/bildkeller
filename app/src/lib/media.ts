import { createHash, randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import sharp from "sharp";

const execFileP = promisify(execFile);

const MEDIA_DIR = process.env.MEDIA_DIR ?? "./data/media";

export type MediaExt = "png" | "jpg" | "gif" | "webm" | "mp4" | "mov";

export function detectMime(buf: Buffer): { ext: MediaExt; video: boolean } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", video: false };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", video: false };
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return { ext: "gif", video: false };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { ext: "webm", video: true };
  const brand = buf.subarray(4, 8).toString("binary");
  if (brand === "ftyp") {
    const minor = buf.subarray(8, 12).toString("binary");
    return { ext: minor.startsWith("qt") ? "mov" : "mp4", video: true };
  }
  return null;
}

export type StoredMedia = {
  key: string;
  image: string;
  thumb: string;
  fullsize: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  audio: boolean;
  dhash: string;
};

const THUMB_WIDTH = 200;
const MAX_SIDE = 1280;
const EXEC = { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 };

const scaled = (w: number, h: number) => {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h, 1));
  return { width: Math.round(w * k), height: Math.round(h * k) };
};

export async function storeUpload(buf: Buffer): Promise<StoredMedia> {
  const mime = detectMime(buf);
  if (!mime) throw new Error("invalid");
  const sha = createHash("sha256").update(buf).digest("hex");
  const now = new Date();
  const rel = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
  const dir = path.join(MEDIA_DIR, rel);
  await mkdir(dir, { recursive: true });

  const imageRel = `${rel}/${sha}.${mime.ext}`;
  const thumbRel = `${rel}/${sha}.t.jpg`;
  const written: string[] = [];
  const out = (name: string) => {
    const full = path.join(dir, name);
    written.push(full);
    return full;
  };

  let width = 0;
  let height = 0;
  let audio = false;
  try {
    if (!mime.video) {
      // First frame only: animated inputs would otherwise report all frames stacked.
      const meta = await sharp(buf).metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
      if (!width || !height) throw new Error("invalid");
      // JPEGs are re-encoded (auto-rotated) which also drops EXIF/GPS; other formats keep their bytes.
      if (mime.ext === "jpg") {
        const clean = await sharp(buf).rotate().jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
        width = clean.info.width;
        height = clean.info.height;
        await writeFile(out(`${sha}.jpg`), clean.data);
      } else {
        await writeFile(out(`${sha}.${mime.ext}`), buf);
      }
      await sharp(buf).rotate().resize({ width: Math.min(THUMB_WIDTH, width) }).jpeg().toFile(out(`${sha}.t.jpg`));
    } else {
      const src = out(`${sha}.${mime.ext}`);
      await writeFile(src, buf);
      const probe = await execFileP(
        "ffprobe",
        ["-v", "error", "-print_format", "json", "-show_streams", src],
        EXEC,
      );
      const info = JSON.parse(probe.stdout) as { streams: Array<{ codec_type: string; width?: number; height?: number }> };
      const video = info.streams.find((s) => s.codec_type === "video");
      if (!video?.width || !video.height) throw new Error("invalid");
      width = video.width;
      height = video.height;
      audio = info.streams.some((s) => s.codec_type === "audio");
      const thumb = out(`${sha}.t.jpg`);
      const frame = (ss: string[]) =>
        execFileP("ffmpeg", ["-y", ...ss, "-i", src, "-frames:v", "1", "-vf", `scale=${THUMB_WIDTH}:-2`, thumb], EXEC);
      await frame(["-ss", "1"]).catch(() => frame([]));
    }
  } catch {
    await Promise.all(written.map((f) => rm(f, { force: true })));
    throw new Error("invalid");
  }

  const fit = scaled(width, height);
  return {
    key: randomBytes(16).toString("hex"),
    image: imageRel,
    thumb: thumbRel,
    fullsize: "",
    width: fit.width,
    height: fit.height,
    originalWidth: width,
    originalHeight: height,
    audio,
    dhash: sha,
  };
}
