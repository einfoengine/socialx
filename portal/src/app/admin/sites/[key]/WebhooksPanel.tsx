"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { WEBHOOK_EVENTS } from "@/lib/core/webhook-events";
import {
  createWebhookAction,
  deleteWebhookAction,
  pingWebhookAction,
  redeliverAction,
  rotateWebhookSecretAction,
  updateWebhookAction,
  type CreateWebhookResult,
  type RotateResult,
} from "../actions";
import { Field, Note, Panel, btnClass, inputClass, quietBtnClass } from "../../settings/ui";
import type { ActionResult } from "../../settings/types";

export type WebhookRow = {
  id: string;
  url: string;
  description: string;
  events: string[];
  active: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  disabledReason: string | null;
};

export type DeliveryRow = {
  id: string;
  webhookId: string;
  event: string;
  status: "pending" | "delivered" | "failed" | "dead";
  attempts: number;
  responseStatus: number | null;
  error: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

/**
 * Where this site is told that something happened.
 *
 * The delivery log at the bottom is not decoration. Webhooks fail on somebody
 * else's server, so the only evidence either side has of what was sent, when, and
 * what came back is this list; without it, "we sent it" and "we never got it" are
 * both unfalsifiable and the conversation goes nowhere.
 */
export default function WebhooksPanel({
  siteId,
  siteKey,
  webhooks,
  deliveries,
  canWrite,
}: {
  siteId: string;
  siteKey: string;
  webhooks: WebhookRow[];
  deliveries: DeliveryRow[];
  canWrite: boolean;
}) {
  const [created, createFn, creating] = useActionState<CreateWebhookResult | null, FormData>(
    createWebhookAction,
    null
  );
  const [pinged, pingFn, pinging] = useActionState<ActionResult | null, FormData>(
    pingWebhookAction,
    null
  );

  return (
    <Panel
      title="Webhooks"
      sub="Events are POSTed as JSON, signed with a per-endpoint secret over the timestamp and the body. Delivery is attempted immediately and retried five times over roughly twelve hours."
    >
      {created?.ok && <SecretBanner secret={created.secret} label="Signing secret" />}

      {canWrite && (
        <form action={createFn} className="mb-6 flex max-w-[620px] flex-col gap-5">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="key" value={siteKey} />

          <Field label="Endpoint URL" hint="https only. Events carry customer email addresses.">
            <input
              name="url"
              required
              placeholder="https://example.com/hooks/portal"
              className={inputClass}
            />
          </Field>

          <Field label="Description" hint="Optional. What listens here.">
            <input name="description" maxLength={200} className={inputClass} />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
              Events
            </legend>
            <p className="mb-1 max-w-[70ch] text-[12px] leading-relaxed text-gray-500">
              Leave every box clear to receive all of them, which is the useful
              default for a new endpoint. Every event listed here is sent by real
              code; there are no names that never fire.
            </p>
            {WEBHOOK_EVENTS.map((event) => (
              <label key={event.name} className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="events"
                  value={event.name}
                  className="mt-1 accent-[#3D4AFF]"
                />
                <span>
                  <code className="font-mono text-[12px] text-gray-900 dark:text-white">
                    {event.name}
                  </code>
                  <span className="block max-w-[70ch] text-[12px] leading-relaxed text-gray-500">
                    {event.help}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={creating} className={btnClass}>
              {creating ? "Adding" : "Add endpoint"}
            </button>
            {created && !created.ok && (
              <p className="text-[12.5px] text-rose-600 dark:text-rose-400">{created.error}</p>
            )}
          </div>
        </form>
      )}

      {webhooks.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          No endpoints. Nothing is sent anywhere, and events that happen are not kept
          for later: an endpoint added tomorrow starts from tomorrow.
        </p>
      ) : (
        <ul className="flex flex-col">
          {webhooks.map((hook) => (
            <WebhookItem key={hook.id} hook={hook} siteKey={siteKey} canWrite={canWrite} />
          ))}
        </ul>
      )}

      {canWrite && webhooks.length > 0 && (
        <form action={pingFn} className="mt-5 flex flex-wrap items-center gap-4">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="key" value={siteKey} />
          <button
            type="submit"
            disabled={pinging}
            className="cursor-pointer border border-black/15 bg-transparent px-3 py-1.5 font-grotesk text-[12px] font-semibold text-gray-700 transition-colors hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/[0.06]"
          >
            {pinging ? "Sending" : "Send a ping"}
          </button>
          {pinged && (
            <p
              className={`text-[12.5px] ${
                pinged.ok
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {pinged.ok ? pinged.message : pinged.error}
            </p>
          )}
        </form>
      )}

      <DeliveryLog deliveries={deliveries} siteId={siteId} siteKey={siteKey} canWrite={canWrite} />

      <Note>
        Verify the signature before trusting a payload. The header is{" "}
        <code className="font-mono text-[11.5px]">X-Webhook-Signature</code>, in the
        form <code className="font-mono text-[11.5px]">t=&lt;unix&gt;,v1=&lt;hex&gt;</code>,
        where the hex is HMAC-SHA256 over{" "}
        <code className="font-mono text-[11.5px]">&lt;t&gt;.&lt;raw body&gt;</code>. Compare
        in constant time and refuse anything more than five minutes old, or a captured
        delivery can be replayed at will.
      </Note>
    </Panel>
  );
}

function WebhookItem({
  hook,
  siteKey,
  canWrite,
}: {
  hook: WebhookRow;
  siteKey: string;
  canWrite: boolean;
}) {
  const [saved, saveFn, saving] = useActionState<ActionResult | null, FormData>(
    updateWebhookAction,
    null
  );
  const [rotated, rotateFn, rotating] = useActionState<RotateResult | null, FormData>(
    rotateWebhookSecretAction,
    null
  );
  const [, deleteFn, deleting] = useActionState<ActionResult | null, FormData>(
    deleteWebhookAction,
    null
  );
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-black/8 py-4 last:border-0 dark:border-white/8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <code className="font-mono text-[12.5px] break-all text-gray-900 dark:text-white">
          {hook.url}
        </code>
        <span
          className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
            hook.active
              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              : "border-rose-500/40 text-rose-600 dark:text-rose-400"
          }`}
        >
          {hook.active ? "active" : "off"}
        </span>
      </div>

      <p className="mt-1 text-[12.5px] text-gray-500">
        {hook.events.length ? hook.events.join(", ") : "every event"}
        {hook.description ? ` · ${hook.description}` : ""}
      </p>

      <p className="mt-0.5 text-[12px] text-gray-400">
        {hook.lastSuccessAt ? `Last accepted ${hook.lastSuccessAt}` : "Never accepted"}
        {hook.consecutiveFailures > 0
          ? ` · ${hook.consecutiveFailures} consecutive ${
              hook.consecutiveFailures === 1 ? "failure" : "failures"
            }`
          : ""}
      </p>

      {hook.disabledReason && (
        <p className="mt-1 max-w-[70ch] text-[12.5px] text-rose-600 dark:text-rose-400">
          {hook.disabledReason}
        </p>
      )}

      {rotated?.ok && <SecretBanner secret={rotated.secret} label="New signing secret" />}

      {canWrite && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {open ? "Close" : "Edit"}
          </button>

          {open && (
            <div className="mt-3 max-w-[620px] border border-black/10 p-4 dark:border-white/10">
              <form action={saveFn} className="flex flex-col gap-4">
                <input type="hidden" name="id" value={hook.id} />
                <input type="hidden" name="key" value={siteKey} />

                <Field label="Description" hint="Optional.">
                  <input
                    name="description"
                    maxLength={200}
                    defaultValue={hook.description}
                    className={inputClass}
                  />
                </Field>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
                    Events
                  </legend>
                  {WEBHOOK_EVENTS.map((event) => (
                    <label key={event.name} className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        name="events"
                        value={event.name}
                        defaultChecked={hook.events.includes(event.name)}
                        className="accent-[#3D4AFF]"
                      />
                      <code className="font-mono text-[12px] text-gray-700 dark:text-gray-300">
                        {event.name}
                      </code>
                    </label>
                  ))}
                </fieldset>

                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={hook.active}
                    className="accent-[#3D4AFF]"
                  />
                  <span className="text-[13px] text-gray-900 dark:text-white">
                    Active. Turning this back on clears the failure count.
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-4">
                  <button type="submit" disabled={saving} className={btnClass}>
                    {saving ? "Saving" : "Save endpoint"}
                  </button>
                  {saved && (
                    <p
                      className={`text-[12.5px] ${
                        saved.ok
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {saved.ok ? saved.message : saved.error}
                    </p>
                  )}
                </div>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-black/8 pt-4 dark:border-white/8">
                <form action={rotateFn}>
                  <input type="hidden" name="id" value={hook.id} />
                  <input type="hidden" name="key" value={siteKey} />
                  <button type="submit" disabled={rotating} className={quietBtnClass}>
                    {rotating ? "Rotating" : "Rotate secret"}
                  </button>
                </form>

                <form action={deleteFn}>
                  <input type="hidden" name="id" value={hook.id} />
                  <input type="hidden" name="key" value={siteKey} />
                  <button type="submit" disabled={deleting} className={quietBtnClass}>
                    {deleting ? "Deleting" : "Delete endpoint"}
                  </button>
                </form>

                <p className="text-[11.5px] text-gray-400">
                  Rotation has no overlap window. The old secret stops working at once.
                </p>
              </div>

              {rotated && !rotated.ok && (
                <p className="mt-2 text-[12.5px] text-rose-600 dark:text-rose-400">
                  {rotated.error}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

function DeliveryLog({
  deliveries,
  siteId,
  siteKey,
  canWrite,
}: {
  deliveries: DeliveryRow[];
  siteId: string;
  siteKey: string;
  canWrite: boolean;
}) {
  if (deliveries.length === 0) return null;

  return (
    <div className="mt-6 border-t border-black/8 pt-5 dark:border-white/8">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400">
        Recent deliveries
      </p>
      <ul className="flex flex-col">
        {deliveries.map((delivery) => (
          <DeliveryItem
            key={delivery.id}
            delivery={delivery}
            siteId={siteId}
            siteKey={siteKey}
            canWrite={canWrite}
          />
        ))}
      </ul>
    </div>
  );
}

function DeliveryItem({
  delivery,
  siteId,
  siteKey,
  canWrite,
}: {
  delivery: DeliveryRow;
  siteId: string;
  siteKey: string;
  canWrite: boolean;
}) {
  const [, retryFn, retrying] = useActionState<ActionResult | null, FormData>(
    redeliverAction,
    null
  );

  const tone =
    delivery.status === "delivered"
      ? "text-emerald-600 dark:text-emerald-400"
      : delivery.status === "dead"
        ? "text-rose-600 dark:text-rose-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <li className="border-b border-black/8 py-2.5 last:border-0 dark:border-white/8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <code className="font-mono text-[12px] text-gray-900 dark:text-white">
          {delivery.event}
        </code>
        <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}>
          {delivery.status}
        </span>
        <span className="font-mono text-[11px] text-gray-400">
          {delivery.createdAt}
          {delivery.attempts > 1 ? ` · ${delivery.attempts} attempts` : ""}
          {delivery.responseStatus ? ` · HTTP ${delivery.responseStatus}` : ""}
        </span>
      </div>

      {delivery.error && (
        <p className="mt-0.5 max-w-[80ch] font-mono text-[11px] break-all text-gray-500">
          {delivery.error}
        </p>
      )}

      {canWrite && delivery.status !== "delivered" && (
        <form action={retryFn} className="mt-1">
          <input type="hidden" name="id" value={delivery.id} />
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="key" value={siteKey} />
          <button type="submit" disabled={retrying} className={quietBtnClass}>
            {retrying ? "Queueing" : "Send again"}
          </button>
        </form>
      )}
    </li>
  );
}

/** A secret that exists in exactly one response, rendered where it cannot be missed. */
function SecretBanner({ secret, label }: { secret: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="my-4 border border-emerald-500/40 bg-emerald-500/[0.07] p-4">
      <p className="font-grotesk text-[13px] font-semibold text-gray-900 dark:text-white">
        {label}. Copy it now, it is not shown again.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <code className="font-mono text-[12.5px] break-all text-gray-900 dark:text-white">
          {secret}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          aria-label="Copy secret"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}
