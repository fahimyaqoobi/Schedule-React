import { NextResponse } from "next/server";
import { exchangeGmailCode, saveGmailSettings, startGmailWatch } from "../../../../lib/googleGmail";

// Step 2: Google redirects the admin's browser here after they approve
// consent. This request comes straight from Google's own top-level
// navigation, so it carries no Authorization header — the httpOnly `state`
// cookie set in /connect is what proves this callback belongs to the admin
// session that started the flow, not an arbitrary caller.
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const origin = request.nextUrl.origin;
    const backToSettings = (query) => NextResponse.redirect(`${origin}/?tab=settings&${query}`);

    if (error) return backToSettings(`gmailConnect=error&reason=${encodeURIComponent(error)}`);

    const expectedState = request.cookies.get("gmail_oauth_state")?.value;
    if (!code || !state || !expectedState || state !== expectedState) {
        return backToSettings("gmailConnect=error&reason=state_mismatch");
    }

    try {
        const redirectUri = `${origin}/api/google-gmail/callback`;
        const tokens = await exchangeGmailCode(code, redirectUri);
        if (!tokens.refresh_token) {
            // Happens if this Google account already granted consent before
            // and Google didn't re-issue a refresh token despite `prompt:
            // consent` — extremely rare, but without one we can't stay
            // connected long-term.
            return backToSettings("gmailConnect=error&reason=no_refresh_token");
        }

        await saveGmailSettings({
            refreshToken: tokens.refresh_token,
            connected: true,
            connectedAt: new Date().toISOString(),
        });

        // Start live push notifications immediately so ingestion is live
        // from the moment the connection is made, not from the next cron tick.
        const topicName = process.env.GOOGLE_GMAIL_PUBSUB_TOPIC;
        if (topicName) {
            const watch = await startGmailWatch(tokens.access_token, topicName);
            await saveGmailSettings({
                historyId: watch.historyId,
                watchExpiration: watch.expiration,
                topicName,
            });
        }

        const response = backToSettings("gmailConnect=success");
        response.cookies.delete("gmail_oauth_state");
        return response;
    } catch (err) {
        console.error("GET google-gmail/callback error:", err);
        return backToSettings(`gmailConnect=error&reason=${encodeURIComponent(err.message || "unknown")}`);
    }
}
