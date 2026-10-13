import { eq } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";

export const DEFAULT_SETTINGS = {
  themeId: 0,
  layoutMode: "modern",
  arrowKeyMode: "legacy",
  contentMaxWidth: "auto",
  itemLayoutMode: "modern",
  blockedCommentMode: "collapse_subtree",
  showAds: false,
  favUpvote: false,
  legacyPath: false,
  enableItemHistory: false,
  markSeenItems: false,
  showSeenNav: false,
  showVideoPreview: true,
  enableVoteToggle: false,
  enableDailyDigest: false,
  enableWeeklyDigest: false,
  enableEmailNotifications: false,
  junkSeparation: false,
  collapseLongComments: false,
  hideDownvotedComments: false,
  autoCollapseDeepComments: false,
  sfwResetEnabled: false,
  defaultToNew: false,
  colorCommentIndentationLines: false,
  showBookmarkBar: true,
  showBlockActions: true,
  showAvatars: true,
  showThumbnailFlags: false,
} as const;

export type Settings = { -readonly [K in keyof typeof DEFAULT_SETTINGS]: (typeof DEFAULT_SETTINGS)[K] extends boolean ? boolean : (typeof DEFAULT_SETTINGS)[K] extends number ? number : string };

export async function getSettings(userId: number): Promise<Settings> {
  const row = (await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)).limit(1))[0];
  return { ...DEFAULT_SETTINGS, ...(row?.settings as object) } as Settings;
}

/** Applies only known keys, coercing the form string to the default's type. */
export async function updateSettings(userId: number, form: Record<string, string>): Promise<Settings> {
  const patch: Record<string, string | number | boolean> = {};
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const raw = form[key];
    if (raw === undefined) continue;
    if (typeof def === "boolean") patch[key] = raw === "1" || raw === "true";
    else if (typeof def === "number") patch[key] = Number(raw) || 0;
    else patch[key] = raw;
  }
  const next = { ...(await getSettings(userId)), ...patch };
  await db
    .insert(schema.userSettings)
    .values({ userId, settings: next })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: { settings: next } });
  return next;
}
