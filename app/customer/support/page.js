import { redirect } from "next/navigation";

// Superseded by the unified Chat tab (/customer/chat), which covers both
// this persistent support thread and every job-specific chat in one place.
// Kept as a redirect so any old bookmarked/shared link still lands somewhere useful.
export default function CustomerSupportRedirect() {
    redirect("/customer/chat");
}
