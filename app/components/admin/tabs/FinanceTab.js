"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

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
        <div style={{ background: alert ? "#fef2f2" : "#f8fafc", border: `1px solid ${alert ? "#fecaca" : "#e2e8f0"}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: alert ? "#dc2626" : "#1e293b", marginTop: 2 }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

function Panel({ title, children }) {
    return (
        <div className="settings-card">
            <div className="panel-header border-b border-slate-100 pb-3">
                <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">{title}</h4>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, paddingTop: 14 }}>
                {children}
            </div>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PRESETS.map(p => (
                    <button key={p.key} onClick={() => setPreset(p.key)} style={{
                        padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                        border: preset === p.key ? "1.5px solid #0891b2" : "1.5px solid #e2e8f0",
                        background: preset === p.key ? "#ecfeff" : "#fff",
                        color: preset === p.key ? "#0891b2" : "#64748b",
                    }}>{p.label}</button>
                ))}
                {preset === "custom" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ fontSize: 12, padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>to</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ fontSize: 12, padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                    </div>
                )}
            </div>

            {loading || !overview ? (
                <div className="text-center p-12 text-slate-400 text-sm">Loading finance data…</div>
            ) : (
                <>
                    <Panel title="Sales & Collections — Completed Jobs Only">
                        <StatCard label="Revenue (Period)" value={money(overview.sales.salesPeriod)} sub={`All-time: ${money(overview.sales.salesTotal)}`} />
                        <StatCard label="Collected (Period)" value={money(overview.sales.collectedPeriod)} sub={`All-time: ${money(overview.sales.collectedTotal)}`} />
                        <StatCard label="Unpaid / Owed Right Now" value={money(overview.sales.unpaidOwed)} alert={overview.sales.unpaidOwed > 0} sub="Completed jobs not yet fully paid" />
                        <StatCard label="Paid / Partial / Unpaid" value={`${overview.sales.paidCount} / ${overview.sales.partialCount} / ${overview.sales.unpaidCount}`} sub="Completed jobs by payment status" />
                    </Panel>

                    <Panel title="Cash Position">
                        <StatCard label="Cash In Hand" value={money(overview.cash.cashRemainingInHand)} sub="Running balance, not tied to the date filter" />
                        <StatCard label="Cash Received (Period)" value={money(overview.cash.cashReceivedPeriod)} />
                        <StatCard label="Cash Deposited (Period)" value={money(overview.cash.cashDepositedPeriod)} />
                        <StatCard label="Available Company Funds" value={money(overview.cash.availableCompanyFunds)} sub="Opening capital + collected − expenses, all-time" />
                    </Panel>

                    <Panel title="Expenses">
                        <StatCard label="Expenses (Period)" value={money(overview.expenses.expensesPeriod)} />
                        <StatCard label="Expenses (YTD)" value={money(overview.expenses.expensesYTD)} />
                        <StatCard label="Payroll (All-time)" value={money(overview.expenses.payrollExpenseTotal)} />
                        <StatCard label="Operating (All-time)" value={money(overview.expenses.operatingExpensesTotal)} />
                        <StatCard label="Startup/Capital (All-time)" value={money(overview.expenses.startupCapitalTotal)} />
                        <StatCard label="Reimbursements Pending" value={money(overview.expenses.reimbursementsPending)} alert={overview.expenses.reimbursementsPending > 0} />
                    </Panel>

                    <Panel title="Profit">
                        <StatCard label="Net Profit (Period)" value={money(overview.profit.netProfitPeriod)} />
                        <StatCard label="Net Profit (YTD)" value={money(overview.profit.netProfitYTD)} />
                        <StatCard label="Profit Margin (YTD)" value={pct(overview.profit.profitMarginYTD)} />
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

    if (loading || !forecast) return <div className="text-center p-12 text-slate-400 text-sm">Loading forecast…</div>;

    return (
        <div className="flex flex-col gap-4">
            <p style={{ fontSize: 12, color: "#94a3b8" }}>
                Run-rate projection: {forecast.daysElapsed} of {forecast.daysInMonth} days elapsed this month.
            </p>
            <Panel title="Month-End Forecast (Run Rate, Completed Jobs)">
                <StatCard label="Current Month Sales" value={money(forecast.currentMonthSales)} />
                <StatCard label="Avg Daily Sales" value={money(forecast.avgDailySales)} />
                <StatCard label="Expected Month-End Sales" value={money(forecast.expectedMonthEndSales)} />
                <StatCard label="Current Month Expenses" value={money(forecast.currentMonthExpenses)} />
                <StatCard label="Avg Daily Expenses" value={money(forecast.avgDailyExpenses)} />
                <StatCard label="Expected Month-End Expenses" value={money(forecast.expectedMonthEndExpenses)} />
                <StatCard label="Expected Month-End Profit" value={money(forecast.expectedMonthEndProfit)} />
            </Panel>
            <Panel title="Collection Forecast">
                <StatCard label="Historical Collection Rate" value={pct(forecast.collectionRate)} />
                <StatCard label="Unpaid / Owed Right Now" value={money(forecast.unpaidOwed)} />
                <StatCard label="Expected Collections This Month" value={money(forecast.expectedCollectionsThisMonth)} />
            </Panel>
            <Panel title="Job Performance">
                <StatCard label="Completed Jobs This Month" value={forecast.completedJobsThisMonth} />
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

    if (!settings) return <div className="text-center p-12 text-slate-400 text-sm">Loading…</div>;

    return (
        <div className="flex flex-col gap-4">
            <div className="settings-card">
                <div className="panel-header border-b border-slate-100 pb-3">
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Finance Settings</h4>
                </div>
                <div className="settings-form">
                    <div className="form-group">
                        <label>Opening Capital ($)</label>
                        <input type="number" step="0.01" value={settings.openingCapital} onChange={e => setSettings(prev => ({ ...prev, openingCapital: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>Payment Terms (days)</label>
                        <input type="number" value={settings.paymentTermsDays} onChange={e => setSettings(prev => ({ ...prev, paymentTermsDays: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>Card Processing Fee Rate (%)</label>
                        <input type="number" step="0.01" value={settings.cardProcessingFeeRatePercent} onChange={e => setSettings(prev => ({ ...prev, cardProcessingFeeRatePercent: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>Card Processing Fixed Fee ($)</label>
                        <input type="number" step="0.01" value={settings.cardProcessingFeeFixed} onChange={e => setSettings(prev => ({ ...prev, cardProcessingFeeFixed: e.target.value }))} />
                        <small className="text-slate-400">Applied automatically as an expense whenever a booking is paid by card.</small>
                    </div>
                    <button type="button" onClick={saveSettings} disabled={saving} className="btn btn-primary h-[40px] rounded-lg text-white font-bold transition mt-2">
                        {saving ? "Saving…" : "Save Settings"}
                    </button>
                    {feedback && <span style={{ fontSize: 11, color: "#64748b" }}>{feedback}</span>}
                </div>
            </div>

            <div className="settings-card">
                <div className="panel-header border-b border-slate-100 pb-3">
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Log a Cash Deposit</h4>
                    <p className="text-slate-500 text-xs mt-1">Record cash-on-hand deposited to the bank — feeds the Cash Position panel.</p>
                </div>
                <div className="settings-form">
                    <div className="form-group">
                        <label>Amount ($)</label>
                        <input type="number" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="form-group">
                        <label>Notes (optional)</label>
                        <input type="text" value={depositNotes} onChange={e => setDepositNotes(e.target.value)} placeholder="e.g. Weekly deposit" />
                    </div>
                    <button type="button" onClick={logDeposit} disabled={depositSaving || !depositAmount} className="btn btn-secondary h-[40px] rounded-lg font-bold transition mt-2">
                        {depositSaving ? "Logging…" : "Log Deposit"}
                    </button>
                </div>
                <div className="table-container" style={{ marginTop: 14 }}>
                    <table className="data-table">
                        <thead><tr><th>Date</th><th>Amount</th><th>Notes</th><th>Logged By</th></tr></thead>
                        <tbody>
                            {deposits.length === 0 ? (
                                <tr><td colSpan={4} className="text-center p-6 text-slate-400 text-xs">No deposits logged yet.</td></tr>
                            ) : deposits.map(d => (
                                <tr key={d.id}>
                                    <td>{d.date}</td>
                                    <td>${Number(d.amount).toFixed(2)}</td>
                                    <td>{d.notes || "—"}</td>
                                    <td>{d.depositedBy}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function FinanceTab({ getAuthHeaders }) {
    const [view, setView] = useState("overview");

    return (
        <div className="animate-fade">
            <div className="ops-control-header">
                <div>
                    <p className="ops-eyebrow">Finance</p>
                    <h3 className="ops-title">Financial Overview</h3>
                    <p className="ops-copy">Sales, cash, expenses, and profit — counted only from jobs marked Completed, computed live with a real date-range filter.</p>
                </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[
                    { key: "overview", label: "Overview" },
                    { key: "forecast", label: "Forecast" },
                    { key: "settings", label: "Settings & Cash Log" },
                ].map(t => (
                    <button key={t.key} onClick={() => setView(t.key)} style={{
                        padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        border: view === t.key ? "1.5px solid #0891b2" : "1.5px solid #e2e8f0",
                        background: view === t.key ? "#ecfeff" : "#fff",
                        color: view === t.key ? "#0891b2" : "#64748b",
                    }}>{t.label}</button>
                ))}
            </div>

            {view === "overview" && <OverviewView getAuthHeaders={getAuthHeaders} />}
            {view === "forecast" && <ForecastView getAuthHeaders={getAuthHeaders} />}
            {view === "settings" && <SettingsView getAuthHeaders={getAuthHeaders} />}
        </div>
    );
}
