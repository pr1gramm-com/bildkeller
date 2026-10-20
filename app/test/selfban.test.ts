import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { createSession, hashPassword, hasActiveBan } from "@/lib/auth";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createTestUser, cookieFor } from "./helpers";

let owner = 0, token = "", second = "";
const name = "selfban-parity-owner", password = "selfban-test-password";
beforeAll(async () => {
  owner = (await createTestUser(name)).id;
  await db.update(schema.users).set({ passwordHash: await hashPassword(password) }).where(eq(schema.users.id, owner));
  token = await createSession(owner); second = await createSession(owner);
});
async function post(path: string, values: Record<string, string>) {
  return (await handle(new NextRequest(`http://localhost/api/${path}`, { method: "POST", body: new URLSearchParams({ _nonce: token.slice(0, 16), ...values }), headers: { ...cookieFor(token), "content-type": "application/x-www-form-urlencoded" } }), path.split("/"))).json();
}
async function validate(session: string) {
  return (await handle(new NextRequest("http://localhost/api/user/validate", { headers: cookieFor(session) }), ["user", "validate"])).json();
}
describe("self-imposed account bans", () => {
  it("requires the password and a whole number of days within the allowed range", async () => {
    expect((await post("user/selfban", { days: "1", password: "wrong" })).error).toBe("invalid credentials");
    for (const days of ["0", "0.5", "181", "NaN"]) expect((await post("user/selfban", { days, password })).error).toBe("invalid");
    expect((await validate(token)).error).toBeNull();
  });
  it("ends every session and rejects new logins until the ban expires", async () => {
    const result = await post("user/selfban", { days: "1", password });
    expect(result.error).toBeNull(); expect(result.until).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(await hasActiveBan(owner)).toBe(true);
    expect((await validate(token)).error).toBe("not logged in");
    expect((await validate(second)).error).toBe("not logged in");
    expect((await post("user/login", { name, password })).error).toBe("banned");
  });
  it("allows login again after the stored expiry", async () => {
    await db.update(schema.users).set({ inactiveUntil: Math.floor(Date.now() / 1000) - 1 }).where(eq(schema.users.id, owner));
    expect(await hasActiveBan(owner)).toBe(false);
    expect((await post("user/login", { name, password })).error).toBeNull();
  });
});
