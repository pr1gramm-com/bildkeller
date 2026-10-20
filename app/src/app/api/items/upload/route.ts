import { NextRequest, NextResponse } from "next/server";
import { ok, fail } from "@/lib/api/envelope";
import { getSessionUser } from "@/lib/auth";
import { fetchRemote } from "@/lib/fetchurl";
import { storeUpload } from "@/lib/media";
import { purgeStaleUploads, uploadQuota } from "@/lib/ratelimit";
import { limitedForm } from "@/lib/limited-form";
import { ApiError } from "@/lib/api/envelope";

/** Phase 1 of the upload flow: store media, return a staging key. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json(fail("not logged in"));

  await purgeStaleUploads();
  const left = await uploadQuota(user.userId);
  if (left <= 0) return NextResponse.json({ ...fail("ratelimited"), left: 0 });

  const max = Number(process.env.MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024);
  let form: FormData | null;
  try { form = await limitedForm(req, max + 64 * 1024); }
  catch (e) { return NextResponse.json(fail(e instanceof ApiError ? e.message : "invalid request")); }
  const file = form?.get("image");
  const remoteUrl = typeof form?.get("url") === "string" ? String(form.get("url")) : "";
  let buf: Buffer;
  if (remoteUrl) {
    try {
      buf = await fetchRemote(remoteUrl, max);
    } catch {
      return NextResponse.json(fail("invalid url"));
    }
  } else {
    if (!(file instanceof File)) return NextResponse.json(fail("no file"));
    if (file.size > max) return NextResponse.json(fail("too large"));
    buf = Buffer.from(await file.arrayBuffer());
  }
  try {
    const media = await storeUpload(buf);
    const { db, schema } = await import("@bildkeller/db");
    await db.insert(schema.uploads).values({
      key: media.key,
      userId: user.userId,
      image: media.image,
      thumb: media.thumb,
      fullsize: media.fullsize,
      width: media.width,
      height: media.height,
      originalWidth: media.originalWidth,
      originalHeight: media.originalHeight,
      audio: media.audio,
      dhash: media.dhash,
      created: Math.floor(Date.now() / 1000),
    });
    return NextResponse.json(ok({ key: media.key }));
  } catch {
    return NextResponse.json(fail("invalid"));
  }
}
