import type { NextRequest } from "next/server";
import { ApiError, fail, json, type ApiPayload } from "./envelope";
import type { ApiCtx, ApiHandler } from "@/lib/types";
import { getSessionUser } from "@/lib/auth";

const handlers = new Map<string, ApiHandler>();

export function register(name: string, handler: ApiHandler): void {
  // Client-facing names use dot notation ("items.get"); routes are slash paths.
  handlers.set(name.replaceAll(".", "/"), handler);
}

async function parseForm(req: NextRequest): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return {};
    return Object.fromEntries(Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
  }
  if (type.includes("multipart/form-data")) {
    const fd = await req.formData();
    return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  }
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

export async function handle(req: NextRequest, path: string[]): Promise<Response> {
  const handler = handlers.get(path.join("/"));
  if (!handler) return json(fail("unknown endpoint"));

  const ctx: ApiCtx = { user: null, query: new URL(req.url).searchParams, form: {}, req, outCookies: [] };
  let payload: ApiPayload;
  try {
    ctx.user = await getSessionUser(req);
    if (req.method === "POST") ctx.form = await parseForm(req);
    payload = await handler(ctx);
  } catch (e) {
    // Only ApiError messages are meant for clients; DB/runtime errors stay in the server log.
    if (!(e instanceof ApiError)) console.error(`[api] ${path.join("/")}:`, e);
    payload = fail(e instanceof ApiError ? e.message : "error");
  }
  const res = json(payload);
  const secure = req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
  for (const c of ctx.outCookies) {
    res.headers.append(
      "set-cookie",
      `${c.name}=${c.value}; Path=/; Max-Age=${c.maxAge ?? 315360000}; SameSite=Lax${secure ? "; Secure" : ""}`,
    );
  }
  return res;
}
