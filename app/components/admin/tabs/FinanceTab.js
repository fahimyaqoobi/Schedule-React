"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

function money(n) {
    const num = Number(n || 0);
    const sign = num < 0 ? "-" : "";
    return `${sign}$${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function pct(n) {
    return `${(Number(n || 0) * 100).toFixed(1)}%`;
}
function pad(n) { return String(n).padStart(2, "0"); }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function computePresetRange(key) {
    const now = new Date();
    const today = toDateStr(now);
    if (key === "today") return { from: today, to: today };
    if (key === "week") {
        const dow = now.getDay();
        const monday = new Date(now); monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        return { from: toDateStr(monday), to: toDateStr(sunday) };
    }
    if (key === "month") {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { from: toDateStr(first), to: toDateStr(last) };
    }
    if (key === "last_month") {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        return { from: toDateStr(first), to: toDateStr(last) };
    }
    if (key === "quarter") {
        const q = Math.floor(now.getMonth() / 3);
        const first = new Date(now.getFullYear(), q * 3, 1);
        const last = new Date(now.getFullYear(), q * 3 + 3, 0);
        return { from: toDateStr(first), to: toDateStr(last) };
    }
    if (key === "ytd") {
        return { from: `${now.getFullYear()}-01-01`, to: today };
    }
    return { from: "", to: "" }; // all time
}

const PRESETS = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "last_month", label: "Last Month" },
    { key: "quarter", label: "This Quarter" },
    { key: "ytd", label: "YTD" },
    { key: "all", label: "All Time" },
    { key: "custom", label: "Custom" },
];

function StatCard({ label, value, sub, alert }) {
    return (
        <div className={cn("rounded-lg border p-3.5", alert ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30")}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn("mt-0.5 text-xl font-extrabold", alert ? "text-destructive" : "text-foreground")}>{value}</p>
            {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
    );
}

function Panel({ title, sub, children }) {
    return (
        <Card>
            <CardHeader><CardTitle className="text-sm">{title}</CardTitle>{sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}</CardHeader>
            <CardContent className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                {children}
            </CardContent>
        </Card>
    );
}

function InfoBanner({ children }) {
    return (
        <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-xs text-foreground/80">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{children}</span>
        </div>
    );
}

function PaymentMethodsPanel({ title, breakdown }) {
    const total = breakdown.reduce((s, m) => s + m.amount, 0);
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm">{title}</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">How the money you collected in this period actually came in.</p>
            </CardHeader>
            <CardContent>
                {breakdown.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">Nothing collected in this period yet.</p>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {breakdown.map(m => {
                            const widthPct = total > 0 ? (m.amount / total) * 100 : 0;
                            return (
                                <div key={m.method}>
                                    <div className="mb-1 flex justify-between text-xs">
                                        <span className="font-bold text-foreground">{m.label}</span>
                                        <span className="text-muted-foreground">{money(m.amount)} · {m.count} job{m.count === 1 ? "" : "s"}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div className="h-full rounded-full bg-cyan-600" style={{ width: `${widthPct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PresetPicker({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map(p => (
                <button
                    key={p.key}
                    onClick={() => setPreset(p.key)}
                    className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                        preset === p.key ? "border-cyan-600 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30" : "border-input bg-card text-muted-foreground"
                    )}
                >
                    {p.label}
                </button>
            ))}
            {preset === "custom" && (
                <div className="flex items-center gap-1.5">
                    <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 w-auto text-xs" />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 w-auto text-xs" />
                </div>
            )}
        </div>
    );
}

function OverviewView({ getAuthHeaders }) {
    const [preset, setPreset] = useState("month");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);

    const range = useMemo(() => preset === "custom" ? { from: customFrom, to: customTo } : computePresetRange(preset), [preset, customFrom, customTo]);
    const periodLabel = PRESETS.find(p => p.key === preset)?.label || "Period";

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const params = new URLSearchParams();
            if (range.from) params.set("from", range.from);
            if (range.to) params.set("to", range.to);
            const res = await fetch(`/api/finance/overview?${params.toString()}`, { headers });
            const data = await res.json();
            if (res.ok) setOverview(data);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders, range.from, range.to]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="flex flex-col gap-4">
            <PresetPicker preset={preset} setPreset={setPreset} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} />

            {loading || !overview ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading finance data…</div>
            ) : (
                <>
                    <InfoBanner>
                        Showing jobs <strong>marked Completed</strong> and <strong>scheduled {periodLabel === "Today" ? "today" : periodLabel === "All Time" ? "any time" : `in: ${periodLabel}`}</strong> ({range.from || "the beginning"} → {range.to || "now"}). A job's own date decides which period it falls into — not when it was booked or last edited.
                    </InfoBanner>

                    <Panel title={`Sales & Collections (${periodLabel})`}>
                        <StatCard label={`Revenue — ${periodLabel}`} value={money(overview.sales.salesPeriod)} sub={`Price of every completed job in this range · All-time: ${money(overview.sales.salesTotal)}`} />
                        <StatCard label={`Collected — ${periodLabel}`} value={money(overview.sales.collectedPeriod)} sub={`Money actually received on those same jobs · All-time: ${money(overview.sales.collectedTotal)}`} />
                        <StatCard label="Unpaid / Owed Right Now" value={money(overview.sales.unpaidOwed)} alert={overview.sales.unpaidOwed > 0} sub="Every completed job, ever, not yet fully paid — not limited to this period" />
                        <StatCard label={`Paid / Partial / Unpaid — ${periodLabel}`} value={`${overview.sales.paidCount} / ${overview.sales.partialCount} / ${overview.sales.unpaidCount}`} sub="Completed jobs in this period, by payment status" />
                    </Panel>

                    <PaymentMethodsPanel title={`Collected by Payment Method — ${periodLabel}`} breakdown={overview.sales.paymentMethodsPeriod} />

                    <Panel title="Cash Position (always as-of-now, not by period)">
                        <StatCard label="Cash In Hand" value={money(overview.cash.cashRemainingInHand)} sub="Cash collected minus cash spent minus cash deposited — running total" />
                        <StatCard label={`Cash Received — ${periodLabel}`} value={money(overview.cash.cashReceivedPeriod)} sub="Only jobs paid by the 'Cash' method" />
                        <StatCard label={`Cash Deposited — ${periodLabel}`} value={money(overview.cash.cashDepositedPeriod)} sub="From deposits you log in Settings & Cash Log" />
                        <StatCard label="Available Company Funds" value={money(overview.cash.availableCompanyFunds)} sub="Opening Capital + all money ever collected − all expenses ever approved" />
                    </Panel>

                    <Panel title={`Expenses (${periodLabel} + running totals)`}>
                        <StatCard label={`Expenses — ${periodLabel}`} value={money(overview.expenses.expensesPeriod)} sub="Approved expenses dated in this period" />
                        <StatCard label="Expenses — Year to Date" value={money(overview.expenses.expensesYTD)} sub="Always Jan 1 → today, regardless of the filter above" />
                        <StatCard label="Payroll — All-time" value={money(overview.expenses.payrollExpenseTotal)} />
                        <StatCard label="Operating — All-time" value={money(overview.expenses.operatingExpensesTotal)} sub="Everything except Payroll and Equipment" />
                        <StatCard label="Equipment/Capital — All-time" value={money(overview.expenses.startupCapitalTotal)} />
                        <StatCard label="Reimbursements Pending" value={money(overview.expenses.reimbursementsPending)} alert={overview.expenses.reimbursementsPending > 0} sub="Approved, marked reimbursable, not yet paid back" />
                    </Panel>

                    <Panel title={`Profit (${periodLabel} + Year to Date)`}>
                        <StatCard label={`Net Profit — ${periodLabel}`} value={money(overview.profit.netProfitPeriod)} sub="Revenue in this period minus expenses dated in this period" />
                        <StatCard label="Net Profit — Year to Date" value={money(overview.profit.netProfitYTD)} sub="Always Jan 1 → today" />
                        <StatCard label="Profit Margin — YTD" value={pct(overview.profit.profitMarginYTD)} sub="YTD profit ÷ YTD revenue" />
                    </Panel>
                </>
            )}
        </div>
    );
}

function ForecastView({ getAuthHeaders }) {
    const [forecast, setForecast] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch("/api/finance/forecast", { headers });
                const data = await res.json();
                if (res.ok) setForecast(data);
            } finally {
                setLoading(false);
            }
        })();
    }, [getAuthHeaders]);

    if (loading || !forecast) return <div className="py-12 text-center text-sm text-muted-foreground">Loading forecast…</div>;

    return (
        <div className="flex flex-col gap-4">
            <InfoBanner>
                This is a projection, not an actual — it takes what's happened so far this month ({forecast.daysElapsed} of {forecast.daysInMonth} days in) and assumes the rest of the month keeps the same daily pace. It will always be rough early in the month and more accurate closer to month-end.
            </InfoBanner>
            <Panel title="If This Pace Continues... (Completed Jobs This Month)">
                <StatCard label="Sales So Far This Month" value={money(forecast.currentMonthSales)} sub="Actual, not projected" />
                <StatCard label="Average Per Day So Far" value={money(forecast.avgDailySales)} sub={`Sales so far ÷ ${forecast.daysElapsed} days elapsed`} />
                <StatCard label="Projected Total This Month" value={money(forecast.expectedMonthEndSales)} sub={`Average per day × ${forecast.daysInMonth} days in the month`} />
                <StatCard label="Expenses So Far This Month" value={money(forecast.currentMonthExpenses)} sub="Actual, not projected" />
                <StatCard label="Projected Expenses This Month" value={money(forecast.expectedMonthEndExpenses)} />
                <StatCard label="Projected Profit This Month" value={money(forecast.expectedMonthEndProfit)} sub="Projected sales minus projected expenses" />
            </Panel>
            <Panel title="Collections Outlook">
                <StatCard label="Your Collection Track Record" value={pct(forecast.collectionRate)} sub="Of everything ever billed, this % has actually been collected" />
                <StatCard label="Unpaid / Owed Right Now" value={money(forecast.unpaidOwed)} sub="Same number as the Overview tab" />
                <StatCard label="Realistic Collections This Month" value={money(forecast.expectedCollectionsThisMonth)} sub="Unpaid amount × your track record — a guess, not a guarantee" />
            </Panel>
            <Panel title="Job Performance This Month">
                <StatCard label="Completed Jobs" value={forecast.completedJobsThisMonth} />
                <StatCard label="Average Revenue Per Job" value={money(forecast.averageRevenuePerJob)} />
            </Panel>
        </div>
    );
}

function SettingsView({ getAuthHeaders }) {
    const [settings, setSettings] = useState(null);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [deposits, setDeposits] = useState([]);
    const [depositAmount, setDepositAmount] = useState("");
    const [depositNotes, setDepositNotes] = useState("");
    const [depositSaving, setDepositSaving] = useState(false);

    const loadSettings = useCallback(async () => {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/finance/settings", { headers });
        const data = await res.json();
        if (res.ok) setSettings(data);
    }, [getAuthHeaders]);

    const loadDeposits = useCallback(async () => {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/cash-deposits", { headers });
        const data = await res.json();
        if (res.ok) setDeposits(data);
    }, [getAuthHeaders]);

    useEffect(() => { loadSettings(); loadDeposits(); }, [loadSettings, loadDeposits]);

    const saveSettings = async () => {
        setSaving(true);
        setFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/finance/settings", { method: "PUT", headers, body: JSON.stringify(settings) });
            const data = await res.json();
            setFeedback(res.ok ? "Saved." : (data.error || "Failed to save."));
        } finally {
            setSaving(false);
        }
    };

    const logDeposit = async () => {
        if (!depositAmount) return;
        setDepositSaving(true);
        try {
            const headers = await getAuthHeaders();
            await fetch("/api/cash-deposits", {
                method: "POST", headers,
                body: JSON.stringify({ amount: depositAmount, notes: depositNotes, date: new Date().toISOString().split("T")[0] }),
            });
            setDepositAmount(""); setDepositNotes("");
            await loadDeposits();
        } finally {
            setDepositSaving(false);
        }
    };

    if (!settings) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Finance Settings</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">All optional — leave anything at 0 if it doesn't apply to you yet. Nothing here is required for the Overview/Forecast numbers to work.</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label>Opening Capital ($)</Label>
                        <Input type="number" step="0.01" value={settings.openingCapital} onChange={e => setSettings(prev => ({ ...prev, openingCapital: e.target.value }))} />
                        <small className="text-xs text-muted-foreground">How much money you started the company with. Only affects one number: "Available Company Funds." Leave at 0 if you'd rather not track this.</small>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Payment Terms (days)</Label>
                        <Input type="number" value={settings.paymentTermsDays} onChange={e => setSettings(prev => ({ ...prev, paymentTermsDays: e.target.value }))} />
                        <small className="text-xs text-muted-foreground">Not currently used by any number on this page — reserved for a future "overdue" view. Safe to ignore.</small>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Card Processing Fee Rate (%)</Label>
                        <Input type="number" step="0.01" value={settings.cardProcessingFeeRatePercent} onChange={e => setSettings(prev => ({ ...prev, cardProcessingFeeRatePercent: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Card Processing Fixed Fee ($)</Label>
                        <Input type="number" step="0.01" value={settings.cardProcessingFeeFixed} onChange={e => setSettings(prev => ({ ...prev, cardProcessingFeeFixed: e.target.value }))} />
                        <small className="text-xs text-muted-foreground">Your card processor's rate (e.g. Stripe is usually 2.9% + $0.30/transaction). Whenever a job is paid by card, the fee is calculated from these two numbers and automatically logged as a "Processing Fees" expense — you don't need to enter it by hand.</small>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={saveSettings} disabled={saving}>{saving ? "Saving…" : "Save Settings"}</Button>
                        {feedback && <span className="text-xs text-muted-foreground">{feedback}</span>}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Log a Cash Deposit</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">Record cash-on-hand deposited to the bank — feeds the Cash Position panel.</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label>Amount ($)</Label>
                            <Input type="number" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Notes (optional)</Label>
                            <Input type="text" value={depositNotes} onChange={e => setDepositNotes(e.target.value)} placeholder="e.g. Weekly deposit" />
                        </div>
                    </div>
                    <Button variant="secondary" className="w-fit" onClick={logDeposit} disabled={depositSaving || !depositAmount}>
                        {depositSaving ? "Logging…" : "Log Deposit"}
                    </Button>
                    <Table>
                        <TableHeader>
                            <TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Notes</TableHead><TableHead>Logged By</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {deposits.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">No deposits logged yet.</TableCell></TableRow>
                            ) : deposits.map(d => (
                                <TableRow key={d.id}>
                                    <TableCell>{d.date}</TableCell>
                                    <TableCell>${Number(d.amount).toFixed(2)}</TableCell>
                                    <TableCell>{d.notes || "—"}</TableCell>
                                    <TableCell>{d.depositedBy}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default function FinanceTab({ getAuthHeaders }) {
    const [view, setView] = useState("overview");

    return (
        <div className="animate-fade flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Finance</p>
                    <CardTitle className="text-xl">Financial Overview</CardTitle>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Sales, cash, expenses, and profit — counted only from jobs marked Completed, computed live with a real date-range filter.</p>
                </CardHeader>
            </Card>

            <Tabs value={view} onValueChange={setView}>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="forecast">Forecast</TabsTrigger>
                    <TabsTrigger value="settings">Settings &amp; Cash Log</TabsTrigger>
                </TabsList>
            </Tabs>

            {view === "overview" && <OverviewView getAuthHeaders={getAuthHeaders} />}
            {view === "forecast" && <ForecastView getAuthHeaders={getAuthHeaders} />}
            {view === "settings" && <SettingsView getAuthHeaders={getAuthHeaders} />}
        </div>
    );
}
