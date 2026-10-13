import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { handle, register } from "@/lib/api/router";
import { ok } from "@/lib/api/envelope";

function req(path: string, init?: RequestInit) {
  return new NextRequest(`http://localhost:3000${path}`, init);
}

describe("api dispatcher", () => {
  it("unknown endpoint returns HTTP 200 with error envelope", async () => {
    const res = await handle(req("/api/user/sync"), ["user", "sync"]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBe("unknown endpoint");
    expect(typeof json.ts).toBe("number");
    expect(typeof json.rt).toBe("number");
    expect(typeof json.qc).toBe("number");
  });

  it("registered handler receives query params and envelope wraps payload", async () => {
    register("test.echo", async (ctx) => ok({ ping: ctx.query.get("x") }));
    const res = await handle(req("/api/test/echo?x=1"), ["test", "echo"]);
    const json = await res.json();
    expect(json.ping).toBe("1");
    expect(json.cache).toBeNull();
    expect(json.error).toBeNull();
  });

  it("POST form-encoded body lands in ctx.form", async () => {
    register("test.post", async (ctx) => ok({ v: ctx.form.foo }));
    const res = await handle(
      req("/api/test/post", {
        method: "POST",
        body: new URLSearchParams({ foo: "bar" }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
      ["test", "post"],
    );
    expect((await res.json()).v).toBe("bar");
  });

  it("dot-name registration is reachable via slash path", async () => {
    register("test.de.dot", async () => ok({ ok: true }));
    const res = await handle(req("/api/test/de/dot"), ["test", "de", "dot"]);
    expect((await res.json()).ok).toBe(true);
  });
});
