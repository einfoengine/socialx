/**
 * The event vocabulary.
 *
 * Deliberately not in webhooks.ts, which is server-only because it holds the
 * signing material and the delivery loop. The vocabulary itself is not a secret
 * and the console has to render it, so it lives on its own where a client
 * component can import it without dragging node:crypto into the browser bundle.
 * Same split, for the same reason, as scopes.ts against keys.ts.
 *
 * Every name here is emitted by real code in this repo. That is a rule rather
 * than an observation: an integrator who filters on an event that never fires has
 * built a feature that silently does nothing, and they will blame their own
 * handler for weeks. Adding a name to this list and wiring it are one change.
 */

export const WEBHOOK_EVENTS = [
  {
    name: "ping",
    help: "Sent by hand from the console. Carries no data and means only that this endpoint is reachable and your signature check works.",
  },
  {
    name: "site.updated",
    help: "The site record changed: brand, portal host, support address, checkout URL or status.",
  },
  {
    name: "content.updated",
    help: "A content entry was written, from the console or through PUT /api/v1/content/{key}.",
  },
  {
    name: "order.created",
    help: "A subscription was paid for and provisioned. Carries the organization, the plan and the billing cycle.",
  },
  {
    name: "subscription.updated",
    help: "An existing subscription changed status, period or cancellation state.",
  },
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]["name"];

export const WEBHOOK_EVENT_NAMES = WEBHOOK_EVENTS.map((e) => e.name);

export function isWebhookEvent(value: string): value is WebhookEvent {
  return (WEBHOOK_EVENT_NAMES as readonly string[]).includes(value);
}
