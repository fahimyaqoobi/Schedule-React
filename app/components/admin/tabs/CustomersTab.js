"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import CustomerProfileModal from "../CustomerProfileModal";

function money(n) {
    return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function CustomersTab({ getAuthHeaders, currentUser }) {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortCol, setSortCol] = useState("lastBookingDate");
    const [sortDir, setSortDir] = useState("desc");
    const [selectedKey, setSelectedKey] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/customers", { headers });
            const data = await res.json();
            if (res.ok) setCustomers(data);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => { load(); }, [load]);

    const handleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir("desc"); }
    };

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        const filtered = !term ? customers : customers.filter(c =>
            (c.name || "").toLowerCase().includes(term) ||
            (c.phone || "").includes(term) ||
            (c.email || "").toLowerCase().includes(term)
        );
        return [...filtered].sort((a, b) => {
            const av = a[sortCol], bv = b[sortCol];
            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    }, [customers, search, sortCol, sortDir]);

    const SortArrow = ({ col }) => sortCol !== col ? <span style={{ opacity: 0.3, fontSize: 9 }}>⇅</span> : sortDir === "asc" ? <span style={{ fontSize: 9 }}>▲</span> : <span style={{ fontSize: 9 }}>▼</span>;

    return (
        <div className="animate-fade">
            <div className="ops-control-header">
                <div>
                    <p className="ops-eyebrow">CRM</p>
                    <h3 className="ops-title">Customer Directory</h3>
                    <p className="ops-copy">Every customer, matched automatically across bookings by phone (or email) — lifetime value, balance owed, service history, and support chat in one place.</p>
                </div>
                <span className="ops-chip">{customers.length} Customers</span>
            </div>

            <div className="filters-card" style={{ marginBottom: 14 }}>
                <div className="search-input-wrapper">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, or email…" />
                    {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: "0 6px" }}>✕</button>}
                </div>
            </div>

            <div className="table-container">
                {loading ? (
                    <div className="text-center p-12 text-slate-400 text-sm">Loading customers…</div>
                ) : visible.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 text-sm">No customers match.</div>
                ) : (
                    <div className="table-scroll-wrapper">
                        <table className="bookings-table">
                            <thead>
                                <tr>
                                    <th style={{ cursor: "pointer" }} onClick={() => handleSort("name")}>Name <SortArrow col="name" /></th>
                                    <th>Phone</th>
                                    <th>Email</th>
                                    <th style={{ cursor: "pointer" }} onClick={() => handleSort("totalBookings")}>Bookings <SortArrow col="totalBookings" /></th>
                                    <th style={{ cursor: "pointer" }} onClick={() => handleSort("totalRevenue")}>Lifetime Revenue <SortArrow col="totalRevenue" /></th>
                                    <th style={{ cursor: "pointer" }} onClick={() => handleSort("totalOwing")}>Balance Owing <SortArrow col="totalOwing" /></th>
                                    <th style={{ cursor: "pointer" }} onClick={() => handleSort("promoUsageCount")}>Promo Uses <SortArrow col="promoUsageCount" /></th>
                                    <th style={{ cursor: "pointer" }} onClick={() => handleSort("lastBookingDate")}>Last Booking <SortArrow col="lastBookingDate" /></th>
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(c => (
                                    <tr key={c.key}>
                                        <td>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{c.name}</div>
                                            {c.isRecurringCustomer && <span style={{ fontSize: 9, fontWeight: 700, color: "#0891b2" }}>● Recurring</span>}
                                        </td>
                                        <td style={{ fontSize: 12 }}>{c.phone || "—"}</td>
                                        <td style={{ fontSize: 12, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email || "—"}</td>
                                        <td style={{ fontSize: 12 }}>{c.totalBookings}</td>
                                        <td style={{ fontSize: 12, fontWeight: 700, color: "#0891b2" }}>{money(c.totalRevenue)}</td>
                                        <td style={{ fontSize: 12, fontWeight: 700, color: c.totalOwing > 0 ? "#dc2626" : "#16a34a" }}>{money(c.totalOwing)}</td>
                                        <td style={{ fontSize: 12 }}>{c.promoUsageCount}</td>
                                        <td style={{ fontSize: 12 }}>{c.lastBookingDate || "—"}</td>
                                        <td style={{ textAlign: "right" }}>
                                            <button onClick={() => setSelectedKey(c.key)} className="btn btn-secondary btn-sm">View Profile</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedKey && (
                <CustomerProfileModal
                    customerKey={selectedKey}
                    getAuthHeaders={getAuthHeaders}
                    currentUser={currentUser}
                    onClose={() => setSelectedKey(null)}
                />
            )}
        </div>
    );
}
