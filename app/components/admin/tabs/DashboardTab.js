"use client";
import { useState, useMemo } from "react";
import {
    DollarSign, TrendingUp, TriangleAlert, CalendarDays, Users,
    Wallet, UserPlus, FileText, CheckCircle2, ArrowRight, Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatZonedDate, getZonedDateKey, addDaysToKey } from "@/lib/timezone";

function fmtMoney(n) {
    return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function initials(name) {
    return (name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";
}

const TONE_STYLES = {
    default: { icon: "bg-primary/10 text-primary", value: "text-foreground" },
    alert: { icon: "bg-destructive/10 text-destructive", value: "text-destructive" },
    good: { icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", value: "text-emerald-600 dark:text-emerald-400" },
};

// A large, scannable hero metric — icon badge + big number + context line.
function HeroStat({ icon: Icon, label, value, sub, tone = "default", onClick }) {
    const t = TONE_STYLES[tone] || TONE_STYLES.default;
    return (
        <Card
            onClick={onClick}
            className={cn(
                "relative overflow-hidden transition-shadow",
                onClick && "cursor-pointer hover:shadow-md",
            )}
        >
            <CardContent className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                    <strong className={cn("text-[26px] leading-none font-bold tabular-nums", t.value)}>{value}</strong>
                    {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
                </div>
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", t.icon)}>
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                </span>
            </CardContent>
        </Card>
    );
}

// A compact chip for secondary metrics that don't need hero treatment.
function QuickChip({ icon: Icon, label, value, tone = "default", onClick }) {
    const t = TONE_STYLES[tone] || TONE_STYLES.default;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                "flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-4 pl-1.5 text-left transition-colors",
                onClick && "cursor-pointer hover:border-primary/40 hover:bg-muted",
                !onClick && "cursor-default",
            )}
        >
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", t.icon)}>
                <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <span className="flex flex-col leading-tight">
                <span className={cn("text-sm font-bold tabular-nums", t.value)}>{value}</span>
                <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
            </span>
        </button>
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

// Boundaries here must be the branch's calendar days, computed consistently
// in one timezone throughout — the previous version mixed ambient-local
// Date arithmetic (`new Date()`, `.setDate()`) with `.toISOString()` (always
// UTC) to derive the day-key, which quietly shifted every bucket by a day
// whenever it was evening in a negative-UTC-offset zone like Eastern (i.e.
// most of the business day). Everything below stays in explicit
// branch-calendar-date-key space until the very end, when a label is formatted.
function getPeriods(filter) {
    const todayKey = getZonedDateKey(new Date());
    const periods = [];

    const labelFor = (dayKey, opts) => formatZonedDate(new Date(`${dayKey}T12:00:00Z`), opts);

    if (filter === "7d") {
        for (let i = 6; i >= 0; i--) {
            const dayKey = addDaysToKey(todayKey, -i);
            periods.push({
                label: labelFor(dayKey, { month: "short", day: "numeric" }),
                start: dayKey,
                end: dayKey,
            });
        }
    } else if (filter === "4w") {
        for (let i = 3; i >= 0; i--) {
            const endKey = addDaysToKey(todayKey, -i * 7);
            const startKey = addDaysToKey(endKey, -6);
            periods.push({ label: `Wk ${4 - i}`, start: startKey, end: endKey });
        }
    } else {
        const months = filter === "3m" ? 3 : filter === "6m" ? 6 : 12;
        const withYear = months > 6;
        const [ty, tm] = todayKey.split("-").map(Number);
        for (let i = months - 1; i >= 0; i--) {
            // Month arithmetic anchored to a neutral UTC scratch instant
            // (noon, day 1) — never exposed, just used to compute the
            // month's first/last calendar day without ambient-zone drift.
            const monthStart = new Date(Date.UTC(ty, tm - 1 - i, 1, 12));
            const monthEnd = new Date(Date.UTC(ty, tm - i, 0, 12));
            const startKey = monthStart.toISOString().slice(0, 10);
            const endKey = monthEnd.toISOString().slice(0, 10);
            const label = withYear
                ? formatZonedDate(monthStart, { month: "short", year: "2-digit" })
                : formatZonedDate(monthStart, { month: "short" });
            periods.push({ label, start: startKey, end: endKey });
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
                                                                            // Anchored to UTC noon, not local midnight, so this
                                                                            // date-only add/format can't roll onto the wrong
                                                                            // branch calendar day depending on viewer/server tz.
                                                                            const d = new Date(`${b.date}T12:00:00Z`);
                                                                            if (freq === "Weekly") d.setUTCDate(d.getUTCDate() + 7);
                                                                            if (freq === "Bi-Weekly") d.setUTCDate(d.getUTCDate() + 14);
                                                                            if (freq === "Monthly") d.setUTCMonth(d.getUTCMonth() + 1);
                                                                            return formatZonedDate(d, {}, undefined, "en-CA");
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
                    <section className="flex flex-col gap-5">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <Sparkles className="h-5 w-5" strokeWidth={2.25} />
                                </span>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Business Health</p>
                                    <h3 className="text-xl font-bold text-foreground">How is {activeBranch?.name || "the business"} doing today?</h3>
                                </div>
                            </div>
                            <Badge variant="secondary" className="h-7 rounded-full px-3 text-xs font-semibold">
                                {new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </Badge>
                        </div>

                        {/* Hero metrics — the four numbers that matter most, at a glance */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <HeroStat
                                icon={DollarSign}
                                label="Today's Revenue"
                                value={fmtMoney(adminCommandMetrics.todayRevenue)}
                                sub={`${adminCommandMetrics.jobsCompletedToday} completed of ${adminCommandMetrics.jobsToday} scheduled today`}
                            />
                            <HeroStat
                                icon={TrendingUp}
                                label="Net Profit (Today)"
                                value={fmtMoney(adminCommandMetrics.dailyPnl.profit)}
                                sub={`${adminCommandMetrics.jobsCompletedTodayWithFinancials} job${adminCommandMetrics.jobsCompletedTodayWithFinancials !== 1 ? "s" : ""} completed · after labor & material`}
                                tone={adminCommandMetrics.dailyPnl.profit >= 0 ? "good" : "alert"}
                            />
                            <HeroStat
                                icon={Wallet}
                                label="Outstanding"
                                value={fmtMoney(adminCommandMetrics.pendingPaymentAmount)}
                                sub={`${adminCommandMetrics.pendingPaymentCount} unpaid job${adminCommandMetrics.pendingPaymentCount !== 1 ? "s" : ""}`}
                                tone={adminCommandMetrics.pendingPaymentCount > 0 ? "alert" : "default"}
                                onClick={adminCommandMetrics.pendingPaymentCount > 0 ? () => { setActiveTab("bookings"); setFilterStatus("unpaid"); } : undefined}
                            />
                            <HeroStat
                                icon={CalendarDays}
                                label="Tomorrow"
                                value={adminCommandMetrics.jobsTomorrow === 0 ? "No jobs" : adminCommandMetrics.tomorrowReady ? "Ready" : `${adminCommandMetrics.tomorrowUnassigned} unassigned`}
                                sub={`${adminCommandMetrics.jobsTomorrow} confirmed job${adminCommandMetrics.jobsTomorrow !== 1 ? "s" : ""}`}
                                tone={adminCommandMetrics.tomorrowReady ? "good" : adminCommandMetrics.jobsTomorrow > 0 ? "alert" : "default"}
                            />
                        </div>

                        {/* Quick stats — secondary numbers, one glance, one tap to drill in */}
                        <div className="flex flex-wrap gap-2">
                            <QuickChip icon={Users} label="Employees Working" value={(activeTimeEntries || []).length} />
                            <QuickChip
                                icon={TriangleAlert}
                                label="Needs Attention"
                                value={adminCommandMetrics.jobsNeedingAttention}
                                tone={adminCommandMetrics.jobsNeedingAttention > 0 ? "alert" : "default"}
                                onClick={adminCommandMetrics.jobsNeedingAttention > 0 ? () => setActiveTab("bookings") : undefined}
                            />
                            <QuickChip icon={UserPlus} label="New Leads" value={adminCommandMetrics.newLeads} onClick={() => { setActiveTab("bookings"); setFilterStatus("Lead"); }} />
                            <QuickChip icon={FileText} label="New Quotes" value={adminCommandMetrics.newQuotes} onClick={() => { setActiveTab("bookings"); setFilterStatus("Quote"); }} />
                            <QuickChip
                                icon={CheckCircle2}
                                label={`Recurring Customers · ${adminCommandMetrics.recurringActive} visit${adminCommandMetrics.recurringActive !== 1 ? "s" : ""}`}
                                value={adminCommandMetrics.uniqueRecurringCustomers}
                            />
                            <QuickChip
                                icon={Wallet}
                                label={`Expenses · ${adminCommandMetrics.pendingExpenseCount} pending`}
                                value={fmtMoney(adminCommandMetrics.approvedExpenseTotal)}
                                tone={adminCommandMetrics.pendingExpenseCount > 0 ? "alert" : "default"}
                                onClick={() => setActiveTab("expenses")}
                            />
                        </div>
                    </section>

                    {/* Desktop-only dashboard sections */}
                    <section className="mt-6 hidden flex-col gap-6 md:flex">
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
                                <div className="flex flex-wrap gap-0.5 rounded-full bg-muted p-1">
                                    {CHART_FILTERS.map(f => (
                                        <button
                                            key={f.key}
                                            type="button"
                                            onClick={() => setChartFilter(f.key)}
                                            className={cn(
                                                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                                                chartFilter === f.key
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground",
                                            )}
                                        >
                                            {f.label}
                                        </button>
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
                                    <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center">
                                        <PieChart size={120} segments={[
                                            { label: "Completed", value: adminCommandMetrics.completedCount, color: "#16a34a" },
                                            { label: "Confirmed", value: adminCommandMetrics.confirmed, color: "#0891b2" },
                                            { label: "Pipeline",  value: adminCommandMetrics.pipeline,   color: "#6366f1" },
                                        ]} />
                                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                            <strong className="text-lg font-bold text-foreground">
                                                {adminCommandMetrics.completedCount + adminCommandMetrics.confirmed + adminCommandMetrics.pipeline}
                                            </strong>
                                            <span className="text-[10px] font-medium text-muted-foreground">Total</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 flex-col gap-1.5">
                                        {[
                                            { label: "Completed", color: "#16a34a", value: adminCommandMetrics.completedCount },
                                            { label: "Confirmed", color: "#0891b2", value: adminCommandMetrics.confirmed },
                                            { label: "Pipeline",  color: "#6366f1", value: adminCommandMetrics.pipeline },
                                        ].map(s => (
                                            <div key={s.label} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">
                                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                                                <span className="text-muted-foreground">{s.label}</span>
                                                <span className="ml-auto font-bold tabular-nums text-foreground">{s.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Payment Overview</CardTitle></CardHeader>
                                <CardContent className="flex items-center gap-6">
                                    <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center">
                                        <PieChart size={120} segments={[
                                            { label: "Collected", value: adminCommandMetrics.paidRevenue,          color: "#16a34a" },
                                            { label: "Pending",   value: adminCommandMetrics.pendingPaymentAmount, color: "#f59e0b" },
                                        ]} />
                                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                                            <strong className="text-sm font-bold text-foreground">
                                                {fmtMoney(adminCommandMetrics.paidRevenue + adminCommandMetrics.pendingPaymentAmount)}
                                            </strong>
                                            <span className="text-[10px] font-medium text-muted-foreground">Billed</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 flex-col gap-1.5">
                                        {[
                                            { label: "Collected", color: "#16a34a", value: fmtMoney(adminCommandMetrics.paidRevenue) },
                                            { label: "Pending",   color: "#f59e0b", value: fmtMoney(adminCommandMetrics.pendingPaymentAmount) },
                                        ].map(s => (
                                            <div key={s.label} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">
                                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                                                <span className="text-muted-foreground">{s.label}</span>
                                                <span className="ml-auto font-bold tabular-nums text-foreground">{s.value}</span>
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
                                        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                                            <CalendarDays className="h-6 w-6 text-muted-foreground/50" />
                                            No dispatches scheduled for today.
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-1">
                                            {todayBookings.slice(0, 5).map(b => {
                                                const staffIds = b.assignedStaffIds || [];
                                                const confirmations = b.assignedStaffConfirmations || {};
                                                const unconfirmedCount = staffIds.filter(uid => confirmations[uid]?.status !== "confirmed").length;
                                                const hasDeclined = staffIds.some(uid => confirmations[uid]?.status === "declined");
                                                return (
                                                    <button
                                                        key={b.id}
                                                        onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }}
                                                        type="button"
                                                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                                                    >
                                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                            {initials(b.clientName)}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <strong className="block truncate text-sm text-foreground">{b.clientName}</strong>
                                                            <small className="block truncate text-xs text-muted-foreground">{b.time} · {b.service}{b.team ? ` · ${b.team}` : ""}</small>
                                                        </div>
                                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                                            <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                                                            {unconfirmedCount > 0 && (
                                                                <Badge
                                                                    variant={hasDeclined ? "destructive" : "secondary"}
                                                                    className={cn(
                                                                        "text-[10px]",
                                                                        !hasDeclined && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                                                                    )}
                                                                >
                                                                    {hasDeclined ? "⚠ Declined" : "⏳ Not confirmed"}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            {todayBookings.length > 5 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab("bookings")}
                                                    className="mt-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold text-primary hover:bg-muted"
                                                >
                                                    View all {todayBookings.length} <ArrowRight className="h-3 w-3" />
                                                </button>
                                            )}
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
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { value: fieldStaff.length, label: "Approved field staff" },
                                            { value: pendingUsers.length, label: "Pending approvals", alert: pendingUsers.length > 0 },
                                            { value: bookings.filter(b => b.assignedStaffIds?.length > 0).length, label: "Assigned jobs" },
                                        ].map(s => (
                                            <div key={s.label} className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 px-2 py-3 text-center">
                                                <strong className={cn("text-xl font-bold tabular-nums", s.alert ? "text-destructive" : "text-foreground")}>{s.value}</strong>
                                                <span className="text-[11px] leading-tight text-muted-foreground">{s.label}</span>
                                            </div>
                                        ))}
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
                        <Card className="mt-6 hidden md:block">
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>Awaiting operational registration approvals</CardTitle>
                                <Badge variant="secondary">{pendingUsers.length} Pending</Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-hidden rounded-lg border border-border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                <TableHead>Person Name</TableHead>
                                                <TableHead>Email Address</TableHead>
                                                <TableHead>Account Role</TableHead>
                                                <TableHead>Requested Role</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pendingUsers.map(u => (
                                                <TableRow key={u.uid}>
                                                    <TableCell className="font-bold text-foreground">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                                                                {initials(u.name)}
                                                            </span>
                                                            {u.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={u.role === "customer" ? "outline" : "secondary"}>{getRoleLabel(u.role)}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{getRoleLabel(u.role)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" variant="secondary" onClick={() => handleResolveUserApproval(u.uid, "approve")}>Approve</Button>
                                                            <Button size="sm" variant="destructive" onClick={() => handleResolveUserApproval(u.uid, "reject")}>Reject</Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
