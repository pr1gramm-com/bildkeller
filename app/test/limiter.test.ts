import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clientIp } from "@/lib/limiter";

const req = (headers: Record<string, string>) => new NextRequest("http://localhost:3000/api/items/get", { headers });
afterEach(() => vi.unstubAllEnvs());

describe("clientIp", () => {
  it("ignores CF-Connecting-IP unless TRUST_CF_IP=1", () => {
    const h = { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "10.0.0.1, 172.18.0.2" };
    expect(clientIp(req(h))).toBe("10.0.0.1");
    vi.stubEnv("TRUST_CF_IP", "1");
    expect(clientIp(req(h))).toBe("203.0.113.7");
  });
  it("rejects a CF-Connecting-IP that is not an IP address", () => {
    vi.stubEnv("TRUST_CF_IP", "1");
    expect(clientIp(req({ "cf-connecting-ip": "not-an-ip", "x-forwarded-for": "198.51.100.4" }))).toBe("198.51.100.4");
  });
  it("falls back to X-Real-IP, then local", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
    expect(clientIp(req({}))).toBe("local");
  });
});
