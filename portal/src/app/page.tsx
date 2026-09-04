import { redirect } from "next/navigation";

/**
 * The portal's own root.
 *
 * Before the split this address belonged to the marketing landing page, so the
 * portal application never needed one and anybody who typed the bare portal
 * domain got a 404. Sending them to /portal puts the routing decision back where
 * it already lives: the proxy bounces a signed-out visitor to /login, and
 * requireOrg forwards staff to /admin.
 */
export default function PortalRoot() {
  redirect("/portal");
}
