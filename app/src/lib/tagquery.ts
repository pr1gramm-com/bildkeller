export type MediaExclude = "sound" | "video" | "repost";

export type Term =
  | { kind: "tag"; value: string; exact: boolean; exclude: boolean }
  | { kind: "user"; value: string; exclude: boolean }
  | { kind: "score"; value: number; exclude: boolean }
  | { kind: "mark"; value: number; exclude: boolean }
  | { kind: "date"; from: number | null; to: number | null; exclude: boolean }
  | { kind: "res"; width: number; height: number; exclude: boolean }
  | { kind: "media"; value: MediaExclude };

export type TagQuery = {
  advanced: boolean;
  /** OR of AND-groups: groups are separated by "|", terms inside a group are ANDed. */
  groups: Term[][];
};

/** The reference board's query grammar:
 * `! tag -tag ~tag -"video" s:100 -s:50 u:name -u:other m:3 r:1920x1080 d:2024-01-01..2024-12-31`
 */
export function parseTagQuery(q: string): TagQuery {
  const groups: Term[][] = [[]];
  let advanced = false;

  const push = (t: Term) => groups[groups.length - 1].push(t);
  // Quoted multiword tags and OR separators without surrounding spaces occur in saved reference feeds.
  const tokens = q.match(/-?~?(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')(?=\s|\||$)|[^\s|]+|\|/g) ?? [];
  for (const raw of tokens) {
    if (raw === "!") {
      advanced = true;
      continue;
    }
    if (raw === "|") {
      groups.push([]);
      continue;
    }
    const exclude = raw.startsWith("-");
    const body = exclude ? raw.slice(1) : raw;

    const quoted = body.match(/^"(.+)"$/);
    if (quoted && ["sound", "video", "repost"].includes(quoted[1])) {
      push({ kind: "media", value: quoted[1] as MediaExclude });
      continue;
    }
    const tagBody = body.startsWith("~") ? body.slice(1) : body;
    const quotedTag = tagBody.match(/^(['"])([\s\S]*)\1$/);
    if (quotedTag) {
      const value = quotedTag[2].replace(/\\(.)/g, "$1").toLowerCase();
      if (value) push({ kind: "tag", value, exact: !body.startsWith("~"), exclude });
      continue;
    }
    const score = body.match(/^s:(\d+)$/);
    if (score) {
      push({ kind: "score", value: Number(score[1]), exclude });
      continue;
    }
    const mark = body.match(/^m:(\d+)$/);
    if (mark) {
      push({ kind: "mark", value: Number(mark[1]), exclude });
      continue;
    }
    const res = body.match(/^r:(\d+)x(\d+)$/);
    if (res) {
      push({ kind: "res", width: Number(res[1]), height: Number(res[2]), exclude });
      continue;
    }
    const date = body.match(/^d:(\d{4}-\d{2}-\d{2})(?:\.\.(\d{4}-\d{2}-\d{2}))?$/);
    if (date) {
      const from = Date.parse(`${date[1]}T00:00:00Z`) / 1000;
      const to = date[2] ? Date.parse(`${date[2]}T23:59:59Z`) / 1000 : null;
      push({ kind: "date", from, to, exclude });
      continue;
    }
    const user = body.match(/^u:(.+)$/);
    if (user) {
      push({ kind: "user", value: user[1].trim(), exclude });
      continue;
    }
    if (body.includes(":")) continue; // unknown prefix: ignored
    if (body.startsWith("~")) {
      const t = body.slice(1).toLowerCase();
      if (t) push({ kind: "tag", value: t, exact: false, exclude });
      continue;
    }
    const t = body.toLowerCase();
    if (t) push({ kind: "tag", value: t, exact: true, exclude });
  }

  return { advanced, groups: groups.filter((g) => g.length > 0) };
}
