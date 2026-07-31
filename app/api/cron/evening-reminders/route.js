import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { BRANCHES } from "../../../../lib/branches";
import { trySendSms, buildEveningReminderSms } from "../../../../lib/sms";

const REMINDER_HOUR = 18; // 6 PM, branch-local — see confirmation with the user.

function getLocalDateAndHour(timezone) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", hour12: false,
    });
    const parts = formatter.formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const hour = parseInt(parts.hour, 10) % 24; // some ICU implementations report midnight as "24"
    return { dateStr: `${parts.year}-${parts.month}-${parts.day}`, hour };
}

// Pure calendar-day arithmetic (no timezone conversion) — safe regardless of DST.
function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split("T")[0];
}

async function getStaffPhone(uid) {
    try {
        const doc = await adminDb.collection("users").doc(uid).get();
        return doc.exists ? (doc.data()?.staffProfile?.personal?.phone || "") : "";
    } catch {
        return "";
    }
}

// Vercel Hobby cron jobs run once/day each with ~1hr timing slop, and can't
// track DST — so vercel.json schedules this route TWICE a day, at both UTC
// offsets Eastern Time ever sits at (22:00 and 23:00 UTC = 6PM EDT / 6PM
// EST). Whichever of the two doesn't land on a branch's real 6PM that day
// of the year is a harmless no-op, since only an exact branch-local hour of
// 18 does anything below. Every send is also deduped per booking+staff+date
// via staffNotifiedAt, so even a genuine double-fire sends nothing twice.
export async function GET(request) {
    try {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
            const authHeader = request.headers.get("authorization");
            if (authHeader !== `Bearer ${cronSecret}`) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const origin = request.headers.get("origin") || request.nextUrl.origin;
        const results = [];

        for (const branch of BRANCHES) {
            const { dateStr: todayLocal, hour } = getLocalDateAndHour(branch.timezone);
            if (hour !== REMINDER_HOUR) continue;

            const tomorrowLocal = addDays(todayLocal, 1);
            const snapshot = await adminDb.collection("bookings")
                .where("branchId", "==", branch.id)
                .where("status", "==", "Confirmed")
                .where("date", "==", tomorrowLocal)
                .get();

            let sent = 0;
            for (const doc of snapshot.docs) {
                const booking = doc.data();
                const staffIds = Array.isArray(booking.assignedStaffIds) ? booking.assignedStaffIds : [];
                if (staffIds.length === 0) continue;

                const notifiedAt = { ...(booking.staffNotifiedAt || {}) };
                let changed = false;

                for (const uid of staffIds) {
                    if (notifiedAt[uid]?.reminderSentForDate === tomorrowLocal) continue;
                    const phone = await getStaffPhone(uid);
                    if (!phone) continue;
                    await trySendSms(phone, buildEveningReminderSms(booking, origin));
                    notifiedAt[uid] = { ...(notifiedAt[uid] || {}), reminderSentForDate: tomorrowLocal };
                    changed = true;
                    sent += 1;
                }

                if (changed) {
                    await doc.ref.set({ staffNotifiedAt: notifiedAt }, { merge: true });
                }
            }

            results.push({ branchId: branch.id, localHour: hour, tomorrowLocal, jobsChecked: snapshot.size, remindersSent: sent });
        }

        return NextResponse.json({ ok: true, results }, { status: 200 });
    } catch (err) {
        console.error("GET evening-reminders cron error:", err);
        return NextResponse.json({ error: err.message || "Cron failed." }, { status: 500 });
    }
}
