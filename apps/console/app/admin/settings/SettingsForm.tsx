"use client";

import { useActionState } from "react";
import { saveGeneralAction } from "./actions";
import Feedback from "./Feedback";
import type { ActionResult } from "./types";
import { Field, btnClass, inputClass } from "./ui";

/**
 * One form for any group of declared settings.
 *
 * The fields are rendered from lib/settings.ts rather than written out, so
 * adding a setting is a single entry in that file and this screen picks it up.
 * The same component serves General and Public API, which is why the group name
 * is posted: the action writes only the keys belonging to the group that sent
 * them, so a form that does not include a key can never be read as clearing it.
 */

export type FieldDef = {
  key: string;
  label: string;
  help: string;
  kind: "string" | "number" | "boolean" | "origins";
};

export default function SettingsForm({
  group,
  fields,
  values,
  canWrite,
  submitLabel = "Save settings",
}: {
  group: string;
  fields: FieldDef[];
  values: Record<string, unknown>;
  canWrite: boolean;
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveGeneralAction,
    null
  );

  return (
    <form action={action} className="flex max-w-[620px] flex-col gap-5">
      <input type="hidden" name="group" value={group} />

      {fields.map((f) => {
        const value = values[f.key];

        if (f.kind === "boolean") {
          return (
            <label key={f.key} className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name={f.key}
                defaultChecked={value === true}
                disabled={!canWrite}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#2B50DC] disabled:cursor-not-allowed disabled:opacity-55"
              />
              <span>
                <span className="block font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
                  {f.label}
                </span>
                <span className="mt-0.5 block max-w-[70ch] text-[11.5px] leading-relaxed text-gray-500">
                  {f.help}
                </span>
              </span>
            </label>
          );
        }

        if (f.kind === "origins") {
          const list = Array.isArray(value) ? (value as string[]) : [];
          return (
            <Field key={f.key} label={f.label} hint={f.help}>
              <textarea
                name={f.key}
                defaultValue={list.join("\n")}
                disabled={!canWrite}
                spellCheck={false}
                rows={4}
                placeholder="https://socialx.studio"
                className={`${inputClass} font-mono text-[12.5px] leading-relaxed`}
              />
            </Field>
          );
        }

        return (
          <Field key={f.key} label={f.label} hint={f.help}>
            <input
              name={f.key}
              type={f.kind === "number" ? "number" : "text"}
              defaultValue={String(value ?? "")}
              disabled={!canWrite}
              className={inputClass}
            />
          </Field>
        );
      })}

      {canWrite && (
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={btnClass}>
            {pending ? "Saving" : submitLabel}
          </button>
          <Feedback result={state} />
        </div>
      )}
    </form>
  );
}
