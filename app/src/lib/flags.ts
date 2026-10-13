import type { SessionUser } from "./types";

const ALL = 31; // sfw|nsfw|nsfl|nsfp|pol
const SFW_NSFP = 1 | 8;

export function effectiveFlags(user: SessionUser | null, requested: number): number {
  if (!user) return 1; // guests: SFW only
  return requested & (user.verified ? ALL : SFW_NSFP);
}
