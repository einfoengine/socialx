import { redirect } from "next/navigation";

/* The journal became one route. This stays so links and bookmarks made while it
   was five keep landing on the right tab. */
export default function LegacyTab() {
  redirect("/admin/journal?tab=build-log");
}
