import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken, getClientIp } from "./session";

describe("Session & Auth Helpers", () => {
  it("creates and successfully verifies valid session token", () => {
    const token = createSessionToken();
    expect(typeof token).toBe("string");
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects invalid or tampered tokens", () => {
    expect(verifySessionToken(null)).toBe(false);
    expect(verifySessionToken("")).toBe(false);
    expect(verifySessionToken("invalid-token")).toBe(false);

    const token = createSessionToken();
    const tampered = token.slice(0, -4) + "abcd";
    expect(verifySessionToken(tampered)).toBe(false);
  });

  it("extracts client IP properly from headers", () => {
    const req1 = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
    });
    expect(getClientIp(req1)).toBe("203.0.113.195");

    const req2 = new Request("http://localhost", {
      headers: { "x-real-ip": "198.51.100.1" },
    });
    expect(getClientIp(req2)).toBe("198.51.100.1");

    const req3 = new Request("http://localhost");
    expect(getClientIp(req3)).toBe("127.0.0.1");
  });
});
