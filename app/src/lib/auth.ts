import { and, eq, isNull, or, gt } from "drizzle-orm";
import { hashSync, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import type { ApiCtx, SessionUser } from "./types";

const ME_COOKIE = "me";

type MeMap = Record<string, string>;

export function parseMeCookie(value: string | undefined): MeMap {
  if (!value) return {};
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    return JSON.parse(json) as MeMap;
  } catch {
    return {};
  }
}

export function encodeMeCookie(map: MeMap): string {
  return Buffer.from(JSON.stringify(map), "utf8").toString("base64url");
}

async function hasActiveBan(userId: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({ id: schema.bans.id })
    .from(schema.bans)
    .where(
      and(
        eq(schema.bans.userId, userId),
        or(isNull(schema.bans.until), gt(schema.bans.until, now)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const map = parseMeCookie(req.cookies.get(ME_COOKIE)?.value);
  const token = map.id;
  if (!token || token.length !== 32) return null;

  const rows = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.token, token))
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

export function hashPassword(password: string): string {
  return hashSync(password);
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
    throw new Error("csrf");
  }
}
