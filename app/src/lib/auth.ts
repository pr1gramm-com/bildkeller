import { ApiError } from "@/lib/api/envelope";
import { and, eq, or, gt, sql } from "drizzle-orm";
import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import type { ApiCtx, SessionUser } from "./types";

const ME_COOKIE = "me";
const SESSION_TTL = 365 * 86400; // sessions expire after a year

type MeMap = Record<string, string>;

export function parseMeCookie(value: string | undefined): MeMap {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? (parsed as MeMap) : {};
  } catch {
    return {};
  }
}

export function encodeMeCookie(map: MeMap): string {
  return Buffer.from(JSON.stringify(map), "utf8").toString("base64url");
}

export async function hasActiveBan(userId: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, userId),
        or(gt(schema.users.inactiveUntil, now), sql`exists (
          select 1 from ${schema.bans} where ${schema.bans.userId} = ${schema.users.id}
          and (${schema.bans.until} is null or ${schema.bans.until} > ${now})
        )`),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const map = parseMeCookie(req.cookies.get(ME_COOKIE)?.value);
  const token = map.id;
  if (!token || token.length !== 32) return null;

  const oldest = Math.floor(Date.now() / 1000) - SESSION_TTL;
  const rows = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.token, token), gt(schema.sessions.created, oldest)))
    .limit(1);
  const row = rows[0];
  if (!row || row.user.deleted) return null;
  if (await hasActiveBan(row.user.id)) return null;

  return {
    id: token,
    userId: row.user.id,
    name: row.user.name,
    mark: row.user.mark,
    verified: row.user.verified,
    admin: row.user.admin,
    mod: row.user.mod,
    flags: 1,
  };
}

export { ME_COOKIE };

const TEN_YEARS = 315360000;

// OWASP-recommended argon2id parameters (19 MiB, 2 passes).
export function hashPassword(password: string): Promise<string> {
  return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

let dummyHash: Promise<string> | undefined;
/** Burns the same time as a real check so unknown usernames are not distinguishable by latency. */
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("bildkeller-dummy");
  await verify(await dummyHash, password).catch(() => false);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return verify(hash, password);
}

export function newToken(): string {
  return randomBytes(16).toString("hex");
}

export async function createSession(userId: number): Promise<string> {
  const token = newToken();
  await db.insert(schema.sessions).values({
    token,
    userId,
    created: Math.floor(Date.now() / 1000),
  });
  return token;
}

export function meMap(
  user: { id: string; name: string; mark: number; verified: boolean; admin: boolean; mod?: boolean },
  extra: Record<string, string> = {},
): MeMap {
  return {
    id: user.id,
    n: user.name,
    m: String(user.mark),
    v: user.verified ? "1" : "0",
    a: user.admin || user.mod ? "1" : "0",
    ...extra,
  };
}

export function setMeCookie(
  ctx: Pick<ApiCtx, "outCookies">,
  user: { id: string; name: string; mark: number; verified: boolean; admin: boolean },
): void {
  ctx.outCookies.push({ name: ME_COOKIE, value: encodeMeCookie(meMap(user)), maxAge: TEN_YEARS });
}

/** CSRF: every logged-in POST must carry _nonce = first 16 chars of the session token. */
export function assertNonce(ctx: Pick<ApiCtx, "form">, user: SessionUser): void {
  if (ctx.form._nonce !== user.id.slice(0, 16)) {
    throw new ApiError("csrf");
  }
}
