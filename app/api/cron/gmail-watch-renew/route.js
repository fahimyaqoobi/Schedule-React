import { NextResponse } from "next/server";
import { getGmailSettings, saveGmailSettings, getGmailAccessToken, startGmailWatch } from "../../../../lib/googleGmail";

// Gmail push-notification subscriptions expire after 7 days — this runs
// daily (see vercel.json) so the live sync never silently goes stale between
// renewals. Safe to call anytime; re-watching just extends the expiration.
export async function GET() {
    try {
        const settings = await getGmailSettings();
        const topicName = settings?.topicName || process.env.GOOGLE_GMAIL_PUBSUB_TOPIC;
        if (!settings?.refreshToken || !topicName) {
            return NextResponse.json({ skipped: true, reason: "Gmail not connected yet" }, { status: 200 });
        }

        const accessToken = await getGmailAccessToken();
        const watch = await startGmailWatch(accessToken, topicName);
        await saveGmailSettings({
            historyId: settings.historyId || watch.historyId,
            watchExpiration: watch.expiration,
            topicName,
        });

        return NextResponse.json({ renewed: true, expiration: watch.expiration }, { status: 200 });
    } catch (err) {
        console.error("GET gmail-watch-renew error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
