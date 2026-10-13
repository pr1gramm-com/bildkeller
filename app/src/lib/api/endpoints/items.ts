import { and, asc, desc, eq, gt, lt, sql, notInArray } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { ok } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import type { ApiCtx, SessionUser } from "@/lib/types";
import { effectiveFlags } from "@/lib/flags";

export type ApiItem = {
  id: number;
  promoted: number;
  userId: number;
  up: number;
  down: number;
  created: number;
  image: string;
  thumb: string;
  fullsize: string;
  preview: string | null;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  audio: boolean;
  source: string;
  flags: number;
  user: string;
  mark: number;
  repost: boolean;
  variants: unknown[];
};

type JoinedItemRow = {
  item: typeof schema.items.$inferSelect;
  userName: string;
  userMark: number;
};

export function toItem(row: JoinedItemRow): ApiItem {
  const it = row.item;
  return {
    id: it.id,
    promoted: it.promoted,
    userId: it.userId,
    up: it.up,
    down: it.down,
    created: it.created,
    image: it.image,
    thumb: it.thumb,
    fullsize: it.fullsize,
    preview: it.preview,
    width: it.width,
    height: it.height,
    originalWidth: it.originalWidth,
    originalHeight: it.originalHeight,
    audio: it.audio,
    source: it.source,
    flags: it.flags,
    user: row.userName,
    mark: row.userMark,
    repost: it.repost,
    variants: [],
  };
}

export async function blockedUserIds(user: SessionUser | null): Promise<number[]> {
  if (!user) return [];
  const rows = await db
    .select({ id: schema.blocks.blockedUserId })
    .from(schema.blocks)
    .where(eq(schema.blocks.userId, user.userId));
  return rows.map((r) => r.id);
}

const PAGE = 50;

export async function itemsGet(ctx: ApiCtx) {  const user = ctx.user;
  const flags = effectiveFlags(user, Number(ctx.query.get("flags") ?? 31) || 31);
  const promoted = Number(ctx.query.get("promoted") ?? 0);
  const showJunk = ctx.query.get("show_junk") === "1";
  const older = Number(ctx.query.get("older") ?? 0);
  const userName = ctx.query.get("user");

  const conds = [
    eq(schema.items.deleted, false),
    sql`(${schema.items.flags} & ${flags}) != 0`,
  ];
  if (!showJunk) conds.push(eq(schema.items.junk, false));
  if (promoted === 1) conds.push(gt(schema.items.promoted, 0));
  if (older > 0) conds.push(lt(schema.items.id, older));
  if (userName) conds.push(sql`lower(${schema.users.name}) = ${userName.toLowerCase()}`);
  const blocked = await blockedUserIds(user);
  if (blocked.length > 0) conds.push(notInArray(schema.items.userId, blocked));

  const rows = await db
    .select({
      item: schema.items,
      userName: schema.users.name,
      userMark: schema.users.mark,
    })
    .from(schema.items)
    .innerJoin(schema.users, eq(schema.users.id, schema.items.userId))
    .where(and(...conds))
    .orderBy(
      ...(promoted === 1 ? [desc(schema.items.promoted), desc(schema.items.id)] : [desc(schema.items.id)]),
    )
    .limit(PAGE + 1);

  const page = rows.slice(0, PAGE);
  return ok({
    items: page.map(toItem),
    atStart: older === 0,
    atEnd: rows.length <= PAGE,
  });
}

export async function requireUser(ctx: ApiCtx): Promise<SessionUser> {
  if (!ctx.user) throw new Error("not logged in");
  return ctx.user;
}

register("items.get", itemsGet);
