import { ApiError } from "@/lib/api/envelope";

/** Bound the entire multipart body, including extra fields, before parsing it. */
export async function limitedForm(request: Request, maxBytes: number): Promise<FormData | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new ApiError("invalid request");
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) throw new ApiError("too large");
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ApiError("too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks, size), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData().catch(() => null);
}
