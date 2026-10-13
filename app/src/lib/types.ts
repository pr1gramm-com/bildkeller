import type { NextRequest } from "next/server";

export type SessionUser = {
  /** Session token — also the cookie `id` value and _nonce source (first 16 chars). */
  id: string;
  userId: number;
  name: string;
  mark: number;
  verified: boolean;
  admin: boolean;
  mod: boolean;
  flags: number;
};

export type SetCookie = {
  name: string;
  value: string;
  maxAge?: number;
};

export type ApiCtx = {
  user: SessionUser | null;
  query: URLSearchParams;
  form: Record<string, string>;
  req: NextRequest;
  /** Handlers push cookies here; the dispatcher applies them to the response. */
  outCookies: SetCookie[];
};

export type ApiHandler = (ctx: ApiCtx) => Promise<ApiPayload>;
