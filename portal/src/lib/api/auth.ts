import "server-only";

import { after } from "next/server";
import { createServiceClient } from "@/lib/core/supabase/service";
import { normalizeOrigin, type Site } from "@/lib/core/sites";
import { siteById, siteByKey, siteByOrigin } from "@/lib/sites/resolve";
import { readSettings } from "@/lib/settings";
import { hashesMatch, hashToken, parseToken, type Scope } from "@/lib/api/keys";
import {
  burst,
  clientIp,
  limitHeaders,
  spend,
  type Verdict,
} from "@/lib/core/ratelimit";

/**
 * The front door of /api/v1.
 *
 * Every request that gets through here has answered two questions, in this
 * order: which site is this, and may this caller do the thing it is asking for.
 * The order matters. Site comes first because it is the boundary everything else
 * is drawn inside: a scope grants an action within one site, never across sites,
 * and there is no credential, no header and no console setting that widens that.
 *
 * Two kinds of caller reach it, told apart by whether a credential was presented:
 *
 *   A key caller sends `Authorization: Bearer sx_live_...`. The key belongs to a
 *   site, so the site is known exactly. It gets whatever its scopes allow within
 *   that site, and may only call from an origin that is both on its own allowlist
 *   and verified by that site.
 *
 *   A public caller sends no credential and must name the site itself, with an
 *   `X-Site-Key` header or a `site` query parameter, or by calling from an origin
 *   that site has verified. It gets read access to the entries somebody
 *   deliberately marked public, and only while the platform's public switch is on.
 *
 * Both paths end at the same object, so a route handler asks "may this caller
 * read this site's content" and never "is there a token", which is what keeps the
 * two surfaces from drifting apart.
 *
 * Origin handling is the part worth being precise about, because CORS alone is
 * not access control. A browser refusing to hand a response back to a page is a
 * client-side courtesy; curl ignores it entirely. So an origin that is not
 * permitted is refused with a 403 here, server side, and separately is not given
 * the CORS header. The header controls what a browser will do, the refusal
 * controls what this server will do, and only the second one is a guarantee.
 */

export type ApiCaller = {
  kind: "key" | "public";
  /** Null for a public caller. */
  keyId: string | null;
  name: string;
  scopes: Scope[];
  /** The site this request is bounded to. Never null: without one there is no request. */
  site: Site;
  /** Origins this caller may use a browser from. Empty means none. */
  allowedOrigins: string[];
  /** Public callers see only the entries flagged is_public. */
  publicOnly: boolean;
};

export type ApiFailure = {
  status: number;
  code: string;
  message: string;
  /** Extra response headers this refusal needs. Retry-After, in practice. */
  headers?: Record<string, string>;
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
 * Is this origin one the site has proved it controls?
 *
 * Checked at request time rather than trusted from the key's own list, and that
 * is the whole point of splitting verification from allowlisting. The list on a
 * key says which of a site's domains that credential may be used from. This says
 * the domain is still the site's. Clearing a verification therefore cuts browser
 * access everywhere at once, with no keys to go and edit.
 */
async function originIsVerified(siteId: string, origin: string): Promise<boolean> {
  try {
    const db = createServiceClient();
    const { data } = await db
      .from("site_domains")
      .select("id")
      .eq("site_id", siteId)
      .eq("origin", origin.toLowerCase())
      .not("verified_at", "is", null)
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch {
    /* Fail closed. An unreachable database is not permission to widen access. */
    return false;
  }
}

/* ---------------- budgets ---------------- */

/**
 * How much of this API one caller may have.
 *
 * The numbers are set against what a legitimate integration actually does
 * rather than against what feels generous. A website rendering from this API
 * reads a handful of entries per page and caches them; a server-side job syncs
 * on a schedule. Neither shape comes near these. What does come near them is a
 * loop, which is the thing being priced out.
 *
 * Stated plainly, because a limit that is not understood gets raised the first
 * time somebody complains: the point is not to stop one request, it is to make
 * copying the whole surface take long enough to notice. A key reading at the
 * ceiling needs hours to walk a site's content and leaves an hours-long trail in
 * last_used_at while doing it.
 */
const BUDGETS = {
  /** A credentialed caller, counted by the key rather than by address. */
  key: { limit: 300, windowSeconds: 60 },
  /** No credential. Reads only what a site published, so it needs far less. */
  public: { limit: 60, windowSeconds: 60 },
  /**
   * Failed authentications, per address.
   *
   * This is the one that is not about volume. A key is 192 bits and cannot be
   * guessed, but a leaked prefix, a stale key from an old deploy, and a
   * credential-stuffing list all produce the same signature: many refusals from
   * one place. Twenty a minute is far above any honest misconfiguration and far
   * below anything worth calling an attempt.
   */
  failure: { limit: 20, windowSeconds: 60 },
  /**
   * The cheap gate in front of everything, counted in this process only.
   *
   * Spent before the key is parsed or any table is read, so a flood of garbage
   * costs a Map lookup rather than a database round trip. Set well above the
   * real budgets below it: its job is to shed obvious abuse, not to be the
   * limit.
   */
  edge: { limit: 600, windowSeconds: 60 },
} as const;

function tooMany(verdict: Verdict, origin: string | null): AuthResult {
  return {
    ok: false,
    origin,
    failure: {
      status: 429,
      code: "rate_limited",
      message: `Too many requests. Try again in ${verdict.retryAfter}s.`,
      headers: limitHeaders(verdict),
    },
  };
}

/**
 * Counts a refusal and, past the threshold, refuses the refusal.
 *
 * Without this an invalid credential is free: every 401 above costs this
 * platform a lookup and costs the caller nothing, which is the wrong way round
 * for the one request shape that is never legitimate in volume.
 */
async function countFailure(request: Request, result: AuthResult): Promise<AuthResult> {
  const verdict = await spend(`api:fail:${clientIp(request)}`, BUDGETS.failure);
  return verdict.ok ? result : tooMany(verdict, result.origin);
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
  const origin = normalizeOrigin(request.headers.get("origin") ?? "");

  /* Before anything else, and before anything that costs a round trip. This is
     the in-process counter only, so it is free and it is not the real limit. */
  const edge = burst(`api:edge:${clientIp(request)}`, BUDGETS.edge);
  if (!edge.ok) return tooMany(edge, origin);

  const token = bearer(request);

  if (!token) return publicCaller(request, scope, origin);

  const parsed = parseToken(token);
  if (!parsed) {
    return countFailure(
      request,
      deny(401, "invalid_key", "That is not a valid API key.", origin)
    );
  }

  const db = createServiceClient();
  /* cross-site: the prefix is the lookup handle and the site is what the row
     answers. Filtering by site here would need the site the request has not
     established yet. */
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, site_id, token_hash, scopes, allowed_origins, expires_at, revoked_at")
    .eq("prefix", parsed.prefix)
    .maybeSingle();

  /* One message for an unknown prefix and for a wrong secret. Distinguishing
     them would confirm which half of a guess was right. */
  const unknown = () =>
    countFailure(request, deny(401, "invalid_key", "That key is not valid.", origin));

  if (error || !data) return unknown();
  if (!hashesMatch(hashToken(token), data.token_hash as string)) return unknown();

  if (data.revoked_at) {
    return countFailure(request, deny(401, "key_revoked", "That key was revoked.", origin));
  }
  if (data.expires_at && new Date(data.expires_at as string) <= new Date()) {
    return countFailure(request, deny(401, "key_expired", "That key has expired.", origin));
  }

  /* The site, before the scope. A credential belonging to a site that is not
     serving is refused whatever it is allowed to do, which is what makes
     suspending a site an actual kill switch rather than a label. */
  const site = await siteById(data.site_id as string);
  if (!site) {
    return deny(401, "site_missing", "The site this key belongs to no longer exists.", origin);
  }
  if (site.status !== "active") {
    return deny(
      403,
      "site_inactive",
      site.status === "suspended"
        ? "This site is suspended. Its credentials are refused until it is restored."
        : "This site is not live yet. Activate it in the console before using its keys.",
      origin
    );
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
  if (origin) {
    if (!allowedOrigins.includes(origin)) {
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

    if (!(await originIsVerified(site.id, origin))) {
      return deny(
        403,
        "origin_not_verified",
        `${origin} is on this key but is not a verified domain of ${site.name}. Verify it in the console first.`,
        origin
      );
    }
  }

  const keyId = data.id as string;

  /* Counted by key, not by address, and that is the only identity that means
     anything here. A key moved between machines is the same integration and
     keeps one budget; a key shared across a botnet is still one budget, which is
     precisely the property an address-keyed limit cannot give. */
  const budget = await spend(`api:key:${keyId}`, BUDGETS.key);
  if (!budget.ok) return tooMany(budget, origin);

  /* Usage is recorded after the response goes out, so the write never sits in
     the caller's latency. A failure here is not worth failing a good request
     over, which is why nothing awaits its result. */
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
      site,
      allowedOrigins,
      publicOnly: false,
    },
  };
}

/**
 * The no-credential path.
 *
 * Harder than it used to be in exactly one way: an anonymous caller now has to
 * say whose content it wants. There is no default site to fall back to, so
 * "GET /api/v1/content" with nothing else on it is not an under-specified
 * request that this platform can guess at, it is an ambiguous one, and answering
 * it with somebody's data would mean picking a favourite site.
 *
 * Three ways to say it, in the order they are trusted. X-Site-Key and ?site= are
 * the caller naming itself, which is fine because everything reachable this way
 * is content the site marked public. The Origin header is the fallback for a
 * browser that cannot easily set a header, and it only resolves through a domain
 * the site has verified.
 */
async function publicCaller(
  request: Request,
  scope: Scope,
  origin: string | null
): Promise<AuthResult> {
  const settings = await readSettings();
  if (settings["api.public_enabled"] !== true) {
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

  const named =
    request.headers.get("x-site-key")?.trim() ||
    new URL(request.url).searchParams.get("site")?.trim() ||
    "";

  const site = named ? await siteByKey(named) : origin ? await siteByOrigin(origin) : null;

  if (!site) {
    /* The enumeration shape on this path: guessing site keys produces exactly
       this refusal, over and over, from one place. */
    return countFailure(
      request,
      deny(
        401,
        "site_unresolved",
        named
          ? `No site is registered under "${named}".`
          : "Name the site with an X-Site-Key header, a ?site= parameter, or call from one of its verified domains.",
        origin
      )
    );
  }

  if (site.status !== "active") {
    return deny(403, "site_inactive", "That site is not serving requests.", origin);
  }

  /*
   * Counted by address and site together.
   *
   * By site, because one site's traffic must not be able to exhaust another's
   * budget: without the site in the key, a single popular integration would
   * rate limit everybody else on the platform. By address, because there is no
   * other identity on this path; a public caller has presented nothing.
   *
   * The burst budget is deliberately wider than the durable one. A real website
   * server-rendering its own pages arrives from a handful of datacentre
   * addresses, and a strict per-process view of that looks like abuse when it is
   * a busy afternoon. The shared counter is the one that decides.
   */
  const budget = await spend(
    `api:pub:${site.key}:${clientIp(request)}`,
    BUDGETS.public,
    { limit: BUDGETS.public.limit * 2, windowSeconds: BUDGETS.public.windowSeconds }
  );
  if (!budget.ok) return tooMany(budget, origin);

  return {
    ok: true,
    origin,
    caller: {
      kind: "public",
      keyId: null,
      name: "public",
      scopes: ["content:read"],
      site,
      /* Empty, and it means something different here than on a key. A public
         caller reads only what the site published, so the browser grant below is
         a wildcard and there is no list to narrow. */
      allowedOrigins: [],
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
 *
 * A public caller does get a wildcard, and that is not an inconsistency. What it
 * can reach is the set of entries a site deliberately marked public, on a request
 * carrying no credential and no cookie. Restricting who may read published
 * content from a browser protects nothing and breaks every legitimate use of it.
 */
function corsHeaders(caller: ApiCaller | null, origin: string | null): HeadersInit {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Api-Key, X-Site-Key",
    "Access-Control-Max-Age": "600",
    Vary: "Origin, Authorization",
  };

  if (caller?.kind === "public") return { ...base, "Access-Control-Allow-Origin": "*" };

  if (!origin) return base;

  if (caller && caller.allowedOrigins.includes(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }

  /* No grant. The browser will discard the response, and the request was
     refused server side anyway. */
  return base;
}

export function apiJson(
  body: unknown,
  init: {
    status?: number;
    caller?: ApiCaller | null;
    origin?: string | null;
    /* Extra response headers, for the routes that meter themselves and want to
       tell an integrator what its remaining allowance is. Merged last but it
       cannot displace the CORS grant, which is computed above from the caller
       rather than accepted from one. */
    headers?: Record<string, string>;
  } = {}
): Response {
  const cors = corsHeaders(init.caller ?? null, init.origin ?? null);
  return Response.json(body, {
    status: init.status ?? 200,
    headers: {
      ...init.headers,
      ...cors,
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
        /* Last, so a refusal that carries Retry-After keeps it. Nothing above
           sets these keys, but ordering the spread this way means that stays
           true if something ever does. */
        ...(failure.headers ?? {}),
      },
    }
  );
}

/**
 * Preflight.
 *
 * A browser sends OPTIONS without the Authorization header, so there is no key
 * to check and no way to know which allowlist applies. What it does carry is
 * Origin, so the honest answer is: grant the preflight if that origin is a
 * verified domain of some site, and otherwise fall back to the public grant if
 * the public API is on at all. The real request that follows carries the key and
 * is authorized properly, against one site, by the code above.
 */
export async function preflight(request: Request): Promise<Response> {
  const origin = normalizeOrigin(request.headers.get("origin") ?? "");
  if (!origin) return new Response(null, { status: 204 });

  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Api-Key, X-Site-Key",
    "Access-Control-Max-Age": "600",
    Vary: "Origin, Authorization",
  };

  const site = await siteByOrigin(origin);
  if (site && site.status === "active") {
    return new Response(null, {
      status: 204,
      headers: { ...base, "Access-Control-Allow-Origin": origin },
    });
  }

  const settings = await readSettings();
  if (settings["api.public_enabled"] === true) {
    return new Response(null, {
      status: 204,
      headers: { ...base, "Access-Control-Allow-Origin": "*" },
    });
  }

  return new Response(null, { status: 204, headers: base });
}
