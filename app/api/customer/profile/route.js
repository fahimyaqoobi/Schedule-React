import { NextResponse } from "next/server";
import { getCustomerProfile, upsertCustomerProfile } from "../../../../lib/customerProfile";
import { getSessionPhoneAny } from "../../../../lib/customerSession";

export async function GET(request) {
    try {
        const phone = getSessionPhoneAny(request);
        const profile = await getCustomerProfile(phone);
        return NextResponse.json({ ok: true, profile: profile || { phone } });
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 400;
        return NextResponse.json({ error: err.message }, { status });
    }
}

export async function PUT(request) {
    try {
        const phone = getSessionPhoneAny(request);
        const body = await request.json();
        const allowed = ["name", "email", "address", "city", "province", "postalCode", "preferences"];
        const updates = {};
        for (const key of allowed) {
            if (key in body) updates[key] = body[key];
        }
        await upsertCustomerProfile(phone, updates);
        return NextResponse.json({ ok: true });
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 400;
        return NextResponse.json({ error: err.message }, { status });
    }
}
