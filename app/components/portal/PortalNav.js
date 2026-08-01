"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ClipboardList, Plus, MessageCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// Home / Jobs / Book(center FAB) / Chat / Profile — Chat replaces the old
// Rewards tab slot (rewards stay reachable from Home's rewards card and
// Profile) so job chat and support chat both get a persistent, discoverable
// home instead of being buried inside a job detail page or a Profile button.
const TABS = [
    { href: "/customer/home", label: "Home", Icon: House },
    { href: "/customer/jobs", label: "Jobs", Icon: ClipboardList },
    { href: "/customer/book", label: "Book", Icon: Plus, primary: true },
    { href: "/customer/chat", label: "Chat", Icon: MessageCircle },
    { href: "/customer/profile", label: "Profile", Icon: UserRound },
];

export default function PortalNav() {
    const pathname = usePathname();
    if (pathname === "/customer") return null;

    return (
        <nav className="fixed inset-x-0 bottom-0 left-1/2 z-[100] flex w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl">
            {TABS.map(({ href, label, Icon, primary }) => {
                const active = pathname === href || (href !== "/customer" && pathname.startsWith(href));
                if (primary) {
                    return (
                        <Link key={href} href={href} className="flex flex-1 flex-col items-center gap-0.5 pt-1.5 pb-2.5">
                            <span
                                className={cn(
                                    "-mt-4 flex size-11 items-center justify-center rounded-full text-primary-foreground shadow-lg shadow-primary/35",
                                    active ? "bg-primary" : "bg-primary/85"
                                )}
                            >
                                <Icon className="size-6" strokeWidth={2.5} />
                            </span>
                            <span className={cn("mt-0.5 text-[10px] font-bold", active ? "text-primary" : "text-muted-foreground")}>{label}</span>
                        </Link>
                    );
                }
                return (
                    <Link
                        key={href}
                        href={href}
                        className={cn(
                            "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold",
                            active ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
