"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/dal/permissions";
import { createServiceClient } from "@socialx/core/supabase/service";
import { DEFINITIONS, normalizeOrigin, type SettingDef } from "@/lib/settings";
import type { ActionResult } from "./types";

/**
 * Writes for the settings that used to be seed files.
 *
 * All four follow the same doctrine as coupons, people and website: the gate is
 * requirePermission("settings","full") re-checked inside every action, and the
 * write itself uses the service role, so RLS carries no write policy for these
 * tables at all. A server action is a public endpoint that never passes through
 * proxy.ts, so the check on the page that rendered the form proves nothing about
 * who posts it.
 *
 * What changed in kind: this screen used to say "read only by design", and the
 * design it referred to was that these values are the contract delivery reads,
 * so an accidental edit is a production incident rather than a typo. That is a
 * real risk and it is answered here by narrowing what can be written rather than
 * by refusing writes. Nothing below can create or delete a plan, a rate card or
 * a pillar. Each one edits the columns of rows that already exist, so the shape
 * of the offer stays a migration and only its numbers are a form.
 */

/* ---------------- general ---------------- */

/** Parses one posted field against its declaration. */
function readValue(def: SettingDef, raw: FormDataEntryValue | null): unknown | { error: string } {
  switch (def.kind) {
    case "string": {
      const text = String(raw ?? "").trim();
      if (!text) return { error: `${def.label} cannot be empty.` };
      if (text.length > 200) return { error: `${def.label} is capped at 200 characters.` };
      return text;
    }
    case "number": {
      const n = Number(String(raw ?? "").trim());
      if (!Number.isFinite(n)) return { error: `${def.label} has to be a number.` };
      if (n < 0 || n > 100000) return { error: `${def.label} is out of range.` };
      return n;
    }
    case "boolean":
      /* An unchecked box posts nothing at all, so absence is false rather than
         missing. Every boolean is present in the form, so this is safe. */
      return raw === "on" || raw === "true";
    case "origins": {
      const lines = String(raw ?? "")
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const out: string[] = [];
      for (const line of lines) {
        /* Called out separately because it is the mistake somebody makes on
           purpose: * reads as "allow everything", and the way to say that here
           is an empty list. */
        if (line.includes("*")) {
          return {
            error:
              "Wildcards are not accepted. Name each domain, or leave this empty to allow any origin.",
          };
        }
        const origin = normalizeOrigin(line);
        if (!origin) {
          return { error: `"${line}" is not a domain. Write it like https://socialx.studio.` };
        }
        if (!out.includes(origin)) out.push(origin);
      }
      if (out.length > 50) return { error: "That is more origins than one setting should carry." };
      return out;
    }
  }
}

function isError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

export async function saveGeneralAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requirePermission("settings", "full");

  /* Which group posted. The General screen and the Public API screen both write
     app_settings, and each should only be able to write its own fields: a form
     that omits a key must not be read as "set it to empty". */
  const group = String(formData.get("group") ?? "");
  const defs = DEFINITIONS.filter((d) => d.group === group);
  if (defs.length === 0) return { ok: false, error: "Nothing to save." };

  const rows: { key: string; value: unknown; updated_by: string; updated_at: string }[] = [];
  const now = new Date().toISOString();

  for (const def of defs) {
    const parsed = readValue(def, formData.get(def.key));
    if (isError(parsed)) return { ok: false, error: parsed.error };
    rows.push({ key: def.key, value: parsed, updated_by: session.userId, updated_at: now });
  }

  const db = createServiceClient();
  const { error } = await db.from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings", "layout");
  return { ok: true, message: `${group} settings saved.` };
}

/* ---------------- plans ---------------- */

const CUSTOMIZATION = ["light", "heavy", "bespoke"];

export async function savePlansAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("settings", "full");

  const planIds = formData.getAll("plan_id").map(String);
  if (planIds.length === 0) return { ok: false, error: "Nothing to save." };

  const db = createServiceClient();

  for (const id of planIds) {
    const int = (field: string) => Number(String(formData.get(`${id}.${field}`) ?? "").trim());

    const posts = int("posts_per_month");
    const motion = int("motion_videos");
    const platforms = int("platforms_max");
    const firstBatch = int("first_batch_days");

    for (const [label, value] of [
      ["Posts", posts],
      ["Motion videos", motion],
      ["Platforms", platforms],
      ["First batch days", firstBatch],
    ] as const) {
      if (!Number.isInteger(value) || value < 0 || value > 1000) {
        return { ok: false, error: `${label} has to be a whole number from 0 to 1000.` };
      }
    }

    /*
     * Unlimited is null, never a big number. The revision loop reads this column
     * directly, and a 999 here would mean the portal counts down from 999 on a
     * Scale batch instead of saying unlimited. The checkbox is the only way to
     * write null, which is why it is a checkbox rather than an empty field: an
     * empty field and a zero look the same to somebody tabbing through.
     */
    const unlimited = formData.get(`${id}.revisions_unlimited`) === "on";
    let revisions: number | null = null;
    if (!unlimited) {
      revisions = int("revision_rounds");
      if (!Number.isInteger(revisions) || revisions < 0 || revisions > 100) {
        return { ok: false, error: "Revision rounds has to be a whole number, or unlimited." };
      }
    }

    const customization = String(formData.get(`${id}.customization_level`) ?? "");
    if (!CUSTOMIZATION.includes(customization)) {
      return { ok: false, error: `"${customization}" is not a customization level.` };
    }

    const { error } = await db
      .from("plan_entitlements")
      .update({
        posts_per_month: posts,
        motion_videos: motion,
        platforms_max: platforms,
        revision_rounds: revisions,
        first_batch_days: firstBatch,
        customization_level: customization,
        monthly_call: formData.get(`${id}.monthly_call`) === "on",
      })
      .eq("plan_id", id);

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/settings/plans");
  return {
    ok: true,
    message:
      "Entitlements saved. Batches already in production keep the numbers they were created with.",
  };
}

/* ---------------- rate cards ---------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveRateCardsAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("settings", "full");

  const keys = formData.getAll("card_key").map(String);
  if (keys.length === 0) return { ok: false, error: "Nothing to save." };

  const db = createServiceClient();

  for (const key of keys) {
    const readDate = (field: string): string | null | { error: string } => {
      const raw = String(formData.get(`${key}.${field}`) ?? "").trim();
      if (!raw) return null;
      if (!DATE_RE.test(raw)) return { error: `"${raw}" is not a date.` };
      return raw;
    };

    const from = readDate("active_from");
    if (isError(from)) return { ok: false, error: from.error };
    const to = readDate("active_to");
    if (isError(to)) return { ok: false, error: to.error };

    if (from && to && to < from) {
      return { ok: false, error: `${key} ends before it starts.` };
    }

    const { error } = await db
      .from("rate_cards")
      .update({
        is_active: formData.get(`${key}.is_active`) === "on",
        active_from: from,
        active_to: to,
      })
      .eq("key", key);

    if (error) return { ok: false, error: error.message };
  }

  /* Pricing is rendered on the marketing site and on every checkout link, so the
     stale copy is not only this screen. */
  revalidatePath("/admin/settings/rate-cards");
  revalidatePath("/admin/packages");
  return {
    ok: true,
    message: "Rate cards saved. Checkout resolves the highest sorted active card whose window covers today.",
  };
}

/* ---------------- pillars ---------------- */

export async function savePillarsAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("settings", "full");

  const keys = formData.getAll("pillar_key").map(String);
  if (keys.length === 0) return { ok: false, error: "Nothing to save." };

  const rows: { key: string; pct: number }[] = [];
  for (const key of keys) {
    const pct = Number(String(formData.get(`${key}.mix`) ?? "").trim());
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      return { ok: false, error: "Each pillar is a whole percentage from 0 to 100." };
    }
    rows.push({ key, pct });
  }

  /*
   * The mix has to total 100, and this is the one place that can enforce it. A
   * batch built from a mix summing to 90 quietly under-fills, and nobody finds
   * out until the month is short. The form shows a running total for the same
   * reason; this is the check that actually holds.
   */
  const total = rows.reduce((sum, r) => sum + r.pct, 0);
  if (total !== 100) {
    return { ok: false, error: `The mix totals ${total}%. It has to be exactly 100%.` };
  }

  const db = createServiceClient();
  for (const row of rows) {
    const { error } = await db
      .from("pillars")
      .update({ default_mix_pct: row.pct })
      .eq("key", row.key);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/settings/pillars");
  return { ok: true, message: "Pillar mix saved." };
}
