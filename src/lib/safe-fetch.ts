import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

export function isPublicAddress(address: string) {
  try {
    return (
      ipaddr.process(address.replace(/^\[|\]$/g, "")).range() === "unicast"
    );
  } catch {
    return false;
  }
}
export function validateRemoteUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error(
      "Only public HTTP(S) websites on standard ports are supported.",
    );
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    (ipaddr.isValid(hostname) && !isPublicAddress(hostname))
  )
    throw new Error("Private and local network addresses are not allowed.");
  return url;
}
export async function safeFetch(
  value: string,
  maxBytes = 2_000_000,
  redirects = 0,
  allowedOrigin?: string,
  options: { headers?: Record<string,string>; timeoutMs?: number; allowWebsiteRedirects?: boolean } = {},
): Promise<{ text: string; body: Buffer; url: string; status: number; contentType: string }> {
  const url = validateRemoteUrl(value);
  if (allowedOrigin && url.origin !== allowedOrigin && !(options.allowWebsiteRedirects && url.hostname.replace(/^www\./,"") === new URL(allowedOrigin).hostname.replace(/^www\./,"") && !url.port))
    throw new Error(
      "This source redirects to another origin. Review that source before collection.",
    );
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = ipaddr.isValid(hostname)
    ? [{ address: hostname, family: hostname.includes(":") ? 6 : 4 }]
    : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("The source resolves to a restricted network address.");
  const address = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(
      url,
      {
        agent: false,
        lookup: (_hostname, options, callback) =>
          options.all
            ? callback(null, addresses)
            : callback(null, address.address, address.family),
        headers: {
          "User-Agent": "DataSoftLocalResearch/0.2",
          Accept: "text/html, application/json, text/plain",
          "Accept-Encoding": "identity",
          ...options.headers,
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.resume();
          if (redirects >= 4 || !response.headers.location) {
            reject(
              new Error("Too many redirects or missing redirect location."),
            );
            return;
          }
          safeFetch(
            new URL(response.headers.location, url).href,
            maxBytes,
            redirects + 1,
            allowedOrigin,
            options,
          ).then(resolve, reject);
          return;
        }
        if (Number(response.headers["content-length"] || 0) > maxBytes) {
          response.destroy();
          reject(
            new Error("Source response exceeds the collection size limit."),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            response.destroy();
            reject(
              new Error("Source response exceeds the collection size limit."),
            );
          } else chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            text: Buffer.concat(chunks).toString("utf8"),
            body: Buffer.concat(chunks),
            url: url.href,
            status,
            contentType: String(response.headers["content-type"] || ""),
          }),
        );
        response.on("error", reject);
      },
    );
    request.setTimeout(options.timeoutMs || 12_000, () =>
      request.destroy(new Error("Source timed out. Try again later.")),
    );
    request.on("error", reject);
  });
}
