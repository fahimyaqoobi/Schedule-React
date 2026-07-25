import { FINANCE_SETTINGS_DEFAULTS } from "./financeDefaults";

function inRange(dateStr, from, to) {
    if (!dateStr) return false;
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
}

// ONE rule, used everywhere: a job's date is its date. "Today" means jobs
// scheduled for today — not when the record was created, last edited, or
// when a payment happened to get typed in. Any other anchor (createdAt,
// updatedAt, paidAt) drifts every time a booking is re-saved for an
// unrelated reason, which is exactly what made the old numbers untrustworthy.
function jobDate(b) {
    return b.date || "";
}

function collectedAmount(b) {
    if (b.paymentStatus === "paid" || b.paymentStatus === "Paid") return parseFloat(b.price || b.totalAmount || 0);
    if (b.paymentStatus === "partial") return parseFloat(b.amountReceived || 0);
    return 0;
}

function receivableBalance(b) {
    return Math.max(0, parseFloat(b.price || 0) - parseFloat(b.amountReceived || 0));
}

// Only a Completed job is real, billable revenue — Leads, Quotes, and jobs
// that haven't happened yet don't belong in Sales/Collections/Receivables at
// all. This is the one filter every finance figure runs through, so nothing
// can drift out of sync with anything else.
function completedOnly(bookings) {
    return bookings.filter(b => b.status === "Completed");
}

function unpaidCompleted(completedBookings) {
    return completedBookings.filter(b => b.paymentStatus !== "paid");
}

const METHOD_LABELS = {
    cash: "Cash",
    "e-transfer": "E-Transfer",
    "credit-card": "Card",
    "direct-deposit": "Direct Deposit",
    cheque: "Cheque",
    unspecified: "Not Specified",
};

// How money actually came in, broken down by method — cash vs. card vs.
// e-transfer etc. — for whatever set of jobs is passed in.
function paymentMethodBreakdown(jobs) {
    const buckets = {};
    jobs.forEach(b => {
        const collected = collectedAmount(b);
        if (collected <= 0) return;
        const key = b.paymentMethod || "unspecified";
        if (!buckets[key]) buckets[key] = { method: key, label: METHOD_LABELS[key] || key, amount: 0, count: 0 };
        buckets[key].amount += collected;
        buckets[key].count += 1;
    });
    return Object.values(buckets).sort((a, b) => b.amount - a.amount);
}

// Sales & Collections, Cash Position, Expenses, Profit — computed live from
// bookings/expenses/cashDeposits for an arbitrary date range. Every "Period"
// figure below is scoped to the job's own date (jobDate) — the same rule,
// with no exceptions, so switching the date filter always means exactly
// "jobs scheduled in this range," nothing more subtle than that.
export function computeFinanceOverview({ bookings = [], expenses = [], cashDeposits = [], settings = {}, from = "", to = "" }) {
    const cfg = { ...FINANCE_SETTINGS_DEFAULTS, ...settings };
    const todayStr = new Date().toISOString().split("T")[0];
    const yearStart = `${new Date().getFullYear()}-01-01`;

    const completed = completedOnly(bookings);
    const approvedExpenses = expenses.filter(e => e.status === "approved");

    // ── Sales & Collections (Completed jobs, scoped by job date) ──
    const periodCompleted = completed.filter(b => inRange(jobDate(b), from, to));
    const salesPeriod = periodCompleted.reduce((s, b) => s + parseFloat(b.price || b.totalAmount || 0), 0);
    const salesTotal = completed.reduce((s, b) => s + parseFloat(b.price || b.totalAmount || 0), 0);

    // Collected for the period = money actually received on THOSE SAME jobs
    // (jobs scheduled in this range), not payments recorded on unrelated jobs.
    const collectedPeriod = periodCompleted.reduce((s, b) => s + collectedAmount(b), 0);
    const collectedTotal = completed.reduce((s, b) => s + collectedAmount(b), 0);

    // Snapshot — what's owed right now, across every completed job ever, not tied to any period.
    const unpaid = unpaidCompleted(completed);
    const unpaidOwed = unpaid.reduce((s, b) => s + receivableBalance(b), 0);

    const paidCount = periodCompleted.filter(b => b.paymentStatus === "paid").length;
    const partialCount = periodCompleted.filter(b => b.paymentStatus === "partial").length;
    const unpaidCount = periodCompleted.filter(b => b.paymentStatus === "unpaid").length;

    // Collected broken down by how it actually came in — cash vs card vs
    // e-transfer etc. — for this period, and again all-time for context.
    const paymentMethodsPeriod = paymentMethodBreakdown(periodCompleted);
    const paymentMethodsTotal = paymentMethodBreakdown(completed);

    // ── Cash Position ──
    const cashJobsPeriod = periodCompleted.filter(b => (b.paymentMethod || "") === "cash");
    const cashReceivedPeriod = cashJobsPeriod.reduce((s, b) => s + collectedAmount(b), 0);
    const cashReceivedTotal = completed.filter(b => (b.paymentMethod || "") === "cash").reduce((s, b) => s + collectedAmount(b), 0);

    const cashExpenses = approvedExpenses.filter(e => e.paymentMethod === "Company Cash");
    const cashUsedForExpensesTotal = cashExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    // A reimbursement paid out of the cash drawer is also a real cash outflow,
    // separate from the original expense (which may have been "Personal").
    const cashUsedForReimbursements = expenses
        .filter(e => e.isReimbursable && e.reimbursementStatus === "paid" && e.reimbursedVia === "cash")
        .reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    const cashDepositedTotal = cashDeposits.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    const cashDepositedPeriod = cashDeposits.filter(d => inRange(d.date, from, to)).reduce((s, d) => s + parseFloat(d.amount || 0), 0);

    // Running balance — deliberately not period-filtered, same reasoning as a bank balance:
    // "how much cash is in the drawer right now" doesn't have a "just today" version.
    const cashRemainingInHand = Math.max(0, cashReceivedTotal - cashUsedForExpensesTotal - cashUsedForReimbursements - cashDepositedTotal);
    const totalExpensesAllTime = approvedExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    // Everything the company owns: money actually collected minus every
    // approved expense recognized so far (an expense counts the moment it's
    // approved, whether or not it's been paid back to whoever fronted it).
    const availableCompanyFunds = cfg.openingCapital + collectedTotal - totalExpensesAllTime;

    // ── Expenses ──
    const periodExpenses = approvedExpenses.filter(e => inRange(e.date, from, to));
    const expensesPeriod = periodExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const ytdExpenses = approvedExpenses.filter(e => inRange(e.date, yearStart, todayStr));
    const expensesYTD = ytdExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const payrollExpenseTotal = approvedExpenses.filter(e => e.category === "Payroll").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const startupCapitalTotal = approvedExpenses.filter(e => e.category === "Equipment").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const operatingExpensesTotal = totalExpensesAllTime - payrollExpenseTotal - startupCapitalTotal;
    const reimbursementsPending = expenses.filter(e => e.isReimbursable && e.reimbursementStatus === "pending" && e.status === "approved")
        .reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    // ── Profit (sales from completed jobs minus expenses, both scoped to the same period) ──
    const netProfitPeriod = salesPeriod - expensesPeriod;
    const salesYTD = completed.filter(b => inRange(jobDate(b), yearStart, todayStr)).reduce((s, b) => s + parseFloat(b.price || 0), 0);
    const netProfitYTD = salesYTD - expensesYTD;
    const profitMarginYTD = salesYTD > 0 ? netProfitYTD / salesYTD : 0;

    return {
        sales: {
            salesPeriod, salesTotal,
            collectedPeriod, collectedTotal,
            unpaidOwed,
            paidCount, partialCount, unpaidCount,
            paymentMethodsPeriod, paymentMethodsTotal,
        },
        cash: {
            cashReceivedPeriod, cashReceivedTotal,
            cashUsedForExpensesTotal, cashUsedForReimbursements,
            cashDepositedPeriod, cashDepositedTotal,
            cashRemainingInHand, availableCompanyFunds,
        },
        expenses: {
            expensesPeriod, expensesYTD, payrollExpenseTotal,
            operatingExpensesTotal, startupCapitalTotal, reimbursementsPending,
            totalExpensesAllTime,
        },
        profit: {
            netProfitPeriod, netProfitYTD, profitMarginYTD, salesYTD,
        },
        settings: cfg,
    };
}

// Mirrors a Forecast & KPI Dashboard — run-rate projections from the current
// month's pace so far. Same Completed-jobs-only, jobDate-scoped rule as
// Overview, so "Unpaid / Owed" here always matches Overview exactly.
export function computeFinanceForecast({ bookings = [], expenses = [] }) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const todayStr = now.toISOString().split("T")[0];

    const completed = completedOnly(bookings);
    const approvedExpenses = expenses.filter(e => e.status === "approved");

    const monthCompleted = completed.filter(b => inRange(jobDate(b), monthStart, todayStr));
    const currentMonthSales = monthCompleted.reduce((s, b) => s + parseFloat(b.price || 0), 0);
    const avgDailySales = daysElapsed > 0 ? currentMonthSales / daysElapsed : 0;
    const expectedMonthEndSales = avgDailySales * daysInMonth;

    const monthExpenses = approvedExpenses.filter(e => inRange(e.date, monthStart, todayStr));
    const currentMonthExpenses = monthExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const avgDailyExpenses = daysElapsed > 0 ? currentMonthExpenses / daysElapsed : 0;
    const expectedMonthEndExpenses = avgDailyExpenses * daysInMonth;
    const expectedMonthEndProfit = expectedMonthEndSales - expectedMonthEndExpenses;

    const totalInvoicedAllTime = completed.reduce((s, b) => s + parseFloat(b.price || 0), 0);
    const totalCollectedAllTime = completed.reduce((s, b) => s + collectedAmount(b), 0);
    const collectionRate = totalInvoicedAllTime > 0 ? totalCollectedAllTime / totalInvoicedAllTime : 0;
    const unpaidOwed = unpaidCompleted(completed).reduce((s, b) => s + receivableBalance(b), 0);
    const expectedCollectionsThisMonth = unpaidOwed * collectionRate;

    const completedJobsThisMonth = monthCompleted.length;
    const averageRevenuePerJob = currentMonthSales > 0 && monthCompleted.length > 0 ? currentMonthSales / monthCompleted.length : 0;

    return {
        daysElapsed, daysInMonth,
        currentMonthSales, avgDailySales, expectedMonthEndSales,
        currentMonthExpenses, avgDailyExpenses, expectedMonthEndExpenses,
        expectedMonthEndProfit,
        collectionRate, unpaidOwed, expectedCollectionsThisMonth,
        completedJobsThisMonth, averageRevenuePerJob,
    };
}
