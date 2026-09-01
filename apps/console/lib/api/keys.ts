import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Minting and checking API credentials.
 *
 * A token is three parts joined by underscores: sx, an environment word, and
 * then a prefix and a secret in hex.
 *
 *   sx_live_9f3c1a7b_4d2e...  (8 hex of prefix, 48 hex of secret)
 *
 * The prefix is public. It is the lookup handle, the label in the console, and
 * the thing somebody can quote in a support message without handing over the
 * credential. The secret is shown exactly once, at creation, and never leaves
 * the process again: what the table holds is SHA-256 over the whole token.
 *
 * SHA-256 rather than bcrypt or argon2, which is the right call here and would
 * be the wrong one for a password. A password is short, human-chosen and
 * guessable, so a slow hash is what buys safety. This secret is 192 bits from
 * the system CSPRNG, so there is no dictionary to run and no amount of hardware
 * that gets through it. What a slow hash would buy instead is latency on the
 * authentication path of every single API request.
 */

export type KeyEnvironment = "live" | "test";

const TOKEN_RE = /^sx_(live|test)_([0-9a-f]{8})_([0-9a-f]{48})$/;

export type MintedKey = {
  /** The full credential. This value exists in exactly one response, forever. */
  token: string;
  prefix: string;
  tokenHash: string;
};

export function mintKey(env: KeyEnvironment = "live"): MintedKey {
  const prefixId = randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("hex");
  const prefix = `sx_${env}_${prefixId}`;
  const token = `${prefix}_${secret}`;
  return { token, prefix, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Splits a presented token, or returns null if it is not one of ours. */
export function parseToken(token: string): { prefix: string } | null {
  const match = TOKEN_RE.exec(token.trim());
  if (!match) return null;
  return { prefix: `sx_${match[1]}_${match[2]}` };
}

/**
 * Constant-time comparison of two hex digests.
 *
 * A plain === leaks how many leading characters matched through how long the
 * comparison took. That is a real attack against a hash the caller controls the
 * input to, and the fix costs nothing.
 */
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/* The scope vocabulary lives in scopes.ts, which carries no server-only guard so
   the console can render it. Re-exported here because everything else about a
   key comes from this file and splitting the import would be a trap. */
export {
  SCOPES,
  SCOPE_KEYS,
  isScope,
  type Scope,
} from "./scopes";
