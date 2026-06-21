import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";

const FALLBACK_SERVICES = {
    "Studio or 1 Bedroom": 87.50,
    "2 bedroom apartment": 101.50,
    "3 bedroom apartment or townhouse": 115.50,
    "3 or 4 bedroom house (or between 1700 to 1999 sqft)": 143.50,
    "between 2000 to 2499 sq ft": 150.50,
    "between 2500 to 2999 sq ft": 175.00,
    "between 3000 to 3499 sq ft": 208.60,
    "between 3500 to 3999 sq ft": 243.60,
    "Window Cleaning": 150.00,
    "Gutter Cleaning": 100.00,
    "Power Washing": 200.00,
};

export async function GET() {
    try {
        const snap = await adminDb.collection("settings").doc("pricing").get();
        const data = snap.exists ? snap.data() : {};
        const services = (data.services && Object.keys(data.services).length > 0)
            ? data.services
            : FALLBACK_SERVICES;
        const taxRate = data.taxRate || 0.13;
        return NextResponse.json({ ok: true, services, taxRate });
    } catch {
        return NextResponse.json({ ok: true, services: FALLBACK_SERVICES, taxRate: 0.13 });
    }
}
