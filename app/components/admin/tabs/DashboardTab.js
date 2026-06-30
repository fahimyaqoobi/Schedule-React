"use client";
import { useState, useMemo } from "react";

// --- Chart period helpers ---
const CHART_FILTERS = [
    { key: "7d", label: "Daily" },
    { key: "4w", label: "Weekly" },
    { key: "3m", label: "3 Months" },
    { key: "6m", label: "6 Months" },
    { key: "1y", label: "Annual" },
];

function getPeriods(filter) {
    const now = new Date();
    const fmt = d => d.toISOString().split("T")[0];
    const periods = [];

    if (filter === "7d") {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const ds = fmt(d);
            periods.push({
                label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                start: ds,
                end: ds,
            });
        }
    } else if (filter === "4w") {
        for (let i = 3; i >= 0; i--) {
            const endD = new Date(now);
            endD.setDate(endD.getDate() - i * 7);
            const startD = new Date(endD);
            startD.setDate(startD.getDate() - 6);
            periods.push({ label: `Wk ${4 - i}`, start: fmt(startD), end: fmt(endD) });
        }
    } else {
        const months = filter === "3m" ? 3 : filter === "6m" ? 6 : 12;
        const withYear = months > 6;
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const dEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            const label = withYear
                ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
                : d.toLocaleDateString("en-US", { month: "short" });
            periods.push({ label, start: fmt(d), end: fmt(dEnd) });
        }
    }
    return periods;
}

function inRange(rawDate, start, end) {
    if (!rawDate) return false;
    const d = String(rawDate).split("T")[0];
    return d >= start && d <= end;
}

// ─── SVG Pie chart ──────────────────────────────────────────────────────────
function PieChart({ segments, size = 110 }) {
    const total = segments.reduce((s, g) => s + (g.value || 0), 0);
    if (total === 0) return (
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
            <circle cx={size / 2} cy={size / 2} r={size * 0.42} fill="#f1f5f9" />
            <circle cx={size / 2} cy={size / 2} r={size * 0.25} fill="#fff" />
        </svg>
    );

    const cx = size / 2, cy = size / 2, r = size * 0.42, inner = r * 0.55;
    let angle = -Math.PI / 2;
    const slices = segments.map(seg => {
        const sweep = (seg.value / total) * 2 * Math.PI;
        const end = angle + sweep;
        const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
        const x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end);
        const large = sweep > Math.PI ? 1 : 0;
        const path = sweep >= 2 * Math.PI - 0.001
            ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`
            : `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
        angle = end;
        return { ...seg, path, pct: Math.round((seg.value / total) * 100) };
    });

    return (
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
            {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
            <circle cx={cx} cy={cy} r={inner} fill="#fff" />
        </svg>
    );
}

function RevenueWagesChart({ data }) {
    const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.wages)), 1);
    const roundedMax = Math.ceil(maxVal / 500) * 500 || 500;
    const n = data.length;

    const W = 560, H = 190;
    const PL = 56, PR = 12, PT = 12, PB = 36;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const toY = v => PT + CH - (v / roundedMax) * CH;
    const barW = Math.max(6, (CW / n) * 0.5);
    const xCenter = i => PL + (i + 0.5) * (CW / n);

    const linePoints = data.map((d, i) => `${xCenter(i).toFixed(1)},${toY(d.wages).toFixed(1)}`).join(" ");
    const hasWages = data.some(d => d.wages > 0);

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", maxHeight: 220 }}>
            {[0.25, 0.5, 0.75, 1.0].map((pct, i) => {
                const y = toY(roundedMax * pct);
                return (
                    <g key={i}>
                        <line x1={PL} y1={y.toFixed(1)} x2={W - PR} y2={y.toFixed(1)} stroke="#e2e8f0" strokeWidth="1" />
                        <text x={PL - 6} y={(y + 4).toFixed(1)} textAnchor="end" fontSize="9" fill="#94a3b8">
                            ${Math.round(roundedMax * pct).toLocaleString()}
                        </text>
                    </g>
                );
            })}
            <line x1={PL} y1={(PT + CH).toFixed(1)} x2={W - PR} y2={(PT + CH).toFixed(1)} stroke="#cbd5e1" strokeWidth="1.5" />

            {data.map((d, i) => {
                const bH = Math.max(1, (d.revenue / roundedMax) * CH);
                const bX = xCenter(i) - barW / 2;
                const bY = PT + CH - bH;
                return <rect key={i} x={bX.toFixed(1)} y={bY.toFixed(1)} width={barW.toFixed(1)} height={bH.toFixed(1)} fill="#1e3a5f" rx="3" opacity="0.85" />;
            })}

            {hasWages && (
                <>
                    <polyline points={linePoints} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    {data.map((d, i) =>
                        d.wages > 0 && (
                            <circle key={i} cx={xCenter(i).toFixed(1)} cy={toY(d.wages).toFixed(1)} r="3.5" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
                        )
                    )}
                </>
            )}

            {data.map((d, i) => (
                <text key={i} x={xCenter(i).toFixed(1)} y={H - 6} textAnchor="middle" fontSize={n > 8 ? "8" : "9"} fill="#64748b">
                    {d.label}
                </text>
            ))}
        </svg>
    );
}

export default function DashboardTab({
    currentUser,
    bookings,
    timeEntries,
    customerRewards,
    promotionRules,
    adminCommandMetrics,
    adminServiceCart,
    adminCartTotals,
    activeBranch,
    todayBookings,
    pendingUsers,
    fieldStaff,
    canManagePermissions,
    Icons,
    serviceCatalogRef,
    getPersonalReferralCode,
    getCustomerEligiblePromotions,
    openNewBookingCommand,
    editAdminCartItem,
    removeAdminCartItem,
    checkoutAdminCart,
    setSelectedBooking,
    setDetailsModalOpen,
    setActiveTab,
    setFilterStatus,
    handleResolveUserApproval,
    getRoleLabel,
}) {
    const [showMetrics, setShowMetrics] = useState(false);
    const [chartFilter, setChartFilter] = useState("7d");

    const chartData = useMemo(() => {
        const periods = getPeriods(chartFilter);
        return periods.map(({ label, start, end }) => {
            const revenue = (bookings || [])
                .filter(b => {
                    const ps = (b.paymentStatus || "").toLowerCase();
                    return ps === "paid" && inRange(b.date, start, end);
                })
                .reduce((sum, b) => sum + parseFloat(b.price || b.totalAmount || 0), 0);

            const wages = (timeEntries || [])
                .filter(e => {
                    const s = (e.status || "").toLowerCase();
                    return s === "approved" && inRange(e.startedAt || e.createdAt, start, end);
                })
                .reduce((sum, e) => sum + parseFloat(e.grossPayEstimate || e.grossPay || 0), 0);

            return { label, revenue, wages };
        });
    }, [bookings, timeEntries, chartFilter]);

    return (
        <div className="animate-fade">
            {currentUser.role === "customer" ? (
                <div className="customer-dashboard flex flex-col gap-8">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Welcome back, {currentUser.name.split(" ")[0]}!</h2>
                        <p className="text-slate-500 font-medium mt-2 max-w-lg">Manage your home cleaning schedule, view past services, and earn credits through our referral program.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            <div className="panel-card">
                                <div className="panel-header">
                                    <h4>Your Bookings</h4>
                                </div>
                                <div className="panel-body p-0">
                                    {(() => {
                                        const myBookings = bookings.filter(b => b.email === currentUser.email).sort((a, b) => new Date(b.date) - new Date(a.date));
                                        if (myBookings.length === 0) {
                                            return <div className="p-8 text-center text-slate-400 text-sm">You haven&apos;t booked any services yet.</div>;
                                        }
                                        return (
                                            <div className="flex flex-col">
                                                {myBookings.map((b, idx) => (
                                                    <div key={b.id || idx} className="flex justify-between items-center p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-sm">{b.date} at {b.time}</div>
                                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{b.status}</div>
                                                            {b.isV2Booking && b.cartItems && b.cartItems.some(i => ["Weekly", "Bi-Weekly", "Monthly"].includes(i.frequency)) && (
                                                                <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mt-2">
                                                                    ↻ Next Scheduled: {
                                                                        (() => {
                                                                            const freq = b.cartItems.find(i => ["Weekly", "Bi-Weekly", "Monthly"].includes(i.frequency))?.frequency;
                                                                            const d = new Date(b.date);
                                                                            if (freq === "Weekly") d.setDate(d.getDate() + 7);
                                                                            if (freq === "Bi-Weekly") d.setDate(d.getDate() + 14);
                                                                            if (freq === "Monthly") d.setMonth(d.getMonth() + 1);
                                                                            return d.toLocaleDateString('en-CA');
                                                                        })()
                                                                    } ({b.cartItems.find(i => ["Weekly", "Bi-Weekly", "Monthly"].includes(i.frequency))?.frequency})
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-black text-slate-800">${parseFloat(b.price || b.totalAmount || 0).toFixed(2)}</div>
                                                            <div className="text-[10px] text-slate-400 mt-1">{b.duration} hrs</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-1 flex flex-col gap-6">
                            {(() => {
                                const myBookings = bookings.filter(b => b.email === currentUser.email);
                                const usage = myBookings.filter(b => b.promoCode).map(b => ({ code: b.promoCode }));
                                const referralCode = customerRewards?.referralCode || getPersonalReferralCode({ email: currentUser.email, phone: currentUser.phone, name: currentUser.name });
                                const availableCredit = Number(customerRewards?.rewards?.availableCredit || 0);
                                const qualifying = Number(customerRewards?.rewards?.qualifyingReferrals || 0);
                                const perReferral = Number(customerRewards?.rewards?.perReferral || 30);
                                const eligible = customerRewards?.eligiblePromotions || getCustomerEligiblePromotions({ promotions: promotionRules, customerUsage: usage, referralCredits: availableCredit });
                                const copy = (text, label) => { try { navigator.clipboard?.writeText(text); } catch { /* clipboard unavailable */ } alert(`${label} copied${label === referralCode ? "" : " — apply it at checkout"}.`); };
                                return (
                                    <>
                                        <div className="rewards-card">
                                            <span className="rewards-kicker">Rewards Wallet</span>
                                            <div className="rewards-balance">
                                                <span>Available credit</span>
                                                <strong>${availableCredit.toFixed(2)}</strong>
                                                <small>{qualifying > 0 ? `${qualifying} friend${qualifying > 1 ? "s" : ""} booked · $${perReferral} each` : `Earn $${perReferral} when a friend completes their first booking`}</small>
                                            </div>
                                            <div className="rewards-referral">
                                                <span className="rewards-referral-label">Your referral code</span>
                                                <button type="button" className="rewards-code" onClick={() => copy(referralCode, referralCode)}>
                                                    <code>{referralCode}</code>
                                                    <span className="rewards-copy">Copy</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="rewards-promos panel-card">
                                            <div className="panel-header"><h4>Available Promos</h4></div>
                                            <div className="rewards-promo-list">
                                                {eligible.length === 0 && <p className="rewards-empty">No promotions available right now.</p>}
                                                {eligible.map(p => (
                                                    <div key={p.id} className={`rewards-promo ${p.eligible ? "" : "locked"}`}>
                                                        <div className="rewards-promo-main">
                                                            <code>{p.code}</code>
                                                            <span className="rewards-promo-name">{p.name}</span>
                                                            {p.description && <small>{p.description}</small>}
                                                        </div>
                                                        {p.eligible
                                                            ? <button type="button" className="rewards-promo-copy" onClick={() => copy(p.code, p.code)}>Copy</button>
                                                            : <span className="rewards-promo-locked" title={p.lockedReason}>Locked</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Mobile-only CTA — only visible on phones */}
                    <div className="dashboard-mobile-cta">
                        <div className="dashboard-mobile-cta-inner">
                            <div>
                                <p className="admin-command-kicker">Admin</p>
                                <h3>New Booking</h3>
                            </div>
                            <button onClick={openNewBookingCommand} className="admin-primary-action dashboard-mobile-new-booking">
                                {Icons.Plus()}
                                Start New Booking
                            </button>
                        </div>
                    </div>

                    {/* Desktop-only dashboard sections */}
                    <section className="admin-command-shell dashboard-desktop-only">
                        <div className="admin-command-header">
                            <div>
                                <p className="admin-command-kicker">Admin booking command</p>
                                <h3>Create a new booking</h3>
                                <p>
                                    Use the step-by-step booking wizard to select a service, configure size and add-ons, set frequency, and apply promotions — all in one guided flow.
                                </p>
                                <div className="admin-workflow-steps" aria-label="Booking workflow">
                                    <span><strong>1</strong> Choose type</span>
                                    <span><strong>2</strong> Select service</span>
                                    <span><strong>3</strong> Configure</span>
                                    <span><strong>4</strong> Add-ons</span>
                                    <span><strong>5</strong> Frequency</span>
                                    <span><strong>6</strong> Review</span>
                                </div>
                            </div>
                            <button onClick={openNewBookingCommand} className="admin-primary-action">
                                {Icons.Plus()}
                                New Booking
                            </button>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: showMetrics ? "10px" : "0" }}>
                            <button
                                onClick={() => setShowMetrics(v => !v)}
                                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "12px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.03em", padding: "4px 0", display: "flex", alignItems: "center", gap: "5px" }}
                            >
                                {showMetrics ? "Hide summary ▲" : "Show summary ▼"}
                            </button>
                        </div>

                        {showMetrics && (
                            <div className="admin-metric-row" style={{ marginBottom: "24px" }}>
                                <div className="admin-metric-card">
                                    <span>Payments Collected</span>
                                    <strong>${adminCommandMetrics.paidRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                    {adminCommandMetrics.paidByMethodLabeled && adminCommandMetrics.paidByMethodLabeled.length > 0 ? (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                                            {adminCommandMetrics.paidByMethodLabeled.map(m => (
                                                <span key={m.key} style={{ fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 99, padding: "1px 7px", whiteSpace: "nowrap" }}>
                                                    {m.label} ${m.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <small>Paid jobs only</small>
                                    )}
                                </div>
                                <div className="admin-metric-card warning" style={{cursor: adminCommandMetrics.pendingPaymentCount > 0 ? "pointer" : "default"}} onClick={() => { if (adminCommandMetrics.pendingPaymentCount > 0) { setActiveTab("bookings"); setFilterStatus("unpaid"); } }}>
                                    <span>Payments Pending</span>
                                    <strong>${adminCommandMetrics.pendingPaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                    <small>{adminCommandMetrics.pendingPaymentCount} unpaid job{adminCommandMetrics.pendingPaymentCount !== 1 ? "s" : ""}</small>
                                </div>
                                <div className="admin-metric-card">
                                    <span>Completed Jobs</span>
                                    <strong>{adminCommandMetrics.completedCount}</strong>
                                    <small>{adminCommandMetrics.activeBookings} total active</small>
                                </div>
                                <div className="admin-metric-card">
                                    <span>Confirmed</span>
                                    <strong>{adminCommandMetrics.confirmed}</strong>
                                    <small>Upcoming confirmed jobs</small>
                                </div>
                                <div className="admin-metric-card" style={{cursor: adminCommandMetrics.pipeline > 0 ? "pointer" : "default"}} onClick={() => { if (adminCommandMetrics.pipeline > 0) { setActiveTab("bookings"); setFilterStatus("Pending"); } }}>
                                    <span>Pipeline</span>
                                    <strong>{adminCommandMetrics.pipeline}</strong>
                                    <small>{adminCommandMetrics.awaitingApproval > 0 ? `⏳ ${adminCommandMetrics.awaitingApproval} awaiting approval` : "Pending · leads · follow-ups"}</small>
                                </div>
                            </div>
                        )}

                        {/* Revenue & Wages Chart */}
                        <div className="dashboard-chart-section">
                            <div className="dashboard-chart-header">
                                <div>
                                    <h4 className="dashboard-chart-title">Revenue &amp; Wages</h4>
                                    <div className="dashboard-chart-legend">
                                        <span className="legend-revenue">Revenue (paid bookings)</span>
                                        <span className="legend-wages">Wages (payroll)</span>
                                    </div>
                                </div>
                                <div className="dashboard-chart-filters">
                                    {CHART_FILTERS.map(f => (
                                        <button
                                            key={f.key}
                                            type="button"
                                            className={`chart-filter-btn${chartFilter === f.key ? " active" : ""}`}
                                            onClick={() => setChartFilter(f.key)}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="dashboard-chart-body">
                                <RevenueWagesChart data={chartData} />
                            </div>
                        </div>

                        {/* Status & Payment pie charts */}
                        <div className="dashboard-pies-row">
                            <div className="dashboard-pie-card">
                                <h4 className="dashboard-pie-title">Booking Status</h4>
                                <div className="dashboard-pie-body">
                                    <PieChart size={110} segments={[
                                        { label: "Completed", value: adminCommandMetrics.completedCount, color: "#16a34a" },
                                        { label: "Confirmed", value: adminCommandMetrics.confirmed, color: "#0891b2" },
                                        { label: "Pipeline",  value: adminCommandMetrics.pipeline,   color: "#6366f1" },
                                    ]} />
                                    <div className="dashboard-pie-legend">
                                        {[
                                            { label: "Completed", color: "#16a34a", value: adminCommandMetrics.completedCount },
                                            { label: "Confirmed", color: "#0891b2", value: adminCommandMetrics.confirmed },
                                            { label: "Pipeline",  color: "#6366f1", value: adminCommandMetrics.pipeline },
                                        ].map(s => (
                                            <div key={s.label} className="pie-legend-item">
                                                <span className="pie-dot" style={{ background: s.color }} />
                                                <span className="pie-legend-label">{s.label}</span>
                                                <span className="pie-legend-val">{s.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="dashboard-pie-card">
                                <h4 className="dashboard-pie-title">Payment Overview</h4>
                                <div className="dashboard-pie-body">
                                    <PieChart size={110} segments={[
                                        { label: "Collected", value: adminCommandMetrics.paidRevenue,          color: "#16a34a" },
                                        { label: "Pending",   value: adminCommandMetrics.pendingPaymentAmount, color: "#f59e0b" },
                                    ]} />
                                    <div className="dashboard-pie-legend">
                                        {[
                                            { label: "Collected", color: "#16a34a", value: `$${adminCommandMetrics.paidRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
                                            { label: "Pending",   color: "#f59e0b", value: `$${adminCommandMetrics.pendingPaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
                                        ].map(s => (
                                            <div key={s.label} className="pie-legend-item">
                                                <span className="pie-dot" style={{ background: s.color }} />
                                                <span className="pie-legend-label">{s.label}</span>
                                                <span className="pie-legend-val">{s.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="admin-booking-workspace" ref={serviceCatalogRef}>
                            <aside className="admin-cart-panel admin-cart-panel--wide">
                                <div className="admin-section-heading">
                                    <div>
                                        <h4>Client Service Cart</h4>
                                        <p>Add multiple services before checkout.</p>
                                    </div>
                                    <span>{adminServiceCart.length} Items</span>
                                </div>
                                {adminServiceCart.length === 0 ? (
                                    <div className="admin-cart-empty">
                                        <strong>No services selected yet.</strong>
                                        <p>Click <em>New Booking</em> above to build a service quote using the booking wizard.</p>
                                    </div>
                                ) : (
                                    <div className="admin-cart-list">
                                        {adminServiceCart.map(item => {
                                            const basePrice = Number(item.basePrice || 0);
                                            const bathroomPrice = Number(item.bathroomPrice || 0);
                                            const addons = item.addons || [];
                                            return (
                                                <div key={item.cartId} className="admin-cart-item">
                                                    <div>
                                                        <strong>{item.name}</strong>
                                                        <span>
                                                            {item.optionName}
                                                            {item.bathroomKey ? ` • ${item.bathroomKey}` : ""}
                                                            {` • ${Number(item.durationHrs || 0).toFixed(1)} hrs`}
                                                        </span>
                                                        <div className="admin-cart-breakdown">
                                                            <div>
                                                                <span>Base service / tier</span>
                                                                <strong>${basePrice.toFixed(2)}</strong>
                                                            </div>
                                                            {bathroomPrice > 0 && (
                                                                <div>
                                                                    <span>{item.bathroomKey || "Bathroom adjustment"}</span>
                                                                    <strong>${bathroomPrice.toFixed(2)}</strong>
                                                                </div>
                                                            )}
                                                            {addons.length > 0 ? addons.map(addon => {
                                                                const qty = Number(addon.qty || 1);
                                                                const addonLineTotal = Number(addon.total ?? Number(addon.price || 0) * qty);
                                                                return (
                                                                    <div key={addon.id}>
                                                                        <span>{addon.name}{qty > 1 ? ` x${qty}` : ""}</span>
                                                                        <strong>${addonLineTotal.toFixed(2)}</strong>
                                                                    </div>
                                                                );
                                                            }) : (
                                                                <div>
                                                                    <span>Add-ons</span>
                                                                    <strong>$0.00</strong>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="admin-cart-price">
                                                        <strong>${Number(item.price || 0).toFixed(2)}</strong>
                                                        <button onClick={() => editAdminCartItem(item)} type="button" className="admin-cart-edit" aria-label={`Edit ${item.name}`}>
                                                            {Icons.Edit()}
                                                        </button>
                                                        <button onClick={() => removeAdminCartItem(item.cartId)} type="button" aria-label={`Remove ${item.name}`}>
                                                            {Icons.Trash()}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="admin-cart-totals">
                                    <div><span>Subtotal</span><strong>${adminCartTotals.subtotal.toFixed(2)}</strong></div>
                                    <div><span>{activeBranch.taxLabel}</span><strong>${adminCartTotals.tax.toFixed(2)}</strong></div>
                                    <div><span>Estimated Hours</span><strong>{adminCartTotals.duration.toFixed(1)}</strong></div>
                                    <div className="admin-cart-grand"><span>Total</span><strong>${adminCartTotals.total.toFixed(2)}</strong></div>
                                </div>
                                <button disabled={adminServiceCart.length === 0} onClick={checkoutAdminCart} type="button" className="admin-checkout-btn">
                                    Continue to Checkout
                                </button>
                            </aside>
                        </div>

                        <div className="admin-ops-grid">
                            <div className="admin-live-panel">
                                <div className="admin-section-heading">
                                    <div>
                                        <h4>Today&apos;s Dispatches</h4>
                                        <p>{new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </div>
                                    <span>{todayBookings.length} Jobs</span>
                                </div>
                                {todayBookings.length === 0 ? (
                                    <div className="admin-cart-empty">No dispatches scheduled for today.</div>
                                ) : (
                                    <div className="admin-dispatch-list">
                                        {todayBookings.slice(0, 5).map(b => (
                                            <button key={b.id} onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }} className="admin-dispatch-item" type="button">
                                                <span>{b.time}</span>
                                                <div>
                                                    <strong>{b.clientName}</strong>
                                                    <small>{b.service} • {b.team}</small>
                                                </div>
                                                <em>{b.status}</em>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="admin-live-panel">
                                <div className="admin-section-heading">
                                    <div>
                                        <h4>HR &amp; Compliance Queue</h4>
                                        <p>Employee/subcontractor readiness.</p>
                                    </div>
                                    <span>{pendingUsers.length} Pending</span>
                                </div>
                                <div className="admin-hr-queue">
                                    <div><strong>{fieldStaff.length}</strong><span>Approved field staff</span></div>
                                    <div><strong>{pendingUsers.length}</strong><span>Pending approvals</span></div>
                                    <div><strong>{bookings.filter(b => b.assignedStaffIds?.length > 0).length}</strong><span>Assigned jobs</span></div>
                                </div>
                                <button onClick={() => setActiveTab("departments")} className="admin-secondary-action" type="button">
                                    Open HR modules
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Permissioned pending user approvals table in Dashboard */}
                    {canManagePermissions && pendingUsers.length > 0 && (
                        <div className="panel-card mt-6 dashboard-desktop-only">
                            <div className="panel-header">
                                <h4>Awaiting operational registration approvals</h4>
                                <span className="badge badge-warning">{pendingUsers.length} Pending</span>
                            </div>
                            <div className="panel-body">
                                <div className="table-container">
                                    <table className="bookings-table">
                                        <thead>
                                            <tr>
                                                <th>Person Name</th>
                                                <th>Email Address</th>
                                                <th>Account Role</th>
                                                <th>Requested Role</th>
                                                <th className="text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingUsers.map(u => (
                                                <tr key={u.uid}>
                                                    <td className="font-bold text-slate-800">{u.name}</td>
                                                    <td>{u.email}</td>
                                                    <td>
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'customer' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {getRoleLabel(u.role)}
                                                        </span>
                                                    </td>
                                                    <td>{getRoleLabel(u.role)}</td>
                                                    <td className="text-right">
                                                        <div className="flex gap-2 justify-end">
                                                            <button onClick={() => handleResolveUserApproval(u.uid, "approve")} className="btn btn-secondary btn-sm">Approve</button>
                                                            <button onClick={() => handleResolveUserApproval(u.uid, "reject")} className="btn btn-danger btn-sm">Reject</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
