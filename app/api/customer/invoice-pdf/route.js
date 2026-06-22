import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { getSessionPhoneAny } from "../../../../lib/customerSession";
import { buildBookingDocumentPdf } from "../../../../lib/bookingDocumentPdf";
import { getBookingDocumentNumber } from "../../../../lib/bookingDocuments";
import { buildCustomerPortalUrl, ensurePromotionList } from "../../../../lib/promotions";
import { normalizeDocumentCopy } from "../../../../lib/documentCopy";

function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

async function loadLogoBuffer(origin) {
    try {
        const res = await fetch(`${origin}/logo-full.png`);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch { return null; }
}

export async function GET(request) {
    try {
        const phone = getSessionPhoneAny(request);
        const { searchParams, origin } = new URL(request.url);
        const bookingId = searchParams.get("bookingId");
        if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

        const doc = await adminDb.collection("bookings").doc(bookingId).get();
        if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const booking = doc.data();
        if (normalizePhone(booking.phone) !== phone) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const settingsSnap = await adminDb.collection("settings").doc("pricing").get();
        const settings = settingsSnap.exists ? settingsSnap.data() : {};
        const companySnapshot = {
            ...(booking.companySnapshot || {}),
            logoUrl: `${origin}/logo-full.png`,
            promotions: Array.isArray(settings.promotions)
                ? ensurePromotionList(settings.promotions)
                : ((booking.companySnapshot || {}).promotions || booking.promotions),
            documentCopy: normalizeDocumentCopy(
                settings.documentCopy || (booking.companySnapshot || {}).documentCopy || booking.documentCopy
            ),
        };

        const customerPortalUrl = buildCustomerPortalUrl(origin, {
            ...booking,
            phone: booking.customerPortalPhone || booking.phone,
        });

        const logoBuffer = await loadLogoBuffer(origin);
        const pdfBuffer = await buildBookingDocumentPdf(
            { ...booking, companySnapshot, customerPortalUrl },
            { logoBuffer }
        );

        const filename = `${getBookingDocumentNumber(booking) || bookingId}.pdf`;
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 500;
        return NextResponse.json({ error: err.message }, { status });
    }
}
