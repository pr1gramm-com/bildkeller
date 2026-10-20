import { describe, expect, it } from "vitest";
import FeedPage from "@/components/FeedPage";

describe("server feed route decoding", () => {
  it("decodes route segments once before constructing API filters and links", async () => {
    const page = await FeedPage({ feed: "new", params: Promise.resolve({ segments: [encodeURIComponent("! demo ('original content' | oc)"), "42"] }) });
    expect(page.props.tags).toBe("! demo ('original content' | oc)");
    expect(page.props.base).toBe("/new/!%20demo%20('original%20content'%20%7C%20oc)");
    expect(page.props.startAt).toBe(42);
    const literal = await FeedPage({ feed: "top", params: Promise.resolve({ segments: [encodeURIComponent("'20%'")] }) });
    expect(literal.props.tags).toBe("'20%'");
  });
  it("rejects malformed percent encoding instead of rendering a broken search", async () => {
    await expect(FeedPage({ feed: "new", params: Promise.resolve({ segments: ["%ZZ"] }) })).rejects.toThrow();
  });
});
