"use client";
import { MessageCircle, CalendarDays, ClipboardList, Receipt, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// The cleaner's own nav — separate from the admin sidebar/mobile-nav-bar so
// it can evolve independently. "Chat" (renamed from "Support") is the fix
// for a real bug report: job chat had no persistent home in the old nav, so
// cleaners never found their way back to a conversation a customer started.
export const CLEANER_NAV_TABS = [
    { key: "messages", label: "Chat", Icon: MessageCircle },
    { key: "calendar", label: "Schedule", Icon: CalendarDays },
    { key: "jobs", label: "Jobs", Icon: ClipboardList },
    { key: "expenses", label: "Expenses", Icon: Receipt },
    { key: "teams", label: "Profile", Icon: UserRound },
];

export default function CleanerNav({ activeTab, onChange, variant = "bottom", tabs = CLEANER_NAV_TABS }) {
    if (variant === "sidebar") {
        return (
            <>
                {tabs.map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        onClick={() => onChange(key)}
                        className={cn("nav-item", activeTab === key && "active")}
                        title={label}
                    >
                        <Icon className="size-5" strokeWidth={2} />
                        <span className="nav-label">{label}</span>
                    </button>
                ))}
            </>
        );
    }

    return (
        <nav className="fixed inset-x-0 bottom-0 z-[9999] flex items-stretch border-t border-border bg-background/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
            {tabs.map(({ key, label, Icon }) => {
                const active = activeTab === key;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onChange(key)}
                        className={cn(
                            "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors",
                            active ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                        {label}
                    </button>
                );
            })}
        </nav>
    );
}
