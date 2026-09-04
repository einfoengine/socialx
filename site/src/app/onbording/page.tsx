import { redirect } from "next/navigation";

/**
 * The old onboarding route, which embedded a HighLevel survey in an iframe.
 *
 * Kept as a redirect rather than deleted: the URL is in sent emails and possibly in
 * HighLevel automations, and a 404 for a paying client mid-onboarding is a support
 * ticket. The native flow lives inside the portal, so it lands behind sign-in.
 */
export default function LegacyOnboarding() {
  redirect("/portal/onboarding");
}
