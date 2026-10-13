import { and, eq, isNull, or, gt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import type { SessionUser } from "./types";

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
