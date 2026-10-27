import { describe, expect, it } from "vitest";
import { inboxHref, unreadTotal } from "@/lib/client/inbox";

const none = { comments: 0, mentions: 0, messages: 0, notifications: 0, follows: 0, digests: 0 };

describe("header envelope", () => {
  it("opens the comments tab for unread comments or mentions", () => {
    expect(inboxHref({ ...none, comments: 1, notifications: 1 })).toBe("/inbox/comments");
    expect(inboxHref({ ...none, mentions: 2, notifications: 2 })).toBe("/inbox/comments");
  });

  it("opens private messages when only messages are unread, comments win when both are", () => {
    expect(inboxHref({ ...none, messages: 3 })).toBe("/inbox/messages");
    expect(inboxHref({ ...none, messages: 3, comments: 1, notifications: 1 })).toBe("/inbox/comments");
  });

  it("falls back to the overview for follows, system notices and a missing session", () => {
    expect(inboxHref({ ...none, follows: 1, notifications: 1 })).toBe("/inbox/all");
    expect(inboxHref(none)).toBe("/inbox/all");
    expect(inboxHref(null)).toBe("/inbox/all");
  });

  it("counts messages plus notifications", () => {
    expect(unreadTotal({ ...none, messages: 2, notifications: 3 })).toBe(5);
    expect(unreadTotal(null)).toBe(0);
  });
});
