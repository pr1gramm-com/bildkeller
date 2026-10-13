import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/envelope";

type Bucket = { count: number; reset: number };
// shortcut: in-memory, per process. Fine for one instance; use Redis/Postgres counters when scaling out.
const buckets = new Map<string, Bucket>();

/** Throws ApiError("rate limited") once `key` exceeds `max` hits within `windowSec`. */
export function limit(key: string, max: number, windowSec: number): void {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowSec * 1000 });
    return;
  }
  b.count += 1;
  if (b.count > max) throw new ApiError("rate limited");
}

export function resetLimits(): void {
  buckets.clear();
}

/** Client IP; trusts the first X-Forwarded-For entry, so run behind a proxy that sets it. */
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
