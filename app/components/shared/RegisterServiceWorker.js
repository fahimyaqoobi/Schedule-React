"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker({ src, scope }) {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;
        navigator.serviceWorker.register(src, { scope }).catch((err) => {
            console.error("Service worker registration failed:", err);
        });
    }, [src, scope]);

    return null;
}
