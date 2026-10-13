/** Opaque telemetry counters, mirrored from the observed API envelope. */
const RT = 4;
const QC = 2;

export type ApiPayload = Record<string, unknown>;

export function ok(payload: ApiPayload): ApiPayload {
  return { ...payload, cache: null, error: null, rt: RT, qc: QC, ts: Math.floor(Date.now() / 1000) };
}

export function fail(error: string): ApiPayload {
  return { cache: null, error, rt: RT, qc: QC, ts: Math.floor(Date.now() / 1000) };
}

export const json = (payload: ApiPayload): Response =>
  Response.json(payload, { status: 200 });

/** Domain error whose message is safe to show to API clients. Anything else becomes a generic error. */
export class ApiError extends Error {}
