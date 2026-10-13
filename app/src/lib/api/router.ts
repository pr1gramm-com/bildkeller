import type { NextRequest } from "next/server";
import { fail, json, type ApiPayload } from "./envelope";
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
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)]));
  }
  if (type.includes("multipart/form-data")) {
    const fd = await req.formData();
    return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  }
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

export async function handle(req: NextRequest, path: string[]): Promise<Response> {
  const name = path.join("/");
  const handler = handlers.get(name);
  if (!handler) {
    return json(fail("unknown endpoint"));
  }
  const url = new URL(req.url);
  const ctx: ApiCtx = {
    user: await getSessionUser(req),
    query: url.searchParams,
    form: req.method === "POST" ? await parseForm(req) : {},
    req,
  };
  let payload: ApiPayload;
  try {
    payload = await handler(ctx);
  } catch (e) {
    payload = fail(e instanceof Error ? e.message : "error");
  }
  return json(payload);
}
