import { describe, expect, it } from "vitest";
import { limitedForm } from "@/lib/limited-form";

describe("bounded multipart parsing", () => {
  it("parses valid forms below the whole-request limit", async () => {
    const body = new FormData(); body.set("name", "small");
    const form = await limitedForm(new Request("http://localhost", { method: "POST", body }), 1024);
    expect(form?.get("name")).toBe("small");
  });
  it("stops and cancels oversized streamed bodies without Content-Length", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(40)); }, cancel() { cancelled = true; } });
    const init: RequestInit & { duplex: "half" } = { method: "POST", body, duplex: "half", headers: { "content-type": "multipart/form-data; boundary=test" } };
    await expect(limitedForm(new Request("http://localhost", init), 100)).rejects.toThrow("too large");
    expect(cancelled).toBe(true);
  });
  it("bounds extra multipart fields as well as uploaded files", async () => {
    const body = `--test\r\nContent-Disposition: form-data; name="unexpected"\r\n\r\n${"x".repeat(2048)}\r\n--test--\r\n`;
    const request = new Request("http://localhost", { method: "POST", body, headers: { "content-type": "multipart/form-data; boundary=test" } });
    expect(request.headers.has("content-length")).toBe(false);
    await expect(limitedForm(request, 1024)).rejects.toThrow("too large");
  });
});
