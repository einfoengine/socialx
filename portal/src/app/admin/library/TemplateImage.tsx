"use client";

import { useActionState, useState } from "react";
import {
  attachLibraryAsset,
  attachUrlAsset,
  clearVersionImage,
  uploadAsset,
  type ImageResult,
} from "./image-actions";

/**
 * The design on a template version: what it is, and the three ways to change it.
 *
 * The preview is the larger half of the layout on purpose. This screen is where
 * somebody checks that the artwork still matches the copy after a HighLevel
 * change, and a thumbnail is not enough to answer that. Editing is the smaller
 * column beside it.
 *
 * Three tabs rather than three stacked forms, because they are alternatives and
 * a stack reads as a sequence. Which one opens first is the one most likely to
 * be wanted: upload when there is no image yet, the library when there is, since
 * replacing usually means swapping to something already made.
 */

export type LibraryAsset = {
  id: string;
  url: string;
  alt: string | null;
  provider: string;
  isBroken: boolean;
};

export type CurrentImage = {
  assetId: string;
  url: string;
  alt: string | null;
  provider: string;
  mime: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  isBroken: boolean;
};

type Tab = "upload" | "link" | "library";

const INPUT =
  "w-full border border-black/15 bg-transparent px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#2B50DC] focus:outline-hidden dark:border-white/15 dark:text-white dark:placeholder-gray-600";

export default function TemplateImage({
  templateId,
  versionId,
  version,
  current,
  library,
  canWrite,
  schemaReady,
}: {
  templateId: string;
  versionId: string | null;
  version: number;
  current: CurrentImage | null;
  library: LibraryAsset[];
  canWrite: boolean;
  /* False until migration 0025 adds template_versions.asset_id. Everything else
     on the page still works without it, so this panel is the only thing that has
     to say so. */
  schemaReady: boolean;
}) {
  const [tab, setTab] = useState<Tab>(current ? "library" : "upload");

  const [uploadState, uploadFn, uploading] = useActionState<ImageResult | null, FormData>(
    uploadAsset,
    null
  );
  const [linkState, linkFn, linking] = useActionState<ImageResult | null, FormData>(
    attachUrlAsset,
    null
  );
  const [pickState, pickFn, picking] = useActionState<ImageResult | null, FormData>(
    attachLibraryAsset,
    null
  );
  const [clearState, clearFn] = useActionState<ImageResult | null, FormData>(
    clearVersionImage,
    null
  );

  const result = uploadState ?? linkState ?? pickState ?? clearState;

  if (!schemaReady) {
    return (
      <Frame>
        <div className="m-5 border border-amber-500/40 bg-amber-500/10 p-5 text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-300">
          <strong className="text-gray-900 dark:text-white">One-time setup needed.</strong>{" "}
          Template versions have no design column yet. Run{" "}
          <code className="font-mono text-[12.5px]">pnpm db:migrate</code> from the repo
          root to apply migration 0025, then reload this page. Nothing else on this
          screen is affected.
        </div>
      </Frame>
    );
  }

  /* A version has to exist before anything can hang off it. A template always
     gets v1 at creation, so this is the empty database case rather than a state
     somebody reaches by using the product. */
  if (!versionId) {
    return (
      <Frame>
        <p className="p-5 text-[13.5px] text-gray-500 dark:text-gray-400">
          This template has no version yet, so there is nothing to attach a design
          to. Save a version first.
        </p>
      </Frame>
    );
  }

  const hidden = (
    <>
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="version_id" value={versionId} />
    </>
  );

  return (
    <Frame>
      <div className="flex flex-col gap-6 p-5 md:flex-row">
        {/* ---- the design itself ---- */}
        <div className="md:w-[300px] md:shrink-0">
          <Preview current={current} />

          {current && (
            <dl className="mt-3 flex flex-col gap-1 text-[11.5px]">
              <Meta label="Source">{sourceLabel(current.provider)}</Meta>
              {current.width && current.height && (
                <Meta label="Size">
                  {current.width} x {current.height}
                  {current.bytes ? `, ${formatBytes(current.bytes)}` : ""}
                </Meta>
              )}
              {!current.width && current.bytes && (
                <Meta label="Size">{formatBytes(current.bytes)}</Meta>
              )}
              {current.alt && <Meta label="Alt">{current.alt}</Meta>}
            </dl>
          )}

          {canWrite && current && (
            <form action={clearFn} className="mt-3">
              {hidden}
              <button
                onClick={(e) => {
                  if (!confirm("Remove the image from this version? The file itself is kept.")) {
                    e.preventDefault();
                  }
                }}
                className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 transition-colors hover:text-rose-500"
              >
                Remove image
              </button>
            </form>
          )}
        </div>

        {/* ---- the ways to change it ---- */}
        {canWrite ? (
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap border-b border-black/10 dark:border-white/10">
              <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
                Upload
              </TabButton>
              <TabButton active={tab === "link"} onClick={() => setTab("link")}>
                Link
              </TabButton>
              <TabButton active={tab === "library"} onClick={() => setTab("library")}>
                From library
                <span className="ml-1.5 font-mono text-[10px] text-gray-400">{library.length}</span>
              </TabButton>
            </div>

            {tab === "upload" && (
              <form action={uploadFn} className="flex flex-col gap-3">
                {hidden}
                <label className="flex flex-col gap-1.5">
                  <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
                    File
                  </span>
                  <span className="-mt-1 text-[11.5px] leading-relaxed text-gray-500">
                    PNG, JPEG, WebP, AVIF, GIF or MP4, up to 8MB. Stored privately in
                    Supabase and served through a signed link, so it never becomes a
                    public URL.
                  </span>
                  <input
                    type="file"
                    name="file"
                    required
                    accept="image/png,image/jpeg,image/webp,image/avif,image/gif,video/mp4"
                    className="w-full text-[12.5px] text-gray-600 file:mr-3 file:cursor-pointer file:border file:border-black/15 file:bg-transparent file:px-3 file:py-1.5 file:font-grotesk file:text-[12px] file:font-semibold file:text-gray-800 dark:text-gray-400 dark:file:border-white/15 dark:file:text-gray-200"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
                    Alt text
                  </span>
                  <span className="-mt-1 text-[11.5px] leading-relaxed text-gray-500">
                    Optional. Defaults to the filename, which is rarely what anyone
                    wants read aloud.
                  </span>
                  <input name="alt" className={INPUT} />
                </label>
                <Submit pending={uploading} label="Upload and attach" />
              </form>
            )}

            {tab === "link" && (
              <form action={linkFn} className="flex flex-col gap-3">
                {hidden}
                <label className="flex flex-col gap-1.5">
                  <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
                    Image URL
                  </span>
                  <span className="-mt-1 max-w-[62ch] text-[11.5px] leading-relaxed text-gray-500">
                    https only. The platform stores the link rather than the bytes, so this
                    stays somebody else&apos;s uptime; the link checker flags it if it stops
                    resolving.
                  </span>
                  <input
                    name="url"
                    type="url"
                    required
                    placeholder="https://assets.cdn.filesafe.space/..."
                    className={INPUT}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
                    Alt text
                  </span>
                  <input name="alt" className={INPUT} />
                </label>
                <Submit pending={linking} label="Link and attach" />
              </form>
            )}

            {tab === "library" && (
              <LibraryPicker
                assets={library}
                currentId={current?.assetId ?? null}
                hidden={hidden}
                action={pickFn}
                pending={picking}
              />
            )}

            {result && (
              <p
                role="status"
                className={`mt-3 text-[12.5px] ${
                  result.ok
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {result.ok ? result.message : result.error}
              </p>
            )}

            <p className="mt-4 max-w-[62ch] text-[12px] leading-relaxed text-gray-500 dark:text-gray-500">
              The design belongs to v{version}, not to the template. Saving a new
              version carries this image forward as its starting point, and changing
              it there leaves every client post built from an earlier version showing
              what was actually delivered.
            </p>
          </div>
        ) : (
          <p className="min-w-0 flex-1 text-[13px] text-gray-500 dark:text-gray-400">
            Your role opens the library but does not change it.
          </p>
        )}
      </div>
    </Frame>
  );
}

/* ---------------- preview ---------------- */

function Preview({ current }: { current: CurrentImage | null }) {
  if (!current || !current.url) {
    return (
      <div className="grid aspect-square w-full place-items-center border border-dashed border-black/15 text-center dark:border-white/15">
        <span className="px-6 text-[12.5px] leading-relaxed text-gray-400 dark:text-gray-600">
          No design on this version yet.
        </span>
      </div>
    );
  }

  if (current.isBroken) {
    return (
      <div className="grid aspect-square w-full place-items-center border border-rose-500/35 bg-rose-500/[0.06] text-center">
        <span className="px-6 text-[12.5px] leading-relaxed text-rose-600 dark:text-rose-400">
          This file stopped resolving. The link checker flagged it, so replace it
          before this template goes into another batch.
        </span>
      </div>
    );
  }

  if (current.mime?.startsWith("video/")) {
    return (
      <video
        src={current.url}
        controls
        preload="metadata"
        className="w-full border border-black/10 bg-black dark:border-white/10"
      />
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote host,
       plus Supabase signed URLs that next/image cannot be told about ahead of time */
    <img
      src={current.url}
      alt={current.alt ?? ""}
      className="w-full border border-black/10 object-contain dark:border-white/10"
    />
  );
}

/* ---------------- library picker ---------------- */

function LibraryPicker({
  assets,
  currentId,
  hidden,
  action,
  pending,
}: {
  assets: LibraryAsset[];
  currentId: string | null;
  hidden: React.ReactNode;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(currentId);

  const filtered = query.trim()
    ? assets.filter((a) =>
        `${a.alt ?? ""} ${a.url}`.toLowerCase().includes(query.trim().toLowerCase())
      )
    : assets;

  if (assets.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
        The asset library is empty. Run{" "}
        <span className="font-mono text-[12px]">pnpm media:sync</span> to pull in what
        is already in HighLevel, or upload a file on the Upload tab.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      {hidden}
      <input type="hidden" name="asset_id" value={chosen ?? ""} />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by name"
        aria-label="Filter the asset library"
        className={INPUT}
      />

      {filtered.length === 0 ? (
        <p className="text-[12.5px] text-gray-500">Nothing matches that.</p>
      ) : (
        <ul className="grid max-h-[280px] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {filtered.map((a) => {
            const selected = chosen === a.id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setChosen(a.id)}
                  aria-pressed={selected}
                  title={a.alt ?? a.url}
                  className={`block aspect-square w-full cursor-pointer overflow-hidden border p-0 transition-colors ${
                    selected
                      ? "border-[#2B50DC] ring-1 ring-[#2B50DC] dark:border-[#5B8DEF] dark:ring-[#5B8DEF]"
                      : "border-black/10 hover:border-[#2B50DC]/50 dark:border-white/10"
                  }`}
                >
                  {a.isBroken || !a.url ? (
                    <span className="grid h-full w-full place-items-center bg-black/[0.03] font-mono text-[9px] uppercase tracking-[0.1em] text-rose-500 dark:bg-white/[0.04]">
                      broken
                    </span>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote host */
                    <img
                      src={a.url}
                      alt={a.alt ?? ""}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Submit pending={pending} label="Attach selected" disabled={!chosen || chosen === currentId} />
    </form>
  );
}

/* ---------------- small parts ---------------- */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <section className="border border-black/10 bg-white dark:border-white/10 dark:bg-[#111118]">
      <div className="border-b border-black/8 px-5 py-4 dark:border-white/8">
        <h2 className="font-grotesk text-[14px] font-semibold text-gray-900 dark:text-white">
          Design
        </h2>
      </div>
      {children}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-3.5 py-2 font-grotesk text-[12.5px] font-medium transition-colors ${
        active
          ? "border-[#2B50DC] text-[#2B50DC] dark:border-[#5B8DEF] dark:text-[#5B8DEF]"
          : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Submit({
  pending,
  label,
  disabled,
}: {
  pending: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="btn gradient-bg cursor-pointer self-start border-0 px-5 py-2 font-grotesk text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
    >
      {pending ? "Working" : label}
    </button>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-gray-400 dark:text-gray-600">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-gray-600 dark:text-gray-300">{children}</dd>
    </div>
  );
}

function sourceLabel(provider: string): string {
  if (provider === "highlevel") return "HighLevel media";
  if (provider === "supabase") return "Uploaded to the platform";
  if (provider === "external") return "External link";
  return provider;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
