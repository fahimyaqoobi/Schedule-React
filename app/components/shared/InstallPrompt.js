"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function isIos() {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia?.("(display-mode: standalone)").matches ||
        window.navigator.standalone === true
    );
}

// Shows an install banner on Chrome/Android (native beforeinstallprompt flow)
// and a static instructional banner on iOS Safari, which never fires that
// event. `appLabel` scopes the localStorage dismissal key so the staff and
// customer surfaces don't share one dismissal state.
export default function InstallPrompt({ accentColor = "#005691", appLabel = "app" }) {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showIosHint, setShowIosHint] = useState(false);
    const [dismissed, setDismissed] = useState(true);

    const storageKey = `installPromptDismissed:${appLabel}`;

    useEffect(() => {
        if (isStandalone()) return;
        setDismissed(window.localStorage.getItem(storageKey) === "1");

        const handleBeforeInstall = (event) => {
            event.preventDefault();
            setDeferredPrompt(event);
        };
        window.addEventListener("beforeinstallprompt", handleBeforeInstall);

        if (isIos()) {
            setShowIosHint(true);
        }

        return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    }, [storageKey]);

    const dismiss = () => {
        setDismissed(true);
        window.localStorage.setItem(storageKey, "1");
    };

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        dismiss();
    };

    if (dismissed || (!deferredPrompt && !showIosHint)) return null;

    return (
        <div
            className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
            <div
                className="flex w-full max-w-sm items-center gap-3 rounded-xl border bg-background p-3 shadow-lg"
                style={{ borderColor: accentColor }}
            >
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: accentColor }}
                >
                    {showIosHint && !deferredPrompt ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                    {deferredPrompt ? (
                        <p className="font-medium">Install {appLabel} for quick access from your home screen.</p>
                    ) : (
                        <p className="font-medium">
                            Install {appLabel}: tap <Share className="mx-0.5 inline h-3.5 w-3.5 align-text-bottom" /> Share, then "Add to Home Screen".
                        </p>
                    )}
                </div>
                {deferredPrompt && (
                    <Button size="sm" onClick={handleInstall} style={{ backgroundColor: accentColor }} className="shrink-0 text-white hover:opacity-90">
                        Install
                    </Button>
                )}
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Dismiss"
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
