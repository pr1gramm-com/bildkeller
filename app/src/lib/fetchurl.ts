import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 20_000;

/** Loopback, link-local, private and carrier-grade NAT ranges must never be fetched. */
function isPrivate(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  const v = address.toLowerCase();
  if (v === "::1" || v === "::") return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true;
  if (v.startsWith("fe80")) return true;
  if (v.startsWith("::ffff:")) return isPrivate(v.slice(7));
  return false;
}

async function assertPublic(url: URL): Promise<void> {
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (addresses.length === 0) throw new Error("host not found");
  if (addresses.some((a) => isPrivate(a.address))) throw new Error("blocked host");
}

/**
 * Downloads a remote file for "oder URL angeben" uploads.
 * Redirects are followed manually so every hop is checked again (no redirect to an internal host).
 */
export async function fetchRemote(rawUrl: string, maxBytes: number): Promise<Buffer> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid url");
    await assertPublic(url);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("invalid redirect");
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new Error("fetch failed");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > maxBytes) throw new Error("too large");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new Error("too large");
    return buf;
  }
  throw new Error("too many redirects");
}
