import { describe, expect, it } from "vitest";
import { parseTagQuery } from "@/lib/tagquery";

describe("parseTagQuery", () => {
  it("parses the reference query grammar", () => {
    expect(parseTagQuery("! katzen -\"video\" s:100")).toEqual({
      advanced: true,
      groups: [
        [
          { kind: "tag", value: "katzen", exact: true, exclude: false },
          { kind: "media", value: "video" },
          { kind: "score", value: 100, exclude: false },
        ],
      ],
    });
  });

  it("parses exclusions without quotes", () => {
    const q = parseTagQuery("! katzen -hunde -katzenbilder");
    expect(q.groups[0]).toEqual([
      { kind: "tag", value: "katzen", exact: true, exclude: false },
      { kind: "tag", value: "hunde", exact: true, exclude: true },
      { kind: "tag", value: "katzenbilder", exact: true, exclude: true },
    ]);
  });

  it("parses mark exclusion and user filter", () => {
    const q = parseTagQuery("! -m:3 süßvieh u:wonka");
    expect(q.groups[0]).toEqual([
      { kind: "mark", value: 3, exclude: true },
      { kind: "tag", value: "süßvieh", exact: true, exclude: false },
      { kind: "user", value: "wonka", exclude: false },
    ]);
  });

  it("plain query without ! is not advanced", () => {
    const q = parseTagQuery("katzen hund");
    expect(q.advanced).toBe(false);
    expect(q.groups[0]).toHaveLength(2);
  });

  it("media exclusions can combine", () => {
    const q = parseTagQuery("! -\"sound\" -\"repost\"");
    expect(q.groups[0]).toEqual([
      { kind: "media", value: "sound" },
      { kind: "media", value: "repost" },
    ]);
  });

  it("unknown prefixes are ignored, not treated as tags", () => {
    const q = parseTagQuery("! katzen foo:bar");
    expect(q.groups[0]).toEqual([{ kind: "tag", value: "katzen", exact: true, exclude: false }]);
  });

  it("splits OR groups and keeps partial tags", () => {
    const q = parseTagQuery("! katze | ~hund s:5");
    expect(q.groups).toHaveLength(2);
    expect(q.groups[0]).toEqual([{ kind: "tag", value: "katze", exact: true, exclude: false }]);
    expect(q.groups[1]).toEqual([
      { kind: "tag", value: "hund", exact: false, exclude: false },
      { kind: "score", value: 5, exclude: false },
    ]);
  });

  it("parses date ranges and resolutions", () => {
    const q = parseTagQuery("! d:2024-01-01..2024-12-31 r:1920x1080");
    expect(q.groups[0]).toEqual([
      { kind: "date", from: 1704067200, to: 1735689599, exclude: false },
      { kind: "res", width: 1920, height: 1080, exclude: false },
    ]);
  });
});
