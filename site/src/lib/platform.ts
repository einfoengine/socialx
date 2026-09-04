import "server-only";

/**
 * The client for /api/v1.
 *
 * This is how a website talks to this platform now: over HTTP, holding a
 * credential, reaching exactly the site that credential belongs to. It is the
 * same door an outside integrator uses, and that is the point of it existing
 * rather than each caller assembling fetches by hand.
 *
 * socialX's own marketing site used to hold SUPABASE_SERVICE_ROLE_KEY and query
 * Postgres directly. That made it a co-owner of the database rather than a
 * consumer of the product, and it meant the API had exactly one consumer that
 * never used it, which is how an API quietly rots. It goes through here now, so
 * every endpoint the site depends on is an endpoint that is exercised on every
 * page load.
 *
 * `server-only` is deliberate and load bearing. The key this holds is a
 * credential with scopes; a browser bundle that contained one would be handing
 * every visitor the ability to create subscriptions. A page that needs data in
 * the browser calls its own origin, and that route calls this. There is no
 * configuration of this module that makes a key safe to ship to a client.
 */

export type PlatformConfig = {
  /** Origin of the console, e.g. https://portal.socialx.studio. No trailing slash. */
  baseUrl: string;
  /**
   * A key minted at /admin/sites. Identifies the site exactly, so no site key is
   * needed alongside it. Without one, only the public read surface is reachable.
   */
  apiKey?: string | null;
  /**
   * Names the site for an unauthenticated read. Ignored when apiKey is set,
   * because the key already answers that question and more precisely.
   */
  siteKey?: string | null;
  /**
   * How long a call may take before it is abandoned. A marketing page must not
   * hang because the console is slow, and a checkout must not hang forever
   * either. Stripe-backed calls take their own longer value below.
   */
  timeoutMs?: number;
};

/** A refusal from the API, carrying the code the API actually returned. */
export class PlatformError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PlatformError";
    this.status = status;
    this.code = code;
  }

  /**
   * True when retrying could plausibly work. A 401 for a revoked key never
   * will; a 503 from a database blip might.
   */
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

const DEFAULT_TIMEOUT = 6_000;
/* Creating a subscription is two or three Stripe round trips behind one request.
   Six seconds would abandon orders that were about to succeed. */
const MONEY_TIMEOUT = 25_000;

export type QuoteInput = {
  plan: string;
  cycle: string;
  code?: string | null;
  noDiscount?: boolean;
  addons?: string[];
};

export type Quote = {
  list_total: number;
  total: number;
  saving: number;
  due_today: number;
  addon_total: number;
  addons: { key: string; name: string; amount: number }[];
  coupon: { code: string; percent_off: number } | null;
  auto_applied: boolean;
  /** A code was typed and did not survive validation. */
  code_rejected: boolean;
};

export type SubscribeInput = QuoteInput & {
  email: string;
  full_name: string;
  company: string;
  phone: string;
};

export type Subscription = {
  client_secret: string;
  subscription_id: string;
  list_total: number;
  total: number;
  due_today: number;
  addons: { key: string; name: string; amount: number }[];
  coupon: { code: string; percent_off: number } | null;
};

export class PlatformClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly siteKey: string | null;
  private readonly timeoutMs: number;

  constructor(config: PlatformConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey?.trim() || null;
    this.siteKey = config.siteKey?.trim() || null;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT;
  }

  /** True when this client can reach anything at all. */
  get configured(): boolean {
    return Boolean(this.baseUrl && (this.apiKey || this.siteKey));
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    else if (this.siteKey) headers["X-Site-Key"] = this.siteKey;
    return headers;
  }

  private async call<T>(
    path: string,
    init: { method?: string; body?: unknown; timeoutMs?: number } = {}
  ): Promise<T> {
    if (!this.configured) {
      throw new PlatformError(
        503,
        "not_configured",
        "No platform credential is set. Fill in PORTAL_API_KEY or PORTAL_SITE_KEY."
      );
    }

    const headers = this.headers();
    if (init.body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        /* Never cached by Next's fetch layer. A price or a client secret served
           from a cache is the one kind of stale this system cannot tolerate;
           callers that want caching wrap this with their own revalidate. */
        cache: "no-store",
        signal: AbortSignal.timeout(init.timeoutMs ?? this.timeoutMs),
      });
    } catch (err) {
      /* A timeout and a refused connection reach here identically, and the
         caller's decision is the same for both: this platform is unreachable
         right now. */
      const reason = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "is unreachable";
      throw new PlatformError(504, "unreachable", `The platform ${reason}.`);
    }

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
      throw new PlatformError(
        response.status,
        error?.code ?? "http_error",
        error?.message ?? `The platform answered ${response.status}.`
      );
    }

    return payload as T;
  }

  /* ---------------- reads ---------------- */

  /** The site's own profile: brand, portal address, support address. */
  site<T = Record<string, unknown>>(): Promise<T> {
    return this.call<T>("/api/v1/site");
  }

  /**
   * One content entry, by key.
   *
   * Throws when the platform is unreachable. Most callers want `contentOr`
   * instead: a marketing page is a live business asset and must keep serving its
   * built-in copy when the console is down.
   */
  content<T>(key: string): Promise<{ key: string; data: T }> {
    return this.call<{ key: string; data: T }>(`/api/v1/content/${encodeURIComponent(key)}`);
  }

  /** One content entry, or the fallback if anything at all goes wrong. */
  async contentOr<T>(key: string, fallback: T): Promise<T> {
    try {
      const entry = await this.content<T>(key);
      return (entry?.data ?? fallback) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * What is for sale.
   *
   * Pass a plan key to get that plan's copy, entitlements, add-ons and the
   * standing discount per cycle, which is everything a checkout screen needs in
   * one call rather than five.
   */
  catalog<T = Record<string, unknown>>(planKey?: string): Promise<T> {
    const query = planKey ? `?plan=${encodeURIComponent(planKey)}` : "";
    return this.call<T>(`/api/v1/catalog${query}`);
  }

  /* ---------------- money ---------------- */

  /** What a basket would cost. Validates a coupon code without redeeming it. */
  quote(input: QuoteInput): Promise<Quote> {
    return this.call<Quote>("/api/v1/checkout/quote", { method: "POST", body: input });
  }

  /**
   * Creates the subscription and returns a client secret for the browser to
   * confirm. Nothing is charged until that confirmation succeeds.
   */
  subscribe(input: SubscribeInput): Promise<Subscription> {
    return this.call<Subscription>("/api/v1/checkout/subscribe", {
      method: "POST",
      body: input,
      timeoutMs: MONEY_TIMEOUT,
    });
  }
}

/**
 * The client for the platform this deployment talks to.
 *
 * Reads the environment once per call rather than at module load, so a missing
 * variable produces a clear PlatformError at the point of use instead of a crash
 * during the build of a page that would have fallen back happily.
 */
export function platform(overrides: Partial<PlatformConfig> = {}): PlatformClient {
  return new PlatformClient({
    baseUrl:
      overrides.baseUrl ??
      process.env.PORTAL_API_URL ??
      process.env.NEXT_PUBLIC_PORTAL_URL ??
      "http://localhost:3001",
    apiKey: overrides.apiKey ?? process.env.PORTAL_API_KEY ?? null,
    siteKey: overrides.siteKey ?? process.env.PORTAL_SITE_KEY ?? null,
    timeoutMs: overrides.timeoutMs,
  });
}
