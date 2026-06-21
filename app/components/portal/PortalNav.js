"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    );
}
function JobsIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    );
}
function PlusIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}
function StarIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}
function PersonIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    );
}

const TABS = [
    { href: "/customer/home", label: "Home", Icon: HomeIcon },
    { href: "/customer/jobs", label: "Jobs", Icon: JobsIcon },
    { href: "/customer/book", label: "Book", Icon: PlusIcon, primary: true },
    { href: "/customer/rewards", label: "Rewards", Icon: StarIcon },
    { href: "/customer/profile", label: "Profile", Icon: PersonIcon },
];

export default function PortalNav() {
    const pathname = usePathname();
    if (pathname === "/customer") return null;
    const BRAND = "#005691";
    const ACTION = "#0A6CB8";

    return (
        <nav style={{
            position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
            width: "100%", maxWidth: 430, background: "#fff",
            borderTop: "1px solid #e2e8f0", display: "flex", zIndex: 100,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
            {TABS.map(({ href, label, Icon, primary }) => {
                const active = pathname === href || (href !== "/customer" && pathname.startsWith(href));
                if (primary) {
                    return (
                        <Link key={href} href={href} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0 10px", textDecoration: "none" }}>
                            <span style={{
                                width: 46, height: 46, borderRadius: "50%",
                                background: active ? BRAND : ACTION,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#fff", marginTop: -16,
                                boxShadow: "0 4px 14px rgba(0,86,145,0.35)",
                            }}>
                                <Icon />
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: active ? BRAND : "#64748b", marginTop: 3 }}>{label}</span>
                        </Link>
                    );
                }
                return (
                    <Link key={href} href={href} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 8px", textDecoration: "none", color: active ? BRAND : "#94a3b8", gap: 3 }}>
                        <Icon />
                        <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
