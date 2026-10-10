import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import {
  createSessionToken,
  verifySessionToken,
  getSessionPayload,
  getClientIp,
  getSessionSecret,
  getExpectedHouseCode,
} from "./session";

describe("Session & Auth Helpers (P0-02 & Profilo Univoco)", () => {
  const VALID_SECRET = "super-secret-key-that-is-at-least-32-chars-long!";
  const VALID_CODE = "segretoDellaCasa123";

  beforeEach(() => {
    process.env.SESSION_SECRET = VALID_SECRET;
    process.env.HOUSE_SECRET_CODE = VALID_CODE;
  });

  it("throws clear error when SESSION_SECRET is missing or too short", () => {
    delete process.env.SESSION_SECRET;
    expect(() => getSessionSecret()).toThrow("SESSION_SECRET deve essere definito");

    process.env.SESSION_SECRET = "short-key";
    expect(() => getSessionSecret()).toThrow("almeno 32 caratteri");
  });

  it("throws clear error when HOUSE_SECRET_CODE is missing", () => {
    delete process.env.HOUSE_SECRET_CODE;
    expect(() => getExpectedHouseCode()).toThrow("HOUSE_SECRET_CODE deve essere configurato");
  });

  it("creates and verifies valid session tokens with roommateId (0, 1, 2)", () => {
    for (const id of [0, 1, 2]) {
      const token = createSessionToken(id);
      expect(typeof token).toBe("string");
      expect(verifySessionToken(token)).toBe(true);

      const payload = getSessionPayload(token);
      expect(payload).not.toBeNull();
      expect(payload?.roommateId).toBe(id);
      expect(payload?.houseId).toBe("default");
      expect(typeof payload?.authenticatedAt).toBe("number");
    }
  });

  it("throws error when trying to create a token with invalid roommateId", () => {
    expect(() => createSessionToken(3 as any)).toThrow("roommateId non valido");
    expect(() => createSessionToken(-1 as any)).toThrow("roommateId non valido");
    expect(() => createSessionToken(NaN as any)).toThrow("roommateId non valido");
    expect(() => createSessionToken(undefined as any)).toThrow("roommateId non valido");
  });

  it("invalidates legacy sessions lacking roommateId", () => {
    // Simula un vecchio token generato prima della modifica (privo di roommateId)
    const oldPayload = {
      houseId: "default",
      authenticatedAt: Date.now(),
    };
    const payloadB64 = Buffer.from(JSON.stringify(oldPayload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", VALID_SECRET)
      .update(payloadB64)
      .digest("base64url");
    const legacyToken = `${payloadB64}.${signature}`;

    expect(verifySessionToken(legacyToken)).toBe(false);
    expect(getSessionPayload(legacyToken)).toBeNull();
  });

  it("safely rejects tokens with signatures of different lengths without RangeError exception", () => {
    const token = createSessionToken(0);
    const [payload, sig] = token.split(".");

    // Signature with completely different length
    const shortSig = payload + ".short";
    expect(verifySessionToken(shortSig)).toBe(false);

    // Empty signature
    const emptySig = payload + ".";
    expect(verifySessionToken(emptySig)).toBe(false);

    // Tampered same-length signature
    const tampered = payload + "." + sig.slice(0, -4) + "XXXX";
    expect(verifySessionToken(tampered)).toBe(false);

    // Malformed token
    expect(verifySessionToken("not-a-valid-token")).toBe(false);
    expect(verifySessionToken(null)).toBe(false);
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
