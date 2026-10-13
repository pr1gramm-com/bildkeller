import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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

export async function storeUpload(buf: Buffer): Promise<StoredMedia> {
  const mime = detectMime(buf);
  if (!mime) throw new Error("invalid");
  const sha = createHash("sha256").update(buf).digest("hex");
  const rel = `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(new Date().getDate()).padStart(2, "0")}`;
  const dir = path.join(MEDIA_DIR, rel);
  await mkdir(dir, { recursive: true });

  let width = 0;
  let height = 0;
  let audio = false;

  if (!mime.video) {
    const img = sharp(buf, { animated: mime.ext === "gif" });
    const meta = await img.metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
    await writeFile(path.join(dir, `${sha}.${mime.ext}`), buf);
    await img.resize({ width: Math.min(THUMB_WIDTH, width || THUMB_WIDTH) }).jpeg().toFile(path.join(dir, `${sha}.jpg`));
  } else {
    const tmpIn = path.join(dir, `${sha}.${mime.ext}`);
    await writeFile(tmpIn, buf);
    // dimensions + audio via ffprobe, thumb via ffmpeg
    const probe = await execFileP("ffprobe", [
      "-v", "error", "-print_format", "json", "-show_streams", "-show_format", tmpIn,
    ]).catch(() => null);
    if (probe) {
      const info = JSON.parse(probe.stdout) as {
        streams: Array<{ codec_type: string; width?: number; height?: number }>;
      };
      const video = info.streams.find((s) => s.codec_type === "video");
      width = video?.width ?? 0;
      height = video?.height ?? 0;
      audio = info.streams.some((s) => s.codec_type === "audio");
    }
    await execFileP("ffmpeg", [
      "-y", "-ss", "1", "-i", tmpIn, "-frames:v", "1", "-vf", `scale=${THUMB_WIDTH}:-2`, path.join(dir, `${sha}.jpg`),
    ]).catch(async () => {
      await execFileP("ffmpeg", ["-y", "-i", tmpIn, "-frames:v", "1", path.join(dir, `${sha}.jpg`)]);
    });
  }

  return {
    key: randomBytes(16).toString("hex"),
    image: `${rel}/${sha}.${mime.ext}`,
    thumb: `${rel}/${sha}.jpg`,
    fullsize: "",
    width: Math.min(width, 1280),
    height: Math.min(height, 1280),
    originalWidth: width,
    originalHeight: height,
    audio,
    dhash: sha,
  };
}
