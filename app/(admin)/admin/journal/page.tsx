import { redirect } from "next/navigation";

// /admin/journal is not a view of its own; it opens the first tab.
export default function JournalIndex() {
  redirect("/admin/journal/build-log");
}
