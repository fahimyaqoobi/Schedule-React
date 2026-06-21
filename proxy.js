import { NextResponse } from "next/server";

export function proxy(request) {
    const { pathname } = request.nextUrl;

    if (!pathname.startsWith("/customer") || pathname === "/customer") {
        return NextResponse.next();
    }

    const token = request.cookies.get("cst")?.value;
    if (!token) {
        return NextResponse.redirect(new URL("/customer", request.url));
    }

    try {
        // Lightweight expiry check using atob (Edge Runtime compatible).
        // Full HMAC verification happens in each API route.
        const raw = token.replace(/-/g, "+").replace(/_/g, "/");
        const padded = raw + "=".repeat((4 - (raw.length % 4)) % 4);
        const decoded = atob(padded);
        const parts = decoded.split("|");
        if (parts.length !== 3) throw new Error();
        if (Date.now() > parseInt(parts[1], 10)) throw new Error();
    } catch {
        const res = NextResponse.redirect(new URL("/customer", request.url));
        res.cookies.delete("cst");
        return res;
    }

    return NextResponse.next();
}

export const config = { matcher: ["/customer/:path*"] };
