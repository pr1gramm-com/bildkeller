export class ApiError extends Error {}

export type Me = { id: string; n: string; m: string; v: string; a: string } | null;

/** Reads the (non-httpOnly) `me` cookie the server sets at login. */
export function getMe(): Me {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((c) => c.startsWith("me="))?.slice(3);
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const me = JSON.parse(decodeURIComponent(escape(atob(b64)))) as Me;
    return me?.id ? me : null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parse(res: Response): Promise<any> {
  const body = await res.json();
  if (body.error) throw new ApiError(body.error);
  return body;
}

export const api = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: (path: string, params: Record<string, string | number> = {}): Promise<any> =>
    fetch(`/api/${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`).then(parse),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: (path: string, form: Record<string, string | number> = {}): Promise<any> => {
    const body = new URLSearchParams(Object.entries(form).map(([k, v]) => [k, String(v)]));
    const me = getMe();
    if (me) body.set("_nonce", me.id.slice(0, 16));
    return fetch(`/api/${path}`, { method: "POST", body }).then(parse);
  },
};

export const mediaUrl = (rel: string) => `/media/${rel}`;
export const isVideo = (rel: string) => /\.(webm|mp4|mov)$/.test(rel);
export const ago = (unix: number) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  return `vor ${Math.floor(s / 86400)} Tg.`;
};
