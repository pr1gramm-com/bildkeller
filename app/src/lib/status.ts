/**
 * Account age based user status, mirroring the reference board's tiers.
 * The tiers are shown next to the name and in the profile header.
 */
export type Status = { key: string; label: string };

const DAY = 86400;

export function userStatus(created: number, now = Math.floor(Date.now() / 1000)): Status {
  const days = Math.floor((now - created) / DAY);
  if (days < 30) return { key: "new", label: "Neuschwuchtel" };
  if (days < 365) return { key: "mid", label: "Mittelaltschwuchtel" };
  return { key: "old", label: "Altschwuchtel" };
}
