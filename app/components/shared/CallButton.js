"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff } from "lucide-react";

// Browser-based outbound calling via the Twilio Voice SDK — click, talk
// through the computer/phone's own mic and speakers, no separate phone call
// involved on this end. Always dials out from the one business Twilio
// number (see TWILIO_VOICE_NUMBER / app/api/twilio/voice-outbound), so the
// customer sees the same number your texts already come from. One-way by
// design: if they call that number back, Twilio forwards it straight to
// your cell (see app/api/twilio/voice-inbound) — this button has nothing to
// do with receiving that call.
export default function CallButton({ phone, bookingId, getAuthHeaders, size = "sm" }) {
    const [callState, setCallState] = useState("idle"); // idle | connecting | in-call
    const [error, setError] = useState("");
    const deviceRef = useRef(null);
    const callRef = useRef(null);

    useEffect(() => {
        return () => {
            callRef.current?.disconnect();
            deviceRef.current?.destroy();
        };
    }, []);

    if (!phone) return null;

    const handleCall = async () => {
        setError("");
        setCallState("connecting");
        try {
            const { Device } = await import("@twilio/voice-sdk");
            const headers = await getAuthHeaders();
            const res = await fetch("/api/twilio/voice-token", { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not start the call.");

            if (!deviceRef.current) {
                deviceRef.current = new Device(data.token, { logLevel: "error" });
                deviceRef.current.on("error", (e) => {
                    setError(e.message || "Call error.");
                    setCallState("idle");
                });
            } else {
                await deviceRef.current.updateToken(data.token);
            }

            const call = await deviceRef.current.connect({ params: { To: phone, bookingId: bookingId || "" } });
            callRef.current = call;
            call.on("accept", () => setCallState("in-call"));
            call.on("disconnect", () => { setCallState("idle"); callRef.current = null; });
            call.on("cancel", () => { setCallState("idle"); callRef.current = null; });
            call.on("reject", () => { setCallState("idle"); callRef.current = null; });
            call.on("error", (e) => { setError(e.message || "Call error."); setCallState("idle"); });
        } catch (err) {
            setError(err.message || "Could not start the call.");
            setCallState("idle");
        }
    };

    const handleHangup = () => {
        callRef.current?.disconnect();
    };

    if (callState === "in-call" || callState === "connecting") {
        return (
            <Button type="button" size={size} variant="destructive" onClick={handleHangup} disabled={callState === "connecting"}>
                <PhoneOff className="size-3.5" /> {callState === "connecting" ? "Connecting…" : "Hang Up"}
            </Button>
        );
    }

    return (
        <div className="flex flex-col items-start gap-1">
            <Button type="button" size={size} variant="outline" onClick={handleCall} title={`Call ${phone}`}>
                <Phone className="size-3.5" /> Call
            </Button>
            {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
    );
}
