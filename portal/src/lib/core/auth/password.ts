import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/**
 * Storing passwords.
 *
 * scrypt, from node's own crypto module, and the reason is the deployment model
 * rather than cryptography. argon2id is the better algorithm and would be the
 * pick for a service this team deploys itself. This is software other people
 * install: `git clone`, `npm install`, run. The argon2 package compiles native
 * code through node-gyp, which needs a working toolchain on the customer's
 * server and fails at install time on a surprising number of them, and the
 * prebuilt alternative ships architecture-specific binaries that are their own
 * class of problem on an unfamiliar host.
 *
 * scrypt is memory-hard, standardised in RFC 7914, and built into every node
 * this project supports. Nothing to compile, nothing to download, nothing to go
 * wrong on a machine nobody here has seen. That is worth more than the margin
 * between two good KDFs.
 *
 * ---
 *
 * Parameters are stored with the hash, not assumed.
 *
 * Every stored value carries the cost it was computed at:
 *
 *   scrypt$32768$8$3$<salt-b64>$<hash-b64>
 *
 * so raising the cost later is a one line change that leaves every existing
 * password verifiable. A scheme that hardcodes its parameters can never raise
 * them without locking everybody out, which in practice means it never raises
 * them, which is how a 2015 work factor ends up guarding a 2030 database.
 *
 * The algorithm name is in there for the same reason. When argon2id is worth
 * moving to, `verify` gains a branch, existing hashes keep working, and each one
 * is rewritten on the next successful sign in, which is when the plaintext is
 * available to rewrite it from.
 */

/*
 * N=32768, r=8, p=3 is the 32 MiB configuration from OWASP's password storage
 * guidance, which lists it alongside the 128 MiB and 64 MiB ones as equivalently
 * acceptable. Chosen at that end of the range because this runs on whatever the
 * customer deployed it to, which may be a 1 GB droplet, and a login that needs
 * 128 MiB per concurrent attempt is a denial of service against a small box.
 */
const N = 32768;
const R = 8;
const P = 3;
const KEYLEN = 64;
const SALT_BYTES = 16;

/* node's default maxmem is 32 MiB and scrypt needs roughly 128 * N * r, which is
   exactly 32 MiB here. Without headroom the call fails on the boundary. */
const MAXMEM = 128 * N * R * 4;

/**
 * The floor for a password somebody chooses.
 *
 * Length only, and that is deliberate rather than lazy. Composition rules push
 * people towards `Password1!`, which satisfies every character class and is in
 * the first thousand guesses of any real attack. Length is the property that
 * actually costs an attacker something, and it is the one NIST kept when it
 * dropped the rest.
 */
export const MIN_LENGTH = 12;

/**
 * Passwords that are refused whatever their length.
 *
 * A short list, holding the ones this product itself makes likely: the literal
 * default from the documentation, and the words somebody types when a screen
 * demands a change they did not want. It is not a substitute for a breach corpus
 * and does not pretend to be. What it does is stop the specific failure where an
 * installation is walked through setup and ends up with the password from the
 * README still on it.
 */
const REFUSED = new Set([
  "password", "password1", "password123", "passw0rd",
  "admin", "admin123", "administrator",
  "changeme", "change-me", "changeme123",
  "portal", "portaladmin", "letmein", "welcome",
  "12345678", "123456789", "1234567890",
  "qwertyuiop", "iloveyou", "secret", "default",
]);

/**
 * Is this acceptable as a chosen password? Returns the reason it is not.
 *
 * Returns a string rather than throwing because every caller is a form that
 * needs to render the reason next to the field.
 */
export function rejectionReason(password: string, email?: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `Use at least ${MIN_LENGTH} characters. Length is what makes a password hard to guess.`;
  }
  /* An upper bound, because scrypt hashes whatever it is given and a
     multi-megabyte "password" is a way to make a server do work on demand. */
  if (password.length > 1024) {
    return "That is longer than 1024 characters.";
  }

  const folded = password.toLowerCase().trim();
  if (REFUSED.has(folded)) {
    return "That is one of the first passwords anyone tries. Pick something else.";
  }

  /* The local part of their own address is the most common non-obvious choice
     and the first thing a targeted guess uses. */
  const local = (email ?? "").split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && folded.includes(local)) {
    return "Do not build the password out of your email address.";
  }

  if (new Set(password).size < 5) {
    return "That repeats too few distinct characters.";
  }

  return null;
}

/** Hashes a password for storage. Never logs, never returns the plaintext. */
export async function hash(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(normalize(password), salt, KEYLEN, {
    N, r: R, p: P, maxmem: MAXMEM,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/**
 * Checks a password against a stored hash.
 *
 * Returns false for a null or malformed stored value rather than throwing, so an
 * account with no password set follows the same path as a wrong password and the
 * sign-in form cannot tell the two apart. That is not tidiness: distinguishing
 * them would say which addresses hold an account and which of those can use a
 * password, which is exactly the enumeration the login form already avoids.
 */
export async function verify(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) {
    /* Spend the time anyway. Returning immediately would make "no such account"
       measurably faster than "wrong password", which is the timing oracle the
       identical error messages exist to prevent. */
    await burnTime(password);
    return false;
  }

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    await burnTime(password);
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  /* Bounded, because these come out of the database and a corrupted or hostile
     row naming N=2^30 would ask node to allocate a terabyte. */
  if (
    !Number.isInteger(n) || n < 1024 || n > 1_048_576 ||
    !Number.isInteger(r) || r < 1 || r > 32 ||
    !Number.isInteger(p) || p < 1 || p > 16
  ) {
    await burnTime(password);
    return false;
  }

  let expected: Buffer;
  let salt: Buffer;
  try {
    expected = Buffer.from(hashRaw, "base64");
    salt = Buffer.from(saltRaw, "base64");
  } catch {
    return false;
  }
  if (expected.length === 0 || salt.length === 0) return false;

  const derived = await scrypt(normalize(password), salt, expected.length, {
    N: n, r, p, maxmem: Math.max(128 * n * r * 4, MAXMEM),
  });

  /* Lengths are equal by construction above, but timingSafeEqual throws rather
     than returning false on a mismatch, and a throw here would be a 500 on a
     login form. */
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * True when a stored hash was made with weaker parameters than today's.
 *
 * Checked on a successful sign in, which is the only moment the plaintext exists
 * to rehash from. Without this, raising the cost above protects accounts created
 * afterwards and silently leaves every existing one at the old setting forever.
 */
export function needsRehash(stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < N || Number(parts[2]) < R || Number(parts[3]) < P;
}

/**
 * Unicode normalisation, so the same typed password matches itself.
 *
 * A character like é can be one code point or two, and which one a keyboard
 * produces differs by platform. Without normalising, a password set on a Mac can
 * fail to verify when typed on Windows, and the person is locked out of an
 * account by a bug they cannot possibly diagnose.
 */
function normalize(password: string): string {
  return password.normalize("NFKC");
}

/** Spends roughly the time a real verification would, to flatten timing. */
async function burnTime(password: string): Promise<void> {
  try {
    await scrypt(normalize(password), randomBytes(SALT_BYTES), KEYLEN, {
      N, r: R, p: P, maxmem: MAXMEM,
    });
  } catch {
    /* The point was the delay. */
  }
}

/**
 * A password for an account whose owner is not present to choose one.
 *
 * Used for the installer's first account and for an administrator resetting a
 * colleague's. Every one of these is created with must_change_password set, so
 * this value's whole job is to survive being read off a terminal once.
 *
 * The alphabet omits characters that are misread when they are: no O or 0, no l,
 * I or 1. Somebody is going to copy this by hand out of a server log, and a
 * password that cannot be transcribed is a support ticket.
 */
export function generate(length = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const out: string[] = [];

  /* Rejection sampling. Taking a random byte modulo the alphabet length biases
     the result towards the first few characters, and while the bias is small it
     is free to avoid. */
  const limit = 256 - (256 % alphabet.length);
  while (out.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte >= limit) continue;
      out.push(alphabet[byte % alphabet.length]);
      if (out.length === length) break;
    }
  }

  return out.join("");
}
