import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal/permissions";
import SettingsNav from "./SettingsNav";

export const metadata: Metadata = { title: "Settings | Admin" };

/**
 * Settings shell.
 *
 * The permission check sits here as well as on every page and every action
 * underneath it. That is not redundancy for its own sake: a layout gate is what
 * stops the rail rendering for somebody who cannot open any of it, and the page
 * gates are what actually hold, because a layout is not a security boundary in
 * an app where server actions are reached directly.
 *
 * `view` is the bar for reading. Writing asks for `full` inside each action.
 */
export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermission("settings");

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 max-w-[70ch] text-sm text-gray-600 dark:text-gray-400">
          How the product behaves, who can reach what, and what it exposes to the
          outside. Changes take effect on the next request, with no deploy.
        </p>
      </div>

      <div className="flex flex-col gap-7 md:flex-row md:gap-9">
        <div className="md:w-[184px] md:shrink-0">
          <div className="md:sticky md:top-[73px]">
            <SettingsNav />
          </div>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
