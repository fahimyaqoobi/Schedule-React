"use client";
import { useEffect, useState, useCallback } from "react";
import ChatPanel from "../shared/ChatPanel";

function money(n) {
    return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Customer 360 — lifetime bookings, balance, promo usage, notes, and the
// persistent support chat, all in one place. Reachable from the Customers
// directory and from clicking a client name anywhere bookings are listed.
export default function CustomerProfileModal({ customerKey, getAuthHeaders, currentUser, onClose }) {
    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notesDraft, setNotesDraft] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);
    const [notesFeedback, setNotesFeedback] = useState("");

    const [chatMessages, setChatMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(true);
    const [downloadingReport, setDownloadingReport] = useState(false);
    const [reportError, setReportError] = useState("");

    const loadRecord = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/customers?key=${encodeURIComponent(customerKey)}`, { headers });
            const data = await res.json();
            if (res.ok) {
                setRecord(data);
                setNotesDraft(data.notes || "");
            }
        } finally {
            setLoading(false);
        }
    }, [customerKey, getAuthHeaders]);

    const loadChat = useCallback(async () => {
        if (!record?.phone) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/chat/support?type=customer&refId=${encodeURIComponent(record.phone)}`, { headers });
            const data = await res.json();
            if (res.ok) setChatMessages(data.messages || []);
        } finally {
            setChatLoading(false);
        }
    }, [record?.phone, getAuthHeaders]);

    useEffect(() => { loadRecord(); }, [loadRecord]);
    useEffect(() => {
        if (!record?.phone) return;
        loadChat();
        const interval = setInterval(loadChat, 6000);
        return () => clearInterval(interval);
    }, [record?.phone, loadChat]);

    const handleSendChat = async (text) => {
        const headers = await getAuthHeaders();
        await fetch("/api/chat/support", {
            method: "POST", headers,
            body: JSON.stringify({ type: "customer", refId: record.phone, refName: record.name, text }),
        });
        await loadChat();
    };

    const downloadReport = async () => {
        setDownloadingReport(true);
        setReportError("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/customers/report-pdf?key=${encodeURIComponent(customerKey)}`, { headers });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to generate report.");
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const safeName = (record?.name || "customer").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
            const link = document.createElement("a");
            link.href = url;
            link.download = `${safeName}-service-report.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            setReportError(err.message || "Failed to generate report.");
        } finally {
            setDownloadingReport(false);
        }
    };

    const saveNotes = async () => {
        setSavingNotes(true);
        setNotesFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/customers", {
                method: "PUT", headers,
                body: JSON.stringify({ key: customerKey, notes: notesDraft, tags: record?.tags || [] }),
            });
            const data = await res.json();
            setNotesFeedback(res.ok ? "Saved." : (data.error || "Failed to save."));
        } finally {
            setSavingNotes(false);
        }
    };

    return (
        <div className="modal-backdrop show" onClick={onClose}>
            <div className="modal-content animate-pop" style={{ maxWidth: 780 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{loading ? "Loading customer…" : record?.name || "Customer Profile"}</h3>
                    <button onClick={onClose} className="modal-close-btn">✕</button>
                </div>
                <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {loading || !record ? (
                        <div className="text-center p-8 text-slate-400 text-sm">Loading…</div>
                    ) : (
                        <>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "#475569" }}>
                                {record.phone && <span>📞 {record.phone}</span>}
                                {record.email && <span>✉️ {record.email}</span>}
                                {record.memberSince && <span>Member since {record.memberSince}</span>}
                                {record.isRecurringCustomer && <span className="badge" style={{ background: "#ecfeff", color: "#0891b2", border: "1px solid #a5f3fc" }}>Recurring Customer</span>}
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                                {[
                                    ["Total Bookings", record.totalBookings],
                                    ["Lifetime Revenue", money(record.totalRevenue)],
                                    ["Paid", money(record.totalPaid)],
                                    ["Balance Owing", money(record.totalOwing)],
                                    ["Promo Uses", record.promoUsageCount],
                                    ["Upcoming", record.upcomingCount],
                                ].map(([label, value]) => (
                                    <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{label}</div>
                                        <div style={{ fontSize: 17, fontWeight: 800, color: value && String(value).includes("$") && label === "Balance Owing" && record.totalOwing > 0 ? "#dc2626" : "#1e293b" }}>{value}</div>
                                    </div>
                                ))}
                            </div>

                            {record.promoCodesUsed?.length > 0 && (
                                <div style={{ fontSize: 12, color: "#475569" }}>
                                    <strong>Promo codes used:</strong> {record.promoCodesUsed.join(", ")}
                                </div>
                            )}

                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>CRM Notes</div>
                                <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)}
                                    placeholder="Internal notes about this customer…"
                                    style={{ width: "100%", minHeight: 70, padding: 8, border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                                    <button onClick={saveNotes} disabled={savingNotes} className="btn btn-secondary btn-sm">{savingNotes ? "Saving…" : "Save Notes"}</button>
                                    {notesFeedback && <span style={{ fontSize: 11, color: "#64748b" }}>{notesFeedback}</span>}
                                </div>
                            </div>

                            <div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Booking History ({record.bookings.length})</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        {reportError && <span style={{ fontSize: 11, color: "#dc2626" }}>{reportError}</span>}
                                        <button onClick={downloadReport} disabled={downloadingReport} className="btn btn-secondary btn-sm" title="Download a PDF of completed services with paid/unpaid totals">
                                            {downloadingReport ? "Preparing…" : "⬇ Download Report (PDF)"}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                                        <thead>
                                            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                                                <th style={{ padding: "6px 10px" }}>Date</th>
                                                <th style={{ padding: "6px 10px" }}>Service</th>
                                                <th style={{ padding: "6px 10px" }}>Amount</th>
                                                <th style={{ padding: "6px 10px" }}>Status</th>
                                                <th style={{ padding: "6px 10px" }}>Payment</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {record.bookings.map(b => (
                                                <tr key={b.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                                                    <td style={{ padding: "6px 10px" }}>{b.date}</td>
                                                    <td style={{ padding: "6px 10px" }}>{b.service}</td>
                                                    <td style={{ padding: "6px 10px", fontWeight: 700 }}>${parseFloat(b.price || 0).toFixed(2)}</td>
                                                    <td style={{ padding: "6px 10px" }}>{b.status}</td>
                                                    <td style={{ padding: "6px 10px" }}>{b.paymentStatus || "unpaid"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Support Chat — full history with this customer</div>
                                <ChatPanel
                                    messages={chatMessages}
                                    currentActorId={currentUser?.uid}
                                    onSend={handleSendChat}
                                    loading={chatLoading}
                                    placeholder="Message this customer…"
                                    height={240}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
