"use client";
import { useState } from "react";

// Shared staff-avatar rendering — originally lived only in BookingsTab.js;
// pulled out here so the Calendar's Board/Timeline cards use the exact same
// avatar language (color-hashed initials circle, or photo if present) as
// the Bookings table's "Staff" column, and so neither copy can drift.
export function initials(name = "") {
    return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

const AVATAR_COLORS = ["#6366f1", "#0891b2", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0d9488"];
export function avatarColor(uid = "") {
    let n = 0;
    for (const c of uid) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
    return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export function StaffAvatar({ member, size = 30 }) {
    const [imgError, setImgError] = useState(false);
    const hasPhoto = member.photoURL && !imgError;
    const label = member.name || member.displayName || member.email || "?";
    return (
        <div
            title={label}
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-background ring-1 ring-border"
            style={{ width: size, height: size, background: hasPhoto ? "transparent" : avatarColor(member.uid || label) }}
        >
            {hasPhoto ? (
                <img src={member.photoURL} alt={label} onError={() => setImgError(true)} className="size-full object-cover" />
            ) : (
                <span className="font-bold text-white" style={{ fontSize: size * 0.36, lineHeight: 1 }}>{initials(label)}</span>
            )}
        </div>
    );
}

// Overlapping avatar row + "+N" overflow badge, extracted from the pattern
// BookingsTab.js's "Staff" column already used inline.
export default function StaffAvatarStack({ staff = [], size = 28, max = 4, emptyLabel = "Unassigned" }) {
    if (staff.length === 0) {
        return <span className="text-[11px] italic text-muted-foreground/60">{emptyLabel}</span>;
    }
    return (
        <div className="flex items-center">
            {staff.slice(0, max).map((m, i) => (
                <div key={m.uid || i} style={{ marginLeft: i === 0 ? 0 : -size * 0.25, zIndex: max - i }}>
                    <StaffAvatar member={m} size={size} />
                </div>
            ))}
            {staff.length > max && (
                <div
                    className="-ml-1.75 flex items-center justify-center rounded-full border-2 border-background bg-muted font-extrabold text-muted-foreground"
                    style={{ width: size, height: size, fontSize: size * 0.32 }}
                >
                    +{staff.length - max}
                </div>
            )}
        </div>
    );
}
