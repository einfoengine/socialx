import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses row level security entirely.
 *
 * Only for code that legitimately acts outside any user session: Stripe webhook
 * handlers, provisioning, background jobs. It must never be imported by anything
 * that can end up in a client bundle, which is what the `server-only` import above
 * enforces at build time.
 *
 * If you are reaching for this inside a page or a user-triggered action, that is
 * almost always a sign the query belongs in lib/dal with the user's own session.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This client cannot run without it."
    );
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
