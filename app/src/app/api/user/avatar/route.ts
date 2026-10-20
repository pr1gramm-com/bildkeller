import type { NextRequest } from "next/server";
import { assertNonce, getSessionUser } from "@/lib/auth";
import { ApiError, fail, json, ok } from "@/lib/api/envelope";
import { MAX_AVATAR_BYTES, storeAvatar } from "@/lib/avatar";
import { changeSettings } from "@/lib/settings";
import { limit } from "@/lib/limiter";
import { limitedForm } from "@/lib/limited-form";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return json(fail("not logged in"));
    limit(`avatar:${user.userId}`, 20, 60);
    const form = await limitedForm(req, MAX_AVATAR_BYTES + 65536);
    assertNonce({ form: { _nonce: String(form?.get("_nonce") ?? "") } }, user);
    let avatar = "";
    if (form?.get("remove") !== "1") {
      const file = form?.get("image");
      if (!(file instanceof File) || file.size > MAX_AVATAR_BYTES) return json(fail("invalid avatar"));
      try {
        avatar = await storeAvatar(Buffer.from(await file.arrayBuffer()), Number(form?.get("x") ?? 50), Number(form?.get("y") ?? 50), Number(form?.get("zoom") ?? 1));
      } catch { return json(fail("invalid avatar")); }
    }
    return json(ok({ settings: await changeSettings(user.userId, (current) => ({ ...current, avatar })) }));
  } catch (e) {
    if (!(e instanceof ApiError)) console.error("[api] user/avatar:", e);
    return json(fail(e instanceof ApiError ? e.message : "error"));
  }
}
