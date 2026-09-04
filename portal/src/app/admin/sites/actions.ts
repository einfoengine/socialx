"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/core/supabase/service";
import {
  normalizeHost,
  normalizeOrigin,
  VERIFICATION_PATH,
} from "@/lib/core/sites";
import { feedUrlProblem, isBillingSource } from "@/lib/core/payments";
import {
  drain,
  emit,
  isWebhookEvent,
  mintWebhookSecret,
  redeliver,
} from "@/lib/core/webhooks";
import { requirePermission } from "@/lib/dal/permissions";
import { importBillingFeed } from "@/lib/billing/external";
import { ADMIN_SITE_COOKIE, UNASSIGNED_SITE } from "@/lib/sites/admin";
import { mintKey } from "@/lib/api/keys";
import { isScope, type Scope } from "@/lib/api/scopes";
import type { ActionResult } from "../settings/types";

/**
 * Everything an operator does to a site.
 *
 * All of it goes through requirePermission('sites', 'full') first, every time,
 * with no exception for a read that happens to sit in the same file. A server
 * action is a public endpoint that never passes through proxy.ts, so the check on
 * the page that rendered a form proves nothing at all about who posts it.
 *
 * Writes use the service role, which is the same doctrine as coupons, people and
 * settings: RLS is the net underneath the DAL rather than the primary gate, and
 * the sites tables carry no write policy for exactly that reason.
 */

const KEY_RE = /^[a-z0-9][a-z0-9-]{1,38}$/;

function isError(v: unknown): v is { error: string } {
  return typeof v === "object" && v !== null && "error" in v;
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 39);
}

/* ---------------- the site record ---------------- */

export async function createSiteAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requirePermission("sites", "full");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 80) {
    return { ok: false, error: "Give the site a name of 1 to 80 characters." };
  }

  /* The key is offered rather than demanded. Somebody registering a website is
     thinking about the website, not about slugs, and a field they have to fill in
     correctly before anything happens is a field they will fill in badly. */
  const requested = String(formData.get("key") ?? "").trim();
  const key = requested ? slugify(requested) : slugify(name);
  if (!KEY_RE.test(key)) {
    return {
      ok: false,
      error: "That key will not do. Use lowercase letters, digits and hyphens, 2 to 39 characters.",
    };
  }

  const db = createServiceClient();
  const { error } = await db.from("sites").insert({
    key,
    name,
    /* Draft, always. A site that authenticated the moment it was typed in would
       be live before anybody verified a domain or looked at the record, and the
       whole point of the status column is that going live is a decision. */
    status: "draft",
    created_by: session.userId,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `A site already uses the key "${key}". Pick another.` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/sites");
  redirect(`/admin/sites/${key}`);
}

export async function updateSiteAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("sites", "full");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the site." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 80) {
    return { ok: false, error: "A site name is 1 to 80 characters." };
  }

  const status = String(formData.get("status") ?? "draft");
  if (!["draft", "active", "suspended"].includes(status)) {
    return { ok: false, error: "Status is draft, active or suspended." };
  }

  const optionalUrl = (field: string, label: string): string | null | { error: string } => {
    const raw = String(formData.get(field) ?? "").trim();
    if (!raw) return null;
    const origin = normalizeOrigin(raw);
    if (!origin) return { error: `${label} is not a URL. Write it like https://example.com.` };
    return origin;
  };

  const primaryUrl = optionalUrl("primary_url", "The website address");
  if (isError(primaryUrl)) return { ok: false, error: primaryUrl.error };

  const checkoutUrl = optionalUrl("checkout_url", "The checkout address");
  if (isError(checkoutUrl)) return { ok: false, error: checkoutUrl.error };

  const portalHostRaw = String(formData.get("portal_host") ?? "").trim();
  const portalHost = portalHostRaw ? normalizeHost(portalHostRaw) : null;
  if (portalHostRaw && !portalHost) {
    return { ok: false, error: "The portal host is not a hostname. Write it like portal.example.com." };
  }

  const supportEmail = String(formData.get("support_email") ?? "").trim();
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    return { ok: false, error: "That support address is not an email address." };
  }

  /* Brand fields are read leniently and stored as given. What makes that safe is
     that the read path parses defensively: readBrand() drops anything malformed
     rather than rendering it, so a bad hex code is an ignored value and never a
     broken page. Validating hard here as well would only mean a form that
     refuses to save while somebody is midway through typing a color. */
  const brand: Record<string, string> = {};
  for (const field of ["wordmark", "logoUrl", "logoDarkUrl", "faviconUrl", "accent", "accentDark"]) {
    const value = String(formData.get(`brand_${field}`) ?? "").trim();
    if (value) brand[field] = value;
  }

  const db = createServiceClient();
  const { error, count } = await db
    .from("sites")
    .update(
      {
        name,
        legal_name: String(formData.get("legal_name") ?? "").trim() || null,
        status,
        primary_url: primaryUrl,
        checkout_url: checkoutUrl,
        portal_host: portalHost,
        support_email: supportEmail || null,
        brand,
        note: String(formData.get("note") ?? "").trim() || null,
      },
      { count: "exact" }
    )
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Another site already serves that portal host." };
    }
    return { ok: false, error: error.message };
  }
  if (!count) return { ok: false, error: "That site no longer exists." };

  const key = String(formData.get("key") ?? "");
  revalidatePath("/admin/sites");
  if (key) revalidatePath(`/admin/sites/${key}`);

  /* Anyone integrated with this site is told, because the fields on this form are
     exactly the ones another system caches: the support address it prints, the
     checkout it links to, the colors it renders. */
  await emit(id, "site.updated", { key, name, status });
  await drain({ siteId: id });

  return { ok: true, message: `${name} saved.` };
}

/**
 * Switches which site the console is showing.
 *
 * Every screen holding tenant data reads this, so the revalidation is the whole
 * admin tree rather than a list of paths. A list would be a list somebody has to
 * remember to extend, and the failure it produces is the worst kind: a screen
 * quietly serving the previous site's rows from cache while the switcher says
 * otherwise.
 */
export async function selectSiteAction(formData: FormData): Promise<void> {
  await requirePermission("sites");

  const key = String(formData.get("key") ?? "").trim();
  if (key !== UNASSIGNED_SITE && !KEY_RE.test(key)) return;

  const jar = await cookies();
  jar.set(ADMIN_SITE_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/admin", "layout");
}

/* ---------------- domains ---------------- */

/**
 * Registers an origin as claimed but unproven.
 *
 * Nothing about adding a row grants anything. The origin is refused by the API
 * and cannot serve a portal until verifyDomainAction has actually fetched the
 * token from it, which is the property that makes an allowlist worth having: a
 * typo, or somebody else's domain, is a row that never becomes usable rather than
 * an access grant that nobody rechecks.
 */
export async function addDomainAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("sites", "full");

  const siteId = String(formData.get("site_id") ?? "").trim();
  if (!siteId) return { ok: false, error: "Missing the site." };

  const origin = normalizeOrigin(String(formData.get("origin") ?? ""));
  if (!origin) {
    return {
      ok: false,
      error: "That is not an origin. Write it like https://example.com, with no path and no wildcard.",
    };
  }

  const purpose = String(formData.get("purpose") ?? "browser");
  if (purpose !== "browser" && purpose !== "portal") {
    return { ok: false, error: "A domain is either for the browser API or for the portal." };
  }

  if (!isFetchableOrigin(origin)) {
    return {
      ok: false,
      error: "Use https for anything that is not localhost. Verification will not run over plain http.",
    };
  }

  const db = createServiceClient();
  const { error } = await db.from("site_domains").insert({
    site_id: siteId,
    origin,
    purpose,
    verification_token: randomBytes(16).toString("hex"),
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `${origin} is already registered, here or to another site.` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return { ok: true, message: `${origin} added. Publish the token, then verify it.` };
}

/**
 * Fetches the token from the origin claiming to own it.
 *
 * Two things about this request are load bearing and neither is obvious.
 *
 * It does not follow redirects. A 302 to somewhere else means the token would be
 * read from a host that is not the one being verified, which is precisely the
 * hole this check exists to close.
 *
 * It reads a bounded amount and compares exactly. An endpoint that returns a
 * generous 200 with an HTML error page for every path is common, and a check that
 * merely looked for the token inside the body would pass on any site that
 * happened to echo the URL back.
 */
export async function verifyDomainAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("sites", "full");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the domain." };

  const db = createServiceClient();
  const { data } = await db
    .from("site_domains")
    .select("id, origin, verification_token")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { ok: false, error: "That domain no longer exists." };

  const origin = data.origin as string;
  const token = data.verification_token as string;
  const now = new Date().toISOString();

  const fail = async (reason: string): Promise<ActionResult> => {
    await db
      .from("site_domains")
      .update({ verified_at: null, last_checked_at: now, last_error: reason })
      .eq("id", id);
    revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
    return { ok: false, error: reason };
  };

  if (!isFetchableOrigin(origin)) {
    return fail("Verification only runs over https, except on localhost.");
  }

  let body: string;
  try {
    const response = await fetch(`${origin}${VERIFICATION_PATH}`, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Portal-Verification/1" },
    });

    if (response.status >= 300 && response.status < 400) {
      return fail("That URL redirects. Serve the token at the address itself, with no redirect.");
    }
    if (!response.ok) {
      return fail(`${origin}${VERIFICATION_PATH} answered ${response.status}.`);
    }

    /* A token is 32 characters. Anything sending kilobytes is sending something
       else, and reading all of it is somebody else deciding how much memory this
       action uses. */
    body = (await response.text()).slice(0, 1024);
  } catch (error) {
    const message = error instanceof Error ? error.message : "the request failed";
    return fail(`Could not reach ${origin}${VERIFICATION_PATH}: ${message}`);
  }

  if (body.trim() !== token) {
    return fail("That file does not contain this domain's token, exactly and on its own.");
  }

  await db
    .from("site_domains")
    .update({ verified_at: now, last_checked_at: now, last_error: null })
    .eq("id", id);

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return { ok: true, message: `${origin} verified.` };
}

export async function removeDomainAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("sites", "full");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the domain." };

  const db = createServiceClient();
  const { error } = await db.from("site_domains").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return {
    ok: true,
    message: "Domain removed. Any key still naming it is now refused from the browser.",
  };
}

/**
 * Whether this platform is willing to make a verification request to an origin.
 *
 * https everywhere except loopback, and loopback is allowed because a developer
 * wiring an integration up locally is a real case and there is nothing to protect
 * on their own machine. Everything else over plain http is refused: the token
 * would cross the network in the clear and so would the answer.
 */
function isFetchableOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

/* ---------------- credentials ---------------- */

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

export type CreateKeyResult =
  | { ok: true; message: string; token: string; prefix: string }
  | { ok: false; error: string };

/**
 * Issues a credential for one site.
 *
 * The secret is generated here, hashed, and the hash is what is stored; the plain
 * token exists in exactly one server action response and is then gone. There is
 * no endpoint that reveals it again, no admin override, and no support path. That
 * is the property that makes this table safe to hold.
 *
 * Origins offered on the form are only the site's verified ones, and that is not
 * merely a convenience. A key can only ever be used from an origin the site has
 * proved it controls, so offering anything else would be offering a setting that
 * does not work.
 */
export async function createKeyAction(
  _prev: CreateKeyResult | null,
  formData: FormData
): Promise<CreateKeyResult> {
  const session = await requirePermission("sites", "full");

  const siteId = String(formData.get("site_id") ?? "").trim();
  if (!siteId) return { ok: false, error: "Missing the site." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "Give the key a name of 2 to 80 characters. Name what uses it." };
  }

  const scopes = readScopes(formData.getAll("scopes"));
  if (isError(scopes)) return { ok: false, error: scopes.error };

  const origins = formData
    .getAll("origins")
    .map((value) => normalizeOrigin(String(value)))
    .filter((value): value is string => Boolean(value));

  const db = createServiceClient();

  if (origins.length > 0) {
    const { data: verified } = await db
      .from("site_domains")
      .select("origin")
      .eq("site_id", siteId)
      .not("verified_at", "is", null)
      .in("origin", origins);

    const allowed = new Set((verified ?? []).map((row) => row.origin as string));
    const rejected = origins.filter((origin) => !allowed.has(origin));
    if (rejected.length) {
      return {
        ok: false,
        error: `${rejected.join(", ")} is not a verified domain of this site.`,
      };
    }
  }

  /* An expiry in days rather than a date, because the question somebody is
     actually answering is "how long should this live", and 0 for never is the one
     case a date picker handles badly. */
  const days = Number(String(formData.get("expires_days") ?? "0").trim());
  if (!Number.isInteger(days) || days < 0 || days > 3650) {
    return { ok: false, error: "Expiry is a whole number of days, up to 3650. Use 0 for no expiry." };
  }

  const environment = String(formData.get("environment") ?? "live");
  if (environment !== "live" && environment !== "test") {
    return { ok: false, error: "Pick live or test." };
  }

  const minted = mintKey(environment);

  const { error } = await db.from("api_keys").insert({
    site_id: siteId,
    name,
    prefix: minted.prefix,
    token_hash: minted.tokenHash,
    scopes,
    allowed_origins: origins,
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: session.userId,
    expires_at: days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return {
    ok: true,
    prefix: minted.prefix,
    token: minted.token,
    message: "Key created. Copy it now, it is not shown again.",
  };
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
  await requirePermission("sites", "full");

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

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return { ok: true, message: "Key revoked. Anything still using it is now getting a 401." };
}

/* ---------------- webhooks ---------------- */

export type CreateWebhookResult =
  | { ok: true; message: string; secret: string }
  | { ok: false; error: string };

function readEvents(values: FormDataEntryValue[]): string[] | { error: string } {
  const out: string[] = [];
  for (const value of values) {
    const text = String(value);
    if (!isWebhookEvent(text)) return { error: `"${text}" is not an event this platform sends.` };
    if (!out.includes(text)) out.push(text);
  }
  return out;
}

export async function createWebhookAction(
  _prev: CreateWebhookResult | null,
  formData: FormData
): Promise<CreateWebhookResult> {
  const session = await requirePermission("sites", "full");

  const siteId = String(formData.get("site_id") ?? "").trim();
  if (!siteId) return { ok: false, error: "Missing the site." };

  const url = String(formData.get("url") ?? "").trim();
  if (!/^https:\/\/.+/.test(url)) {
    return {
      ok: false,
      error: "An endpoint is an https URL. Events carry customer email addresses and will not be sent in the clear.",
    };
  }
  try {
    new URL(url);
  } catch {
    return { ok: false, error: "That is not a URL." };
  }

  const events = readEvents(formData.getAll("events"));
  if (isError(events)) return { ok: false, error: events.error };

  const secret = mintWebhookSecret();

  const db = createServiceClient();
  const { error } = await db.from("site_webhooks").insert({
    site_id: siteId,
    url,
    events,
    secret,
    description: String(formData.get("description") ?? "").trim() || null,
    created_by: session.userId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return {
    ok: true,
    secret,
    message: "Endpoint added. Copy the signing secret now; it is shown here once.",
  };
}

export async function updateWebhookAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("sites", "full");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the endpoint." };

  const events = readEvents(formData.getAll("events"));
  if (isError(events)) return { ok: false, error: events.error };

  const active = formData.get("active") === "on";

  const db = createServiceClient();
  const { error, count } = await db
    .from("site_webhooks")
    .update(
      {
        events,
        active,
        description: String(formData.get("description") ?? "").trim() || null,
        /* Re-enabling clears both the counter and the explanation. Leaving a
           stale "switched off after 20 failures" on a working endpoint is how a
           screen starts lying about the present. */
        ...(active ? { consecutive_failures: 0, disabled_reason: null } : {}),
      },
      { count: "exact" }
    )
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "That endpoint no longer exists." };

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return { ok: true, message: active ? "Endpoint saved." : "Endpoint saved and switched off." };
}

export type RotateResult = { ok: true; message: string; secret: string } | { ok: false; error: string };

/**
 * Replaces the signing secret.
 *
 * There is no overlap window, and that is a real trade rather than an oversight:
 * supporting two live secrets means every delivery signed twice and a receiver
 * that has to be told which is which. Rotation is therefore a coordinated change,
 * and the screen says so. What it buys is that a leaked secret stops working the
 * moment somebody decides it should.
 */
export async function rotateWebhookSecretAction(
  _prev: RotateResult | null,
  formData: FormData
): Promise<RotateResult> {
  await requirePermission("sites", "full");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the endpoint." };

  const secret = mintWebhookSecret();

  const db = createServiceClient();
  const { error, count } = await db
    .from("site_webhooks")
    .update({ secret }, { count: "exact" })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "That endpoint no longer exists." };

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return {
    ok: true,
    secret,
    message: "Rotated. The old secret stopped working immediately, so update the receiver now.",
  };
}

export async function deleteWebhookAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("sites", "full");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the endpoint." };

  const db = createServiceClient();
  const { error } = await db.from("site_webhooks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return { ok: true, message: "Endpoint deleted, along with its delivery history." };
}

/** Sends a ping, which is the only event that exists to be sent by hand. */
export async function pingWebhookAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("sites", "full");

  const siteId = String(formData.get("site_id") ?? "").trim();
  if (!siteId) return { ok: false, error: "Missing the site." };

  const { queued } = await emit(siteId, "ping", { sent_at: new Date().toISOString() });
  if (!queued) {
    return {
      ok: false,
      error: "Nothing to send to. Add an active endpoint that accepts the ping event.",
    };
  }

  const result = await drain({ siteId });

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return result.delivered > 0
    ? { ok: true, message: `Ping accepted by ${result.delivered} of ${queued}.` }
    : { ok: true, message: `Ping queued to ${queued}. Nothing accepted it yet; see the log below.` };
}

export async function redeliverAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("sites", "full");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the delivery." };

  const queued = await redeliver(id);
  if (!queued) return { ok: false, error: "That delivery could not be queued again." };

  const siteId = String(formData.get("site_id") ?? "").trim();
  if (siteId) await drain({ siteId });

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);
  return { ok: true, message: "Queued again as a new delivery." };
}

/* ---------------- payments ---------------- */

/**
 * Who collects this site's money, and where its billing is fetched from.
 *
 * Its own action rather than three more fields on SiteForm, because saving the
 * site record emits site.updated to every endpoint the site has wired up, and
 * these fields are not that. A feed address and the secret it is fetched with
 * are this platform's side of the arrangement; broadcasting them to an
 * integrator's handlers would be telling them a secret they gave us.
 *
 * The secret is write-only in both directions. It is never selected by the page
 * that renders this form, and an empty box means "leave it as it is" rather than
 * "clear it", because a form that silently wiped a credential every time
 * somebody corrected a URL would be unusable. Clearing is its own checkbox.
 */
export async function updatePaymentsAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("sites", "full");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the site." };

  const collection = String(formData.get("payment_collection") ?? "platform");
  if (!isBillingSource(collection)) {
    return { ok: false, error: "Payments are collected either by this platform or by the site." };
  }

  const feedUrl = String(formData.get("billing_feed_url") ?? "").trim();
  if (feedUrl) {
    const problem = feedUrlProblem(feedUrl);
    if (problem) return { ok: false, error: problem };
  }

  const header = String(formData.get("billing_feed_header") ?? "").trim() || "Authorization";
  /* A header name, not a header line. Anything with a colon, a space or a
     control character in it is somebody pasting "Authorization: Bearer x" into
     the wrong box, and sending it would produce a request no server accepts. */
  if (!/^[A-Za-z0-9-]{1,64}$/.test(header)) {
    return {
      ok: false,
      error: "A header name is letters, digits and hyphens. Put the value itself in the field below.",
    };
  }

  const manageUrl = String(formData.get("billing_manage_url") ?? "").trim();
  if (manageUrl && !/^https:\/\//.test(manageUrl)) {
    return { ok: false, error: "The management address has to be https. Clients open it from the portal." };
  }

  /* External with nowhere to fetch from is a site whose clients see nothing and
     whose operator has no way to know why. Refused here rather than left to be
     discovered later by whoever answers the support message. */
  if (collection === "external" && !feedUrl) {
    return {
      ok: false,
      error: "A site that collects its own payments needs a feed address, or the portal has nothing to show its clients.",
    };
  }

  const update: Record<string, unknown> = {
    payment_collection: collection,
    billing_feed_url: feedUrl || null,
    billing_feed_header: header,
    billing_manage_url: manageUrl || null,
  };

  const secret = String(formData.get("billing_feed_secret") ?? "").trim();
  if (formData.get("clear_secret") === "on") update.billing_feed_secret = null;
  else if (secret) update.billing_feed_secret = secret;

  const db = createServiceClient();
  const { error, count } = await db
    .from("sites")
    .update(update, { count: "exact" })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "That site no longer exists." };

  const key = String(formData.get("key") ?? "");
  if (key) revalidatePath(`/admin/sites/${key}`);
  revalidatePath("/admin/settings/billing");

  return {
    ok: true,
    message:
      collection === "external"
        ? "Saved. Fetch the feed below to see what comes back."
        : "Saved. This site's clients are billed by the platform.",
  };
}

/**
 * Fetches the feed now.
 *
 * The same import the scheduler runs, on the same code path, so what an operator
 * sees when they press this is what will happen at three in the morning. A
 * separate "test" that validated without writing would be a second
 * implementation, and the one somebody trusts would be the one that never runs.
 */
export async function fetchBillingAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requirePermission("sites", "full");

  const siteId = String(formData.get("site_id") ?? "").trim();
  if (!siteId) return { ok: false, error: "Missing the site." };

  const summary = await importBillingFeed({
    siteId,
    kind: "operator",
    triggeredBy: session.userId,
  });

  revalidatePath(`/admin/sites/${String(formData.get("key") ?? "")}`);

  if (!summary.ok) return { ok: false, error: summary.error ?? "The feed could not be read." };

  const parts = [
    `${summary.subscriptionsWritten} of ${summary.subscriptionsSeen} subscriptions`,
    `${summary.invoicesWritten} of ${summary.invoicesSeen} invoices`,
  ];
  /* The skipped count is in the message rather than only in the panel below,
     because "imported" and "imported, and left eleven clients out" should not
     read identically at a glance. */
  const skipped = summary.skipped ? `, ${summary.skipped} skipped` : "";

  return { ok: true, message: `Fetched ${parts.join(" and ")}${skipped}.` };
}
