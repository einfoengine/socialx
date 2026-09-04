import { permanentRedirect } from "next/navigation";

/**
 * Access used to live here, before Settings grew a rail and every section got a
 * name that says what it is. The old path is bookmarked and linked from People,
 * so it keeps resolving rather than 404ing somebody out of a screen they had
 * open yesterday.
 */
export default function PermissionsRedirect(): never {
  permanentRedirect("/admin/settings/access");
}
