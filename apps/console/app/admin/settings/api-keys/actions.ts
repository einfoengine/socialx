"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/dal/permissions";
import { createServiceClient } from "@socialx/core/supabase/service";
import { normalizeOrigin } from "@/lib/settings";
import { mintKey } from "@/lib/api/keys";
import { isScope, type Scope } from "@/lib/api/scopes";
import type { ActionResult } from "../types";

/**
 * Issuing and retiring API credentials.
 *
 * The one thing worth reading carefully is what createKeyAction returns. The
 * secret is generated here, hashed, and the hash is what is stored; the plain
 * token exists in exactly one server action response and is then gone. There is
 * no endpoint that reveals it again, no admin override, and no support path.
 * That is the property that makes this table safe to hold: whoever gets a copy
 * of the database gets no working credential out of it.
 *
 * The cost is that losing a key means issuing a new one, which is the correct
 * trade and is stated on the screen so nobody has to discover it.
 */

export type CreateResult =
  | { ok: true; message: string; token: string; prefix: string }
  | { ok: false; error: string };

/** Parses the origin textarea. Empty is legal and means server side only. */
function readOrigins(raw: string): string[] | { error: string } {
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const part of parts) {
    /* A wildcard is refused rather than quietly widened. Somebody typing * has a
       specific intent, and the honest answer is that this control does not do
       that: leaving the box empty is how you say "no browser", and there is no
       way to say "every browser" on a credential. */
    if (part === "*" || part.includes("*")) {
      return {
        error:
          "Wildcards are not accepted here. Name each domain, or leave this empty for a server side key.",
      };
    }
    const origin = normalizeOrigin(part);
    if (!origin) {
      return { error: `"${part}" is not a domain. Write it like https://socialx.studio.` };
    }
    if (!out.includes(origin)) out.push(origin);
  }

  if (out.length > 25) return { error: "A key is capped at 25 origins." };
  return out;
}

function readScopes(values: FormDataEntryValue[]): Scope[] | { error: string } {
  const out: Scope[] = [];
  for (const value of values) {
    const text = String(value);
    if (!isScope(text)) return { error: `"${text}" is not a scope.` };
    if (!out.includes(text)) out.push(text);
  }
  if (out.length === 0) return { error: "A key with no scopes can do nothing. Pick at least one." };
  return out;
}

function isError(v: unknown): v is { error: string } {
  return typeof v === "object" && v !== null && "error" in v;
}

export async function createKeyAction(
  _prev: CreateResult | null,
  formData: FormData
): Promise<CreateResult> {
  const session = await requirePermission("settings", "full");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "Give the key a name of 2 to 80 characters. Name what uses it." };
  }

  const scopes = readScopes(formData.getAll("scopes"));
  if (isError(scopes)) return { ok: false, error: scopes.error };

  const origins = readOrigins(String(formData.get("origins") ?? ""));
  if (isError(origins)) return { ok: false, error: origins.error };

  /* An expiry in days rather than a date, because the question somebody is
     actually answering is "how long should this live", and 0 for never is the
     one case a date picker handles badly. */
  const days = Number(String(formData.get("expires_days") ?? "0").trim());
  if (!Number.isInteger(days) || days < 0 || days > 3650) {
    return { ok: false, error: "Expiry is a whole number of days, up to 3650. Use 0 for no expiry." };
  }
  const expiresAt =
    days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;

  const environment = String(formData.get("environment") ?? "live");
  if (environment !== "live" && environment !== "test") {
    return { ok: false, error: "Pick live or test." };
  }

  const minted = mintKey(environment);

  const db = createServiceClient();
  const { error } = await db.from("api_keys").insert({
    name,
    prefix: minted.prefix,
    token_hash: minted.tokenHash,
    scopes,
    allowed_origins: origins,
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: session.userId,
    expires_at: expiresAt,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings/api-keys");
  return {
    ok: true,
    prefix: minted.prefix,
    token: minted.token,
    message: "Key created. Copy it now, it is not shown again.",
  };
}

export async function updateKeyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("settings", "full");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the key." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "A key name is 2 to 80 characters." };
  }

  const scopes = readScopes(formData.getAll("scopes"));
  if (isError(scopes)) return { ok: false, error: scopes.error };

  const origins = readOrigins(String(formData.get("origins") ?? ""));
  if (isError(origins)) return { ok: false, error: origins.error };

  const db = createServiceClient();
  const { error, count } = await db
    .from("api_keys")
    .update(
      {
        name,
        scopes,
        allowed_origins: origins,
        note: String(formData.get("note") ?? "").trim() || null,
      },
      { count: "exact" }
    )
    .eq("id", id)
    .is("revoked_at", null);

  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "That key is revoked or no longer exists." };

  revalidatePath("/admin/settings/api-keys");
  return { ok: true, message: `"${name}" updated. It applies to the next request.` };
}

/**
 * Revokes rather than deletes.
 *
 * The row stays so that a prefix turning up in a log next month can still be
 * named, and so the answer to "what was that key for" survives the decision to
 * turn it off. Authentication checks revoked_at on every request, so this takes
 * effect immediately with no cache to wait out.
 */
export async function revokeKeyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("settings", "full");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the key." };

  const db = createServiceClient();
  const { error, count } = await db
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .is("revoked_at", null);

  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "That key was already revoked." };

  revalidatePath("/admin/settings/api-keys");
  return { ok: true, message: "Key revoked. Anything still using it is now getting a 401." };
}
