import { beforeAll, describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET } from "@/app/media/[...path]/route";

const DIR = path.resolve(process.env.MEDIA_DIR ?? "./data/media");
const call = (segs: string[], headers: Record<string, string> = {}) =>
  GET(new NextRequest(`http://localhost:3000/media/${segs.join("/")}`, { headers }), {
    params: Promise.resolve({ path: segs }),
  });

beforeAll(async () => {
  await mkdir(path.join(DIR, "t"), { recursive: true });
  await writeFile(path.join(DIR, "t", "a.png"), Buffer.from("0123456789"));
  await writeFile(path.join(DIR, "..", "secret.txt"), "nope");
});

describe("/media", () => {
  it("serves a stored file with type and immutable caching", async () => {
    const res = await call(["t", "a.png"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("0123456789");
  });

  it("supports byte ranges (video seeking)", async () => {
    const res = await call(["t", "a.png"], { range: "bytes=2-4" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("234");
  });

  it("clamps a suffix range larger than the file", async () => {
    const res = await call(["t", "a.png"], { range: "bytes=-999999" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-9/10");
    const last = await call(["t", "a.png"], { range: "bytes=-4" });
    expect(Buffer.from(await last.arrayBuffer()).toString()).toBe("6789");
  });

  it("blocks path traversal", async () => {
    expect((await call(["..", "secret.txt"])).status).toBe(404);
    expect((await call(["t", "..", "..", "secret.txt"])).status).toBe(404);
  });

  it("404s on missing files and unknown types", async () => {
    expect((await call(["t", "missing.png"])).status).toBe(404);
  });
});
