export type MediaExclude = "sound" | "video" | "repost";

export type TagQuery = {
  advanced: boolean;
  include: string[];
  exclude: string[];
  score: number | null;
  mediaExclude: MediaExclude[];
  markExclude: string[];
  user: string | null;
};

const MEDIA = new Set<string>(["sound", "video", "repost"]);

/** Parses the pr0gramm-style query grammar: `! tag -tag -"video" s:100 -m:ftb u:name`. */
export function parseTagQuery(q: string): TagQuery {
  const out: TagQuery = {
    advanced: false,
    include: [],
    exclude: [],
    score: null,
    mediaExclude: [],
    markExclude: [],
    user: null,
  };
  for (const raw of q.trim().split(/\s+/).filter(Boolean)) {
    if (raw === "!") {
      out.advanced = true;
      continue;
    }
    const quoted = raw.match(/^-"(.+)"$/);
    if (quoted && MEDIA.has(quoted[1])) {
      out.mediaExclude.push(quoted[1] as MediaExclude);
      continue;
    }
    const score = raw.match(/^s:(\d+)$/);
    if (score) {
      out.score = Number(score[1]);
      continue;
    }
    const mark = raw.match(/^-m:(.+)$/);
    if (mark) {
      out.markExclude.push(mark[1]);
      continue;
    }
    const user = raw.match(/^u:(.+)$/);
    if (user) {
      out.user = user[1];
      continue;
    }
    if (raw.includes(":")) continue; // unknown prefix: ignored
    if (raw.startsWith("-")) out.exclude.push(raw.slice(1).toLowerCase());
    else out.include.push(raw.toLowerCase());
  }
  return out;
}
