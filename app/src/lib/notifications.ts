import { sql, type SQL } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { effectiveFlags } from "./flags";
import type { SessionUser } from "./types";

export async function notify(userId: number, type: "mention" | "comment" | "follow", refId: number, actorId: number): Promise<void> {
  if (userId === actorId) return;
  await db.execute(sql`insert into ${schema.notifications} (user_id, type, ref_id, created)
    select ${userId}, ${type}, ${refId}, ${Math.floor(Date.now() / 1000)}
    where exists (select 1 from users u where u.id = ${userId} and not u.deleted)
    and not exists (select 1 from blocks b where b.user_id = ${userId} and b.blocked_user_id = ${actorId})`);
}

/** Notification lists and badges must apply the same current visibility rules. */
export function notificationVisible(user: SessionUser): SQL {
  return sql`(${schema.notifications.type} = 'system'
    or (${schema.notifications.type} = 'follow' and exists (
      select 1 from users actor where actor.id = ${schema.notifications.refId} and not actor.deleted
      and not exists (select 1 from blocks b where b.user_id = ${user.userId} and b.blocked_user_id = actor.id)))
    or (${schema.notifications.type} in ('comment', 'mention') and exists (
      select 1 from comments c join items i on i.id = c.item_id
      where c.id = ${schema.notifications.refId} and not c.deleted and not i.deleted
      and (i.flags & ${effectiveFlags(user, 31)}) != 0
      and not exists (select 1 from blocks b where b.user_id = ${user.userId} and b.blocked_user_id = c.user_id))))`;
}
