import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import type { NextRequest } from "next/server";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webm: "video/webm",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

const body = (file: string, start: number, end: number) =>
  Readable.toWeb(createReadStream(file, { start, end })) as unknown as ReadableStream;

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const root = path.resolve(process.env.MEDIA_DIR ?? "./data/media");
  const { path: segs } = await params;
  const full = path.resolve(root, ...segs);
  const type = TYPES[path.extname(full).slice(1).toLowerCase()];
  if (!full.startsWith(root + path.sep) || !type) return new Response("not found", { status: 404 });

  let size: number;
  try {
    const st = await stat(full);
    if (!st.isFile()) return new Response("not found", { status: 404 });
    size = st.size;
  } catch {
    return new Response("not found", { status: 404 });
  }

  const headers = {
    "content-type": type,
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
  };
  const m = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2]) && size > 0) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new Response(body(full, start, end), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  if (size === 0) return new Response(null, { headers: { ...headers, "content-length": "0" } });
  return new Response(body(full, 0, size - 1), { headers: { ...headers, "content-length": String(size) } });
}
