import { readFile, stat } from "node:fs/promises";
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const root = path.resolve(process.env.MEDIA_DIR ?? "./data/media");
  const { path: segs } = await params;
  const full = path.resolve(root, ...segs);
  const type = TYPES[path.extname(full).slice(1).toLowerCase()];
  if (!full.startsWith(root + path.sep) || !type) return new Response("not found", { status: 404 });

  try {
    const size = (await stat(full)).size;
    const buf = await readFile(full);
    const headers = {
      "content-type": type,
      "cache-control": "public, max-age=31536000, immutable",
      "accept-ranges": "bytes",
    };
    const m = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
    if (m && (m[1] || m[2])) {
      const start = m[1] ? Number(m[1]) : size - Number(m[2]);
      const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start > end || start >= size) return new Response(null, { status: 416 });
      return new Response(new Uint8Array(buf.subarray(start, end + 1)), {
        status: 206,
        headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
      });
    }
    return new Response(new Uint8Array(buf), { headers: { ...headers, "content-length": String(size) } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
