"use client";
import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fmtMoney(n) {
    return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// A single label/value row inside a Business Health group card.
function HealthStat({ label, value, sub, tone, onClick }) {
    const toneClasses = tone === "alert"
        ? "text-destructive"
        : tone === "good"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-foreground";
    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center justify-between gap-3 rounded-lg px-2.5 py-2",
                onClick && "cursor-pointer hover:bg-muted",
            )}
        >
            <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                {sub && <span className="text-[11px] text-muted-foreground/80">{sub}</span>}
            </div>
            <strong className={cn("text-base font-bold", toneClasses)}>{value}</strong>
        </div>
    );
}

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
    const hasAnyData = data.some(d => d.revenue > 0 || d.wages > 0);
    const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.wages)), 100);
    const roundedMax = Math.ceil(maxVal / 500) * 500 || 500;
    const n = data.length;

    const W = 580, H = 230;
    const PL = 64, PR = 16, PT = 16, PB = 40;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const toY = v => PT + CH - (v / roundedMax) * CH;
    const slot = CW / n;
    const barW = Math.max(10, slot * 0.55);
    const xCenter = i => PL + (i + 0.5) * slot;

    const hasWages = data.some(d => d.wages > 0);
    const linePoints = data.map((d, i) => `${xCenter(i).toFixed(1)},${toY(d.wages).toFixed(1)}`).join(" ");

    const gridVals = [0.25, 0.5, 0.75, 1.0];

    if (!hasAnyData) {
        return (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600, flexDirection: "column", gap: 6 }}>
                <svg viewBox="0 0 40 32" width="40" height="32" fill="none">
                    <rect x="2" y="16" width="8" height="14" rx="2" fill="#e2e8f0" />
                    <rect x="16" y="8" width="8" height="22" rx="2" fill="#e2e8f0" />
                    <rect x="30" y="20" width="8" height="10" rx="2" fill="#e2e8f0" />
                </svg>
                No paid bookings in this period
            </div>
        );
    }

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
            {/* Grid lines */}
            {gridVals.map((pct, i) => {
                const y = toY(roundedMax * pct);
                return (
                    <g key={i}>
                        <line x1={PL} y1={y.toFixed(1)} x2={W - PR} y2={y.toFixed(1)} stroke={pct === 1.0 ? "#cbd5e1" : "#e9eef5"} strokeWidth={pct === 1.0 ? "1.5" : "1"} strokeDasharray={pct < 1.0 ? "4 3" : "none"} />
                        <text x={(PL - 8).toFixed(1)} y={(y + 4).toFixed(1)} textAnchor="end" fontSize="11" fill="#94a3b8" fontWeight="600">
                            ${Math.round(roundedMax * pct).toLocaleString()}
                        </text>
                    </g>
                );
            })}

            {/* Baseline */}
            <line x1={PL} y1={(PT + CH).toFixed(1)} x2={W - PR} y2={(PT + CH).toFixed(1)} stroke="#cbd5e1" strokeWidth="2" />

            {/* Revenue bars */}
            {data.map((d, i) => {
                const minH = d.revenue > 0 ? Math.max(4, (d.revenue / roundedMax) * CH) : 0;
                const bX = xCenter(i) - barW / 2;
                const bY = PT + CH - minH;
                return (
                    <g key={i}>
                        {/* Ghost bar so structure is always visible */}
                        <rect x={bX.toFixed(1)} y={PT.toFixed(1)} width={barW.toFixed(1)} height={CH.toFixed(1)} fill="#f1f5f9" rx="4" />
                        {d.revenue > 0 && (
                            <>
                                <rect x={bX.toFixed(1)} y={bY.toFixed(1)} width={barW.toFixed(1)} height={minH.toFixed(1)} fill="#1e3a5f" rx="4" opacity="0.9" />
                                {minH > 18 && (
                                    <text x={xCenter(i).toFixed(1)} y={(bY - 4).toFixed(1)} textAnchor="middle" fontSize="9" fill="#1e3a5f" fontWeight="700">
                                        ${d.revenue >= 1000 ? `${(d.revenue / 1000).toFixed(1)}k` : Math.round(d.revenue)}
                                    </text>
                                )}
                            </>
                        )}
                    </g>
                );
            })}

            {/* Wages line */}
            {hasWages && (
                <>
                    <polyline points={linePoints} fill="none" stroke="#f97316" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                    {data.map((d, i) => (
                        <circle key={i} cx={xCenter(i).toFixed(1)} cy={toY(d.wages).toFixed(1)} r="5" fill={d.wages > 0 ? "#f97316" : "#fed7aa"} stroke="#fff" strokeWidth="2" />
                    ))}
                </>
            )}

            {/* X-axis labels */}
            {data.map((d, i) => (
                <text key={i} x={xCenter(i).toFixed(1)} y={(H - 10).toFixed(1)} textAnchor="middle" fontSize={n > 8 ? "9" : "10"} fill="#64748b" fontWeight="600">
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
    activeBranch,
    todayBookings,
    pendingUsers,
    fieldStaff,
    activeTimeEntries,
    canManagePermissions,
    Icons,
    getPersonalReferralCode,
    getCustomerEligiblePromotions,
    setSelectedBooking,
    setDetailsModalOpen,
    setActiveTab,
    setFilterStatus,
    handleResolveUserApproval,
    getRoleLabel,
}) {
    const [chartFilter, setChartFilter] = useState("6m");

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
                    {/* Business Health summary — grouped, no operational actions here.
                        Booking creation lives in the Bookings module. */}
                    <section className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Business Health</p>
                                <h3 className="text-xl font-bold text-foreground">How is {activeBranch?.name || "the business"} doing today?</h3>
                            </div>
                            <Badge variant="secondary" className="h-7 rounded-full px-3 text-xs font-semibold">
                                {new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                            <Card>
                                <CardHeader><CardTitle>Today</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-1">
                                    <HealthStat label="Jobs Today" value={adminCommandMetrics.jobsToday} />
                                    <HealthStat label="Today's Revenue" value={fmtMoney(adminCommandMetrics.todayRevenue)} />
                                    <HealthStat label="Employees Working" value={(activeTimeEntries || []).length} />
                                    <HealthStat
                                        label="Needs Attention"
                                        value={adminCommandMetrics.jobsNeedingAttention}
                                        tone={adminCommandMetrics.jobsNeedingAttention > 0 ? "alert" : undefined}
                                        onClick={adminCommandMetrics.jobsNeedingAttention > 0 ? () => setActiveTab("bookings") : undefined}
                                    />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Daily P&amp;L</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-1">
                                    <HealthStat label="Revenue" value={fmtMoney(adminCommandMetrics.dailyPnl.revenue)} />
                                    <HealthStat label="Labor Cost" value={fmtMoney(adminCommandMetrics.dailyPnl.laborCost)} />
                                    <HealthStat label="Material Cost" value={fmtMoney(adminCommandMetrics.dailyPnl.materialCost)} />
                                    <HealthStat
                                        label="Net Profit"
                                        value={fmtMoney(adminCommandMetrics.dailyPnl.profit)}
                                        sub={`${adminCommandMetrics.jobsCompletedTodayWithFinancials} job${adminCommandMetrics.jobsCompletedTodayWithFinancials !== 1 ? "s" : ""} completed today`}
                                    />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Money</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-1">
                                    <HealthStat label="Payments Received" value={fmtMoney(adminCommandMetrics.paidRevenue)} />
                                    <HealthStat
                                        label="Outstanding Invoices"
                                        value={fmtMoney(adminCommandMetrics.pendingPaymentAmount)}
                                        sub={`${adminCommandMetrics.pendingPaymentCount} job${adminCommandMetrics.pendingPaymentCount !== 1 ? "s" : ""}`}
                                        tone={adminCommandMetrics.pendingPaymentCount > 0 ? "alert" : undefined}
                                        onClick={adminCommandMetrics.pendingPaymentCount > 0 ? () => { setActiveTab("bookings"); setFilterStatus("unpaid"); } : undefined}
                                    />
                                    <HealthStat
                                        label="Approved Expenses"
                                        value={fmtMoney(adminCommandMetrics.approvedExpenseTotal)}
                                        sub={`${adminCommandMetrics.pendingExpenseCount} pending approval`}
                                        tone={adminCommandMetrics.pendingExpenseCount > 0 ? "alert" : undefined}
                                        onClick={() => setActiveTab("expenses")}
                                    />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Pipeline &amp; Customers</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-1">
                                    <HealthStat label="New Leads" value={adminCommandMetrics.newLeads} onClick={() => { setActiveTab("bookings"); setFilterStatus("Lead"); }} />
                                    <HealthStat label="New Quotes" value={adminCommandMetrics.newQuotes} onClick={() => { setActiveTab("bookings"); setFilterStatus("Quote"); }} />
                                    <HealthStat
                                        label="Active Recurring Customers"
                                        value={adminCommandMetrics.uniqueRecurringCustomers}
                                        sub={`${adminCommandMetrics.recurringActive} scheduled visit${adminCommandMetrics.recurringActive !== 1 ? "s" : ""}`}
                                    />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Tomorrow</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-1">
                                    <HealthStat
                                        label="Readiness"
                                        value={adminCommandMetrics.jobsTomorrow === 0 ? "No jobs" : adminCommandMetrics.tomorrowReady ? "Ready ✓" : `${adminCommandMetrics.tomorrowUnassigned} unassigned`}
                                        sub={`${adminCommandMetrics.jobsTomorrow} confirmed job${adminCommandMetrics.jobsTomorrow !== 1 ? "s" : ""}`}
                                        tone={adminCommandMetrics.tomorrowReady ? "good" : adminCommandMetrics.jobsTomorrow > 0 ? "alert" : undefined}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    </section>

                    {/* Desktop-only dashboard sections */}
                    <section className="dashboard-desktop-only mt-6 flex flex-col gap-6">
                        {/* Revenue & Wages Chart */}
                        <Card>
                            <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                                <div>
                                    <CardTitle>Revenue &amp; Wages</CardTitle>
                                    <div className="mt-2 flex gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="inline-block h-3.5 w-3.5 rounded-sm bg-[#1e3a5f]" />
                                            <span className="text-xs font-semibold text-[#1e3a5f]">Revenue (paid bookings)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <svg width="22" height="14" viewBox="0 0 22 14" className="block">
                                                <line x1="0" y1="7" x2="22" y2="7" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
                                                <circle cx="11" cy="7" r="4" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
                                            </svg>
                                            <span className="text-xs font-semibold text-[#f97316]">Wages (payroll)</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {CHART_FILTERS.map(f => (
                                        <Button
                                            key={f.key}
                                            type="button"
                                            size="sm"
                                            variant={chartFilter === f.key ? "default" : "outline"}
                                            onClick={() => setChartFilter(f.key)}
                                        >
                                            {f.label}
                                        </Button>
                                    ))}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <RevenueWagesChart data={chartData} />
                            </CardContent>
                        </Card>

                        {/* Status & Payment pie charts */}
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader><CardTitle>Booking Status</CardTitle></CardHeader>
                                <CardContent className="flex items-center gap-6">
                                    <PieChart size={110} segments={[
                                        { label: "Completed", value: adminCommandMetrics.completedCount, color: "#16a34a" },
                                        { label: "Confirmed", value: adminCommandMetrics.confirmed, color: "#0891b2" },
                                        { label: "Pipeline",  value: adminCommandMetrics.pipeline,   color: "#6366f1" },
                                    ]} />
                                    <div className="flex flex-col gap-2">
                                        {[
                                            { label: "Completed", color: "#16a34a", value: adminCommandMetrics.completedCount },
                                            { label: "Confirmed", color: "#0891b2", value: adminCommandMetrics.confirmed },
                                            { label: "Pipeline",  color: "#6366f1", value: adminCommandMetrics.pipeline },
                                        ].map(s => (
                                            <div key={s.label} className="flex items-center gap-2 text-sm">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                                                <span className="text-muted-foreground">{s.label}</span>
                                                <span className="ml-auto font-bold text-foreground">{s.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Payment Overview</CardTitle></CardHeader>
                                <CardContent className="flex items-center gap-6">
                                    <PieChart size={110} segments={[
                                        { label: "Collected", value: adminCommandMetrics.paidRevenue,          color: "#16a34a" },
                                        { label: "Pending",   value: adminCommandMetrics.pendingPaymentAmount, color: "#f59e0b" },
                                    ]} />
                                    <div className="flex flex-col gap-2">
                                        {[
                                            { label: "Collected", color: "#16a34a", value: fmtMoney(adminCommandMetrics.paidRevenue) },
                                            { label: "Pending",   color: "#f59e0b", value: fmtMoney(adminCommandMetrics.pendingPaymentAmount) },
                                        ].map(s => (
                                            <div key={s.label} className="flex items-center gap-2 text-sm">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                                                <span className="text-muted-foreground">{s.label}</span>
                                                <span className="ml-auto font-bold text-foreground">{s.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Today's Dispatch + HR Queue */}
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader className="flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Today&apos;s Dispatches</CardTitle>
                                        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </div>
                                    <Badge variant="secondary">{todayBookings.length} Jobs</Badge>
                                </CardHeader>
                                <CardContent>
                                    {todayBookings.length === 0 ? (
                                        <div className="py-6 text-center text-sm text-muted-foreground">No dispatches scheduled for today.</div>
                                    ) : (
                                        <div className="flex flex-col gap-1.5">
                                            {todayBookings.slice(0, 5).map(b => (
                                                <button
                                                    key={b.id}
                                                    onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }}
                                                    type="button"
                                                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted"
                                                >
                                                    <span className="text-xs font-semibold text-muted-foreground">{b.time}</span>
                                                    <div className="flex-1">
                                                        <strong className="block text-sm text-foreground">{b.clientName}</strong>
                                                        <small className="text-xs text-muted-foreground">{b.service} • {b.team}</small>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>HR &amp; Compliance Queue</CardTitle>
                                        <p className="text-xs text-muted-foreground">Employee/subcontractor readiness.</p>
                                    </div>
                                    <Badge variant="secondary">{pendingUsers.length} Pending</Badge>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <strong className="block text-xl font-bold text-foreground">{fieldStaff.length}</strong>
                                            <span className="text-[11px] text-muted-foreground">Approved field staff</span>
                                        </div>
                                        <div>
                                            <strong className="block text-xl font-bold text-foreground">{pendingUsers.length}</strong>
                                            <span className="text-[11px] text-muted-foreground">Pending approvals</span>
                                        </div>
                                        <div>
                                            <strong className="block text-xl font-bold text-foreground">{bookings.filter(b => b.assignedStaffIds?.length > 0).length}</strong>
                                            <span className="text-[11px] text-muted-foreground">Assigned jobs</span>
                                        </div>
                                    </div>
                                    <Button variant="secondary" onClick={() => setActiveTab("departments")} type="button">
                                        Open HR modules
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </section>

                    {/* Permissioned pending user approvals table in Dashboard */}
                    {canManagePermissions && pendingUsers.length > 0 && (
                        <Card className="dashboard-desktop-only mt-6">
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>Awaiting operational registration approvals</CardTitle>
                                <Badge variant="secondary">{pendingUsers.length} Pending</Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto rounded-lg border border-border">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/50">
                                                <th className="px-4 py-2.5 font-semibold text-muted-foreground">Person Name</th>
                                                <th className="px-4 py-2.5 font-semibold text-muted-foreground">Email Address</th>
                                                <th className="px-4 py-2.5 font-semibold text-muted-foreground">Account Role</th>
                                                <th className="px-4 py-2.5 font-semibold text-muted-foreground">Requested Role</th>
                                                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingUsers.map(u => (
                                                <tr key={u.uid} className="border-b border-border last:border-0">
                                                    <td className="px-4 py-2.5 font-bold text-foreground">{u.name}</td>
                                                    <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                                                    <td className="px-4 py-2.5">
                                                        <Badge variant={u.role === "customer" ? "outline" : "secondary"}>{getRoleLabel(u.role)}</Badge>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-muted-foreground">{getRoleLabel(u.role)}</td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" variant="secondary" onClick={() => handleResolveUserApproval(u.uid, "approve")}>Approve</Button>
                                                            <Button size="sm" variant="destructive" onClick={() => handleResolveUserApproval(u.uid, "reject")}>Reject</Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
