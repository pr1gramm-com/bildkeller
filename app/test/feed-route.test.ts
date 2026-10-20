import { describe, expect, it } from "vitest";
import { contextRoute, feedPath, feedRoute, itemHref, itemIdFromPath, searchHref } from "@/lib/feed-route";

describe("reference feed URLs", () => {
  it("distinguishes numeric searches from item IDs and handles malformed encodings", () => {
    expect(feedPath(searchHref("new", "2026"))?.tags).toBe("'2026'");
    expect(itemIdFromPath(searchHref("new", "2026"))).toBeNull();
    expect(feedPath("/new/%ZZ")).toBeNull();
  });
  it("retains feed and multiword search across opening and reloading", () => {
    const route = feedRoute("top", ["! 'original content' | oc", "123"]);
    expect(route).toEqual({ base: "/top/!%20'original%20content'%20%7C%20oc", tags: "! 'original content' | oc", startAt: 123 });
    expect(itemIdFromPath(itemHref(route!.base, 456))).toBe(456);
  });
  it("supports plain feeds and existing item links", () => {
    expect(feedRoute("new")).toEqual({ base: "/new", tags: "", startAt: undefined });
    expect(feedRoute("junk", ["42"])?.startAt).toBe(42);
    expect(itemIdFromPath("/item/42")).toBe(42);
    expect(itemIdFromPath("/user/42")).toBeNull();
    expect(itemHref("/stalk", 42)).toBe("/stalk/42");
    expect(feedRoute("top", ["42:comment123"])?.startAt).toBe(42);
    expect(itemIdFromPath("/top/tag/42:comment123")).toBe(42);
  });
  it("rejects malformed route shapes and unsafe IDs", () => {
    expect(feedRoute("top", ["tag", "other"])).toBeNull();
    expect(feedRoute("top", ["0"])).toBeNull();
    expect(feedRoute("top", ["9007199254740992"])).toBeNull();
    expect(feedRoute("top", ["a", "b", "1"])).toBeNull();
  });
});

describe("personal feed contexts", () => {
  it("preserves upload, collection and history context in item and comment links", () => {
    for (const base of ["/user/alice/uploads", "/user/alice/collections/3", "/seen", "/stalk", "/chronicle"]) {
      const href = itemHref(base, 42);
      expect(href).toBe(`${base}/42`);
      expect(itemIdFromPath(`${href}:comment9`)).toBe(42);
      expect(contextRoute(base, ["42:comment9"])).toEqual({ base, startAt: 42 });
    }
    expect(contextRoute("/seen", ["0"])).toBeNull();
    expect(contextRoute("/seen", ["42", "43"])).toBeNull();
    expect(contextRoute("/seen", ["42%3Acomment9"])?.startAt).toBe(42);
    expect(contextRoute("/seen", ["%ZZ"])).toBeNull();
  });
});
