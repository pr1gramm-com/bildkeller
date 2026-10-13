import { sql } from "drizzle-orm";
import {
  bigint,
  primaryKey,
  bigserial,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const int = integer;
const big = bigint;

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    mark: int("mark").notNull().default(2),
    verified: boolean("verified").notNull().default(false),
    admin: boolean("admin").notNull().default(false),
    mod: boolean("mod").notNull().default(false),
    inviteId: int("invite_id"),
    bannedUntil: int("banned_until"),
    deleted: boolean("deleted").notNull().default(false),
    created: int("created").notNull(),
  },
  (t) => [uniqueIndex("users_name_lower_idx").on(sql`lower(${t.name})`)],
);

export const sessions = pgTable("sessions", {
  token: varchar("token", { length: 32 }).primaryKey(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  created: int("created").notNull(),
});

export const items = pgTable("items", {
  id: big("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  flags: int("flags").notNull(),
  image: text("image").notNull(),
  thumb: text("thumb").notNull(),
  fullsize: text("fullsize").notNull().default(""),
  preview: text("preview"),
  width: int("width").notNull(),
  height: int("height").notNull(),
  originalWidth: int("original_width").notNull(),
  originalHeight: int("original_height").notNull(),
  audio: boolean("audio").notNull().default(false),
  source: text("source").notNull().default(""),
  created: int("created").notNull(),
  promoted: int("promoted").notNull().default(0),
  junk: boolean("junk").notNull().default(false),
  repost: boolean("repost").notNull().default(false),
  deleted: boolean("deleted").notNull().default(false),
  key: text("key").notNull().unique(),
  dhash: text("dhash"),
  up: int("up").notNull().default(0),
  down: int("down").notNull().default(0),
});

export const comments = pgTable("comments", {
  id: big("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  itemId: big("item_id", { mode: "number" }).notNull(),
  parentId: big("parent_id", { mode: "number" }).notNull().default(0),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  created: int("created").notNull(),
  editedAt: int("edited_at"),
  editCount: int("edit_count").notNull().default(0),
  up: int("up").notNull().default(0),
  down: int("down").notNull().default(0),
  deleted: boolean("deleted").notNull().default(false),
});

export const votes = pgTable(
  "votes",
  {
    id: big("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
    itemId: big("item_id", { mode: "number" }),
    commentId: big("comment_id", { mode: "number" }),
    up: boolean("up").notNull(),
    created: int("created").notNull(),
  },
  (t) => [
    uniqueIndex("votes_user_item_uq")
      .on(t.userId, t.itemId)
      .where(sql`item_id is not null`),
    uniqueIndex("votes_user_comment_uq")
      .on(t.userId, t.commentId)
      .where(sql`comment_id is not null`),
  ],
);

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  tag: text("tag").notNull().unique(),
});

export const itemTags = pgTable(
  "item_tags",
  {
    itemId: big("item_id", { mode: "number" }).notNull(),
    tagId: int("tag_id")
      .notNull()
      .references(() => tags.id),
    up: int("up").notNull().default(0),
    down: int("down").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.tagId] })],
);

export const itemTagVotes = pgTable(
  "item_tag_votes",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
    itemId: big("item_id", { mode: "number" }).notNull(),
    tagId: int("tag_id")
      .notNull()
      .references(() => tags.id),
    up: boolean("up").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId, t.tagId] })],
);

export const commentEdits = pgTable("comment_edits", {
  id: serial("id").primaryKey(),
  commentId: big("comment_id", { mode: "number" }).notNull(),
  content: text("content").notNull(),
  edited: int("edited").notNull(),
});

export const commentFavorites = pgTable(
  "comment_favorites",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
    commentId: big("comment_id", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] })],
);

export const itemViews = pgTable(
  "item_views",
  {
    itemId: big("item_id", { mode: "number" }).notNull(),
    day: int("day").notNull(),
    count: int("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.day] })],
);

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  isDefault: boolean("is_default").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(true),
  created: int("created").notNull(),
});

export const collectionItems = pgTable(
  "collection_items",
  {
    collectionId: int("collection_id")
      .notNull()
      .references(() => collections.id),
    itemId: big("item_id", { mode: "number" }).notNull(),
    added: int("added").notNull(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.itemId] })],
);

export const collectionCurators = pgTable(
  "collection_curators",
  {
    collectionId: int("collection_id")
      .notNull()
      .references(() => collections.id),
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.userId] })],
);

export const follows = pgTable(
  "follows",
  {
    followerId: int("follower_id")
      .notNull()
      .references(() => users.id),
    followeeId: int("followee_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] })],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
    collectionId: int("collection_id")
      .notNull()
      .references(() => collections.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.collectionId] })],
);

export const messages = pgTable("messages", {
  id: big("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  fromId: int("from_id")
    .notNull()
    .references(() => users.id),
  toId: int("to_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  created: int("created").notNull(),
  read: boolean("read").notNull().default(false),
});

export const notifications = pgTable("notifications", {
  id: big("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(), // mention | comment | follow
  refId: big("ref_id", { mode: "number" }).notNull().default(0),
  created: int("created").notNull(),
  read: boolean("read").notNull().default(false),
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
    itemId: big("item_id", { mode: "number" }).notNull(),
    created: int("created").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

export const blocks = pgTable(
  "blocks",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
    blockedUserId: int("blocked_user_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.blockedUserId] })],
);

export const blockedTags = pgTable(
  "blocked_tags",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
    tagId: int("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tagId] })],
);

export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  createdBy: int("created_by")
    .notNull()
    .references(() => users.id),
  usedBy: int("used_by"),
  created: int("created").notNull(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  itemId: big("item_id", { mode: "number" }),
  commentId: big("comment_id", { mode: "number" }),
  reason: text("reason").notNull(),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("open"),
  created: int("created").notNull(),
});

export const bans = pgTable("bans", {
  id: serial("id").primaryKey(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  until: int("until"), // null = permanent
  createdBy: int("created_by").notNull(),
  created: int("created").notNull(),
});

export const syncLog = pgTable("sync_log", {
  id: big("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  created: int("created").notNull(),
});

export const userSettings = pgTable("user_settings", {
  userId: int("user_id")
    .primaryKey()
    .references(() => users.id),
  settings: jsonb("settings").notNull(),
});

export const siteConfig = pgTable("site_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/** Phase-1 upload staging: media stored under `key`, promoted to an item via items.post. */
export const uploads = pgTable("uploads", {
  key: text("key").primaryKey(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  image: text("image").notNull(),
  thumb: text("thumb").notNull(),
  fullsize: text("fullsize").notNull().default(""),
  width: int("width").notNull(),
  height: int("height").notNull(),
  originalWidth: int("original_width").notNull(),
  originalHeight: int("original_height").notNull(),
  audio: boolean("audio").notNull().default(false),
  dhash: text("dhash").notNull(),
  created: int("created").notNull(),
});
