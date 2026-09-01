import "server-only";

import { after } from "next/server";
import { createServiceClient } from "@socialx/core/supabase/service";
import { readSettings } from "@/lib/settings";
import { hashesMatch, hashToken, parseToken, type Scope } from "@/lib/api/keys";

/**
 * The front door of /api/v1.
 *
 * Two kinds of caller reach it and they are told apart by one thing, whether a
 * credential was presented:
 *
 *   A key caller sends `Authorization: Bearer sx_live_...`. It gets whatever its
 *   scopes allow, across every content entry, and may only call from an origin
 *   its own allowlist names.
 *
 *   A public caller sends nothing. It gets read access to the entries somebody
 *   deliberately marked public, and only while the public switch is on.
 *
 * Both paths end at the same object, so a route handler asks "may this caller
 * read" and never "is there a token", which is what keeps the two surfaces from
 * drifting apart.
 *
 * Origin handling is the part worth being precise about, because CORS alone is
 * not access control. A browser refusing to hand a response back to a page is a
 * client-side courtesy; curl ignores it entirely. So an origin that is not on a
 * key's list is refused with a 403 here, server side, and separately is not
 * given the CORS header. The header controls what a browser will do, the refusal
 * controls what this server will do, and only the second one is a guarantee.
 */

export type ApiCaller = {
  kind: "key" | "public";
  /** Null for a public caller. */
  keyId: string | null;
  name: string;
  scopes: Scope[];
  /** Origins this caller may use a browser from. Empty means none. */
  allowedOrigins: string[];
  /** Public callers see only the entries flagged is_public. */
  publicOnly: boolean;
};

export type ApiFailure = {
  status: number;
  code: string;
  message: string;
};

export type AuthResult =
  | { ok: true; caller: ApiCaller; origin: string | null }
  | { ok: false; failure: ApiFailure; origin: string | null };

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header) {
    const match = /^bearer\s+(.+)$/i.exec(header.trim());
    if (match) return match[1].trim();
  }
  /* x-api-key as well, because plenty of no-code tools and webhook builders can
     set a named header and cannot set an Authorization scheme. */
  return request.headers.get("x-api-key");
}

/**
 * Authenticates and authorizes in one pass.
 *
 * `scope` is what the calling route needs. A public caller satisfies
 * content:read and nothing else, so a write route asking for content:write
 * rejects an anonymous caller without needing to know it was anonymous.
 */
export async function authenticate(
  request: Request,
  scope: Scope
): Promise<AuthResult> {
  const origin = request.headers.get("origin");
  const token = bearer(request);

  if (!token) return publicCaller(scope, origin);

  const parsed = parseToken(token);
  if (!parsed) {
    return deny(401, "invalid_key", "That is not a socialX API key.", origin);
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, token_hash, scopes, allowed_origins, expires_at, revoked_at")
    .eq("prefix", parsed.prefix)
    .maybeSingle();

  /* One message for an unknown prefix and for a wrong secret. Distinguishing
     them would confirm which half of a guess was right. */
  const unknown = () =>
    deny(401, "invalid_key", "That key is not valid.", origin);

  if (error || !data) return unknown();
  if (!hashesMatch(hashToken(token), data.token_hash as string)) return unknown();

  if (data.revoked_at) {
    return deny(401, "key_revoked", "That key was revoked.", origin);
  }
  if (data.expires_at && new Date(data.expires_at as string) <= new Date()) {
    return deny(401, "key_expired", "That key has expired.", origin);
  }

  const scopes = ((data.scopes as string[] | null) ?? []) as Scope[];
  if (!scopes.includes(scope)) {
    return deny(
      403,
      "missing_scope",
      `This key does not carry the ${scope} scope.`,
      origin
    );
  }

  const allowedOrigins = (data.allowed_origins as string[] | null) ?? [];
  if (origin && !allowedOrigins.includes(origin)) {
    /* Named on purpose. Unlike a bad secret there is nothing to protect here:
       whoever holds the key needs to know the fix is to add the domain, not to
       hunt for a broken credential. */
    return deny(
      403,
      "origin_not_allowed",
      allowedOrigins.length === 0
        ? "This key is server side only. Add the domain to its allowed origins to call it from a browser."
        : `${origin} is not one of this key's allowed origins.`,
      origin
    );
  }

  /* Usage is recorded after the response goes out, so the write never sits in
     the caller's latency. A failure here is not worth failing a good request
     over, which is why nothing awaits its result. */
  const keyId = data.id as string;
  after(async () => {
    try {
      await createServiceClient()
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString(), last_used_origin: origin })
        .eq("id", keyId);
    } catch {
      /* Telemetry, not bookkeeping. */
    }
  });

  return {
    ok: true,
    origin,
    caller: {
      kind: "key",
      keyId,
      name: data.name as string,
      scopes,
      allowedOrigins,
      publicOnly: false,
    },
  };
}

/** The no-credential path, gated by the public switch and its origin list. */
async function publicCaller(scope: Scope, origin: string | null): Promise<AuthResult> {
  const settings = await readSettings();
  const enabled = settings["api.public_enabled"] === true;
  const origins = (settings["api.public_origins"] as string[]) ?? [];

  if (!enabled) {
    return deny(
      401,
      "public_api_disabled",
      "The public API is switched off. Send an API key.",
      origin
    );
  }

  if (scope !== "content:read") {
    return deny(401, "key_required", "This endpoint needs an API key.", origin);
  }

  /* An empty list means any origin, which is the opposite of what it means on a
     key. The asymmetry is deliberate: a key is a secret and defaults to the
     narrow reading, public content is already public and defaults to the open
     one. Adding origins here narrows it. */
  if (origins.length > 0 && origin && !origins.includes(origin)) {
    return deny(
      403,
      "origin_not_allowed",
      `${origin} is not allowed to call the public API.`,
      origin
    );
  }

  return {
    ok: true,
    origin,
    caller: {
      kind: "public",
      keyId: null,
      name: "public",
      scopes: ["content:read"],
      allowedOrigins: origins,
      publicOnly: true,
    },
  };
}

function deny(
  status: number,
  code: string,
  message: string,
  origin: string | null
): AuthResult {
  return { ok: false, origin, failure: { status, code, message } };
}

/* ---------------- responses ---------------- */

/**
 * The CORS grant for a caller that has already been authorized.
 *
 * Never a wildcard for a key caller: the allowlist is echoed back one origin at
 * a time, with Vary so a shared cache cannot hand one domain's grant to another.
 * A wildcard would undo the entire point of the allowlist.
 */
function corsHeaders(caller: ApiCaller | null, origin: string | null): HeadersInit {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Api-Key",
    "Access-Control-Max-Age": "600",
    Vary: "Origin, Authorization",
  };

  if (!origin) return base;

  if (caller?.kind === "public" && caller.allowedOrigins.length === 0) {
    return { ...base, "Access-Control-Allow-Origin": "*" };
  }

  if (caller && caller.allowedOrigins.includes(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }

  /* No grant. The browser will discard the response, and the request was
     refused server side anyway. */
  return base;
}

export function apiJson(
  body: unknown,
  init: { status?: number; caller?: ApiCaller | null; origin?: string | null } = {}
): Response {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: {
      ...corsHeaders(init.caller ?? null, init.origin ?? null),
      "Cache-Control": "no-store",
    },
  });
}

export function apiError(failure: ApiFailure, origin: string | null): Response {
  return Response.json(
    { error: { code: failure.code, message: failure.message } },
    {
      status: failure.status,
      headers: {
        ...corsHeaders(null, origin),
        "Cache-Control": "no-store",
      },
    }
  );
}

/**
 * Preflight.
 *
 * A browser sends OPTIONS without the Authorization header, so there is no key
 * to check and no way to know which allowlist applies. What it does carry is
 * Origin, so the honest answer is: grant the preflight if any live key names
 * this origin, or if the public API would take it. The real request that follows
 * carries the key and is authorized properly.
 */
export async function preflight(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!origin) return new Response(null, { status: 204 });

  const settings = await readSettings();
  const publicOrigins = (settings["api.public_origins"] as string[]) ?? [];
  const publicOpen =
    settings["api.public_enabled"] === true &&
    (publicOrigins.length === 0 || publicOrigins.includes(origin));

  let known = publicOpen;
  if (!known) {
    try {
      const db = createServiceClient();
      const { data } = await db
        .from("api_keys")
        .select("id")
        .is("revoked_at", null)
        .contains("allowed_origins", [origin])
        .limit(1);
      known = (data ?? []).length > 0;
    } catch {
      known = false;
    }
  }

  const caller: ApiCaller | null = known
    ? {
        kind: publicOpen && publicOrigins.length === 0 ? "public" : "key",
        keyId: null,
        name: "preflight",
        scopes: [],
        allowedOrigins: publicOpen && publicOrigins.length === 0 ? [] : [origin],
        publicOnly: false,
      }
    : null;

  return new Response(null, { status: 204, headers: corsHeaders(caller, origin) });
}
