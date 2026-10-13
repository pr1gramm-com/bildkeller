import { describe, expect, it } from "vitest";
import { parseTagQuery } from "@/lib/tagquery";

describe("parseTagQuery", () => {
  it("parses the verified pr0gramm query grammar", () => {
    expect(parseTagQuery("! katzen -\"video\" s:100")).toEqual({
      advanced: true,
      include: ["katzen"],
      exclude: [],
      score: 100,
      mediaExclude: ["video"],
      markExclude: [],
      user: null,
    });
  });

  it("parses exclusions without quotes", () => {
    const q = parseTagQuery("! katzen -hunde -katzenbilder");
    expect(q.exclude).toEqual(["hunde", "katzenbilder"]);
    expect(q.include).toEqual(["katzen"]);
  });

  it("parses mark exclusion and user filter", () => {
    const q = parseTagQuery("! -m:ftb süßvieh u:wonka");
    expect(q.markExclude).toEqual(["ftb"]);
    expect(q.include).toEqual(["süßvieh"]);
    expect(q.user).toBe("wonka");
  });

  it("plain query without ! is not advanced", () => {
    const q = parseTagQuery("katzen hund");
    expect(q.advanced).toBe(false);
    expect(q.include).toEqual(["katzen", "hund"]);
  });

  it("media exclusions can combine", () => {
    const q = parseTagQuery("! -\"sound\" -\"repost\"");
    expect(q.mediaExclude).toEqual(["sound", "repost"]);
  });

  it("unknown prefixes are ignored, not treated as tags", () => {
    const q = parseTagQuery("! katzen foo:bar");
    expect(q.include).toEqual(["katzen"]);
  });
});
