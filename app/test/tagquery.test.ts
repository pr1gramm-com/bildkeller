import { describe, expect, it } from "vitest";
import { parseTagQuery } from "@/lib/tagquery";

describe("parseTagQuery", () => {
  it("keeps apostrophes within unquoted words", () => {
    expect(parseTagQuery("it's -don't").groups[0]).toEqual([
      { kind: "tag", value: "it's", exact: true, exclude: false },
      { kind: "tag", value: "don't", exact: true, exclude: true },
    ]);
  });
  it("keeps multiword tags and parses adjacent OR separators", () => {
    expect(parseTagQuery("! 'original content'|oc -'selbst gemalt'").groups).toEqual([
      [{ kind: "tag", value: "original content", exact: true, exclude: false }],
      [{ kind: "tag", value: "oc", exact: true, exclude: false }, { kind: "tag", value: "selbst gemalt", exact: true, exclude: true }],
    ]);
  });

  it("keeps quoted punctuation literal and supports partial multiword tags", () => {
    expect(parseTagQuery("~'original content' 'a|b' 'it\\'s fine'").groups[0]).toEqual([
      { kind: "tag", value: "original content", exact: false, exclude: false },
      { kind: "tag", value: "a|b", exact: true, exclude: false },
      { kind: "tag", value: "it's fine", exact: true, exclude: false },
    ]);
  });
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

describe("grouped tag queries", () => {
  it("keeps OR groups inside surrounding AND terms and allows negated groups", () => {
    const query = parseTagQuery("! nsfw ('original content'|oc) -(spam|repost)");
    expect(query.invalid).toBeUndefined();
    expect(query.expression).toMatchObject({ type: "and", children: [
      { type: "term", term: { kind: "tag", value: "nsfw" } },
      { type: "or", children: [{ type: "term", term: { value: "original content" } }, { type: "term", term: { value: "oc" } }] },
      { type: "not", child: { type: "or" } },
    ] });
  });
  it("keeps quoted parentheses literal and rejects incomplete or excessive nesting", () => {
    expect(parseTagQuery("'tag (literal)'").groups[0][0]).toMatchObject({ value: "tag (literal)" });
    for (const value of ["(tag", "tag)", "()", "(tag|)", "(".repeat(18) + "tag" + ")".repeat(18)]) expect(parseTagQuery(value).invalid).toBe(true);
  });
  it("recognizes the reference seeded random link", () => {
    expect(parseTagQuery("!-(x:random | x:1792521169)")).toEqual({ advanced: true, groups: [], randomSeed: "1792521169" });
  });
});
