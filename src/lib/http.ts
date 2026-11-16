import { ZodError } from "zod";
export function guardLocal(request: Request, mutation = false) {
  const url = new URL(request.url);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    throw new Error(
      "This release is local-only. Authentication is required before remote deployment.",
    );
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  // Next may canonicalize 127.0.0.1 as localhost in request.url. Accept only
  // loopback aliases on the same port; never trust a forwarded remote origin.
  const originUrl = origin ? new URL(origin) : null;
  if (
    fetchSite === "cross-site" ||
    (originUrl &&
      (!["127.0.0.1", "localhost", "[::1]"].includes(originUrl.hostname) ||
        originUrl.port !== url.port ||
        originUrl.protocol !== url.protocol))
  )
    throw new Error("Cross-origin access is not allowed.");
  if (
    mutation &&
    !request.headers.get("content-type")?.includes("application/json")
  )
    throw new Error("Use an application/json request.");
}
export async function readJson(request: Request) {
  if (Number(request.headers.get("content-length")) > 2_000_000)
    throw new Error("Request is too large (maximum 2 MB).");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new Error("Request is too large (maximum 2 MB).");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function apiError(error: unknown) {
  const message =
    error instanceof ZodError
      ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      : error instanceof SyntaxError
        ? "Invalid request format."
        : error instanceof Error
          ? error.message
          : "The operation failed.";
  console.error("[DataSoft]", message);
  return Response.json(
    { error: message },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
