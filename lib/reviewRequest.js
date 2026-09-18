import { formatZonedDate } from "./timezone";

// Same visual language as the Stripe receipt email (app/api/webhooks/stripe/
// route.js) — brand gradient header, white card body, small green tip box —
// so every transactional email this company sends looks like it came from
// the same place.

function formatJobDate(dateStr) {
    if (!dateStr) return "";
    const parsed = new Date(`${dateStr}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return formatZonedDate(parsed, { weekday: "long", month: "long", day: "numeric" }, undefined, "en-CA");
}

function baseEmailShell({ heading, introLine, bodyLine, reviewLink, closingLine }) {
    return `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#071b3a">
            <div style="background:linear-gradient(135deg,#005691,#0A6CB8);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center">
                <div style="font-size:32px;margin-bottom:4px">🧽✨</div>
                <h1 style="color:#fff;font-size:22px;margin:0 0 4px">${heading}</h1>
                <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0">SmarTouch Clean · Ottawa, ON</p>
            </div>
            <div style="background:#fff;border:1px solid #dce8f2;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
                <p style="margin:0 0 14px">${introLine}</p>
                <p style="margin:0 0 22px;color:#334155">${bodyLine}</p>
                <div style="text-align:center;margin:0 0 24px">
                    <a href="${reviewLink}" style="display:inline-block;background:#78A53E;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:999px;text-decoration:none">★★★★★ Leave a Review</a>
                </div>
                <div style="background:#f0f8e8;border-radius:10px;padding:14px 16px">
                    <p style="font-size:13px;color:#3d6b1a;margin:0">
                        It only takes a minute, and it genuinely helps a small local business like ours. Thank you for your support! 💚
                    </p>
                </div>
                <p style="font-size:13px;color:#526276;margin-top:22px">${closingLine}</p>
                <p style="font-size:12px;color:#8fa3b8;margin-top:20px">
                    Questions? Call <a href="tel:6134165001" style="color:#78A53E;font-weight:700">613-416-5001</a> or reply to this email.<br/>
                    — The SmarTouch Clean Team
                </p>
            </div>
        </div>
    `;
}

// Sent once, admin-triggered, after a job is marked Completed.
export function buildReviewRequestEmailHtml({ booking, reviewLink }) {
    const firstName = booking.firstName || booking.clientName?.split(" ")[0] || "there";
    const dateStr = formatJobDate(booking.date);
    return baseEmailShell({
        heading: "How did we do?",
        introLine: `Hi ${firstName},`,
        bodyLine: `Thanks for choosing SmarTouch Clean${dateStr ? ` for your ${booking.service || "cleaning"} on ${dateStr}` : ""}! We'd love to hear about your experience — could you take a moment to leave us a review?`,
        reviewLink,
        closingLine: "We read every single review and use your feedback to keep improving.",
    });
}

// The ONE allowed reminder — never sent automatically, only when an admin
// acts on the notification the 3-day cron creates (see app/api/cron/review-
// reminders). Softer, shorter — a nudge, not a repeat of the full ask.
export function buildReviewReminderEmailHtml({ booking, reviewLink }) {
    const firstName = booking.firstName || booking.clientName?.split(" ")[0] || "there";
    return baseEmailShell({
        heading: "Just a friendly reminder",
        introLine: `Hi ${firstName},`,
        bodyLine: `A little while ago we asked how your ${booking.service || "cleaning"} went — if you haven't had a chance yet, we'd still really appreciate a quick review whenever you have a moment.`,
        reviewLink,
        closingLine: "Thanks again for choosing SmarTouch Clean!",
    });
}
