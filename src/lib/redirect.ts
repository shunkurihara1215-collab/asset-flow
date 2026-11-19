// Server-side allowlist for redirect destinations (Stripe checkout/portal return URLs).
const PROJECT_ID = "88125784-29f0-4e63-90e3-fc6a7d57d60b";

export function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return true;
  return h.endsWith(".lovable.app") && h.includes(PROJECT_ID);
}

/**
 * Returns `url` only if it is an http(s) URL on an allowed host; otherwise the safe
 * fallback path on the (validated) request origin, or null when no safe origin exists.
 */
export function safeReturnUrl(url: string | undefined, requestOrigin: string | undefined, fallbackPath = "/settings"): string | null {
  const parse = (u: string | undefined) => { try { return u ? new URL(u) : null; } catch { return null; } };
  const target = parse(url);
  if (target && (target.protocol === "https:" || target.protocol === "http:") && isAllowedHost(target.hostname) && !target.username && !target.password) {
    if (target.protocol === "http:" && target.hostname !== "localhost" && target.hostname !== "127.0.0.1") return null;
    return target.toString();
  }
  const origin = parse(requestOrigin);
  if (origin && isAllowedHost(origin.hostname)) return `${origin.origin}${fallbackPath}`;
  return null;
}
