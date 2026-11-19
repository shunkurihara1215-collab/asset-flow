import { describe, expect, it } from "vitest";
import { safeReturnUrl } from "./redirect";
const P = "https://id-preview--88125784-29f0-4e63-90e3-fc6a7d57d60b.lovable.app";
describe("safeReturnUrl", () => {
  it("keeps in-app URLs", () => {
    expect(safeReturnUrl(`${P}/settings?checkout=done&session_id={CHECKOUT_SESSION_ID}`, P)).toContain(`${P}/settings?checkout=done`);
  });
  it("replaces external domains with the safe fallback", () => {
    expect(safeReturnUrl("https://evil.example.com/phish", P)).toBe(`${P}/settings`);
    expect(safeReturnUrl("https://other-project.lovable.app/", P)).toBe(`${P}/settings`);
    expect(safeReturnUrl("javascript:alert(1)", P)).toBe(`${P}/settings`);
  });
  it("refuses when neither target nor origin is trusted", () => {
    expect(safeReturnUrl("https://evil.example.com", "https://evil.example.com")).toBeNull();
  });
});
