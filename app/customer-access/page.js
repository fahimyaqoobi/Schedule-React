function safe(value = "") {
    return String(value || "").trim();
}

export default async function CustomerAccessPage({ searchParams }) {
    const params = await searchParams;
    const phone = safe(params?.phone);
    const documentNumber = safe(params?.document);
    const bookingId = safe(params?.bookingId);

    return (
        <main style={{
            minHeight: "100vh",
            background: "linear-gradient(180deg, #f4f9ff 0%, #ffffff 100%)",
            padding: "32px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Arial, sans-serif"
        }}>
            <div style={{
                width: "100%",
                maxWidth: 680,
                background: "#ffffff",
                borderRadius: 28,
                border: "1px solid #d8e3ef",
                boxShadow: "0 24px 70px rgba(6, 43, 99, 0.12)",
                overflow: "hidden"
            }}>
                <div style={{ padding: "28px 24px 18px", background: "linear-gradient(135deg, #062b63 0%, #0d4ca1 100%)", color: "#ffffff" }}>
                    <img src="/logo-full.png" alt="SmarTouch Clean" style={{ width: "100%", maxWidth: 280, height: "auto", display: "block", marginBottom: 18 }} />
                    <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>Customer Estimate Access</div>
                    <p style={{ margin: "10px 0 0", opacity: 0.92, lineHeight: 1.6 }}>Your estimate is linked to your phone number. Customer portal confirmation will continue from this secure access flow.</p>
                </div>

                <div style={{ padding: 24, display: "grid", gap: 16 }}>
                    <div style={{ padding: 18, borderRadius: 18, border: "1px solid #d8e3ef", background: "#f8fbff" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#0d4ca1", textTransform: "uppercase", marginBottom: 10 }}>Linked Details</div>
                        <div style={{ display: "grid", gap: 10 }}>
                            <div><strong>Phone Number:</strong> {phone || "Not provided"}</div>
                            <div><strong>Document Number:</strong> {documentNumber || "Pending"}</div>
                            <div><strong>Booking ID:</strong> {bookingId || "Pending"}</div>
                        </div>
                    </div>

                    <div style={{ padding: 18, borderRadius: 18, border: "1px solid #d8e3ef", background: "#ffffff" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#10233f", marginBottom: 10 }}>Next step</div>
                        <p style={{ margin: 0, color: "#526276", lineHeight: 1.7 }}>
                            We are preparing the full customer portal so clients can confirm estimates, review invoices, and manage bookings by phone number in a clean mobile flow.
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <a
                            href={`tel:6134165001`}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "14px 20px",
                                borderRadius: 999,
                                background: "#062b63",
                                color: "#ffffff",
                                textDecoration: "none",
                                fontWeight: 700
                            }}
                        >
                            Call Customer Support
                        </a>
                        <a
                            href="/"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "14px 20px",
                                borderRadius: 999,
                                background: "#eef4fb",
                                color: "#062b63",
                                textDecoration: "none",
                                fontWeight: 700
                            }}
                        >
                            Back to Main App
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
}
