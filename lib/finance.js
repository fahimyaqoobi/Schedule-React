import { FINANCE_SETTINGS_DEFAULTS } from "./financeDefaults";

function inRange(dateStr, from, to) {
    if (!dateStr) return false;
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
}

function datePart(iso) {
    return iso ? String(iso).split("T")[0] : "";
}

// "Sales Invoiced" follows when the invoice was created, not the job's
// scheduled service date. createdAt is our closest proxy to Invoice Date;
// falls back to the service date for older records that predate this field.
function invoiceDate(b) {
    return datePart(b.createdAt) || b.date || "";
}

// "Payments Collected" follows when the payment was recorded (paidAt).
// Bookings marked paid before that field existed have no paidAt — fall back
// to updatedAt, then the service date, so historical payments aren't
// silently dropped from every period total.
function paymentDate(b) {
    return datePart(b.paidAt) || datePart(b.updatedAt) || b.date || "";
}

function collectedAmount(b) {
    if (b.paymentStatus === "paid" || b.paymentStatus === "Paid") return parseFloat(b.price || b.totalAmount || 0);
    if (b.paymentStatus === "partial") return parseFloat(b.amountReceived || 0);
    return 0;
}

function receivableBalance(b) {
    return Math.max(0, parseFloat(b.price || 0) - parseFloat(b.amountReceived || 0));
}

// Only a Completed job is a real, billable piece of revenue — Leads, Quotes,
// and jobs that haven't happened yet don't belong in Sales/Collections/
// Receivables at all. This is the one filter every finance figure runs
// through, so nothing can drift out of sync with anything else.
function completedOnly(bookings) {
    return bookings.filter(b => b.status === "Completed");
}

function unpaidCompleted(completedBookings) {
    return completedBookings.filter(b => b.paymentStatus !== "paid");
}

// Mirrors the structure of the company's finance workbook (Dashboard sheet):
// Sales & Collections, Cash Position, Expenses, Profit — computed live from
// our own bookings/expenses/cashDeposits, for an arbitrary date range.
export function computeFinanceOverview({ bookings = [], expenses = [], cashDeposits = [], settings = {}, from = "", to = "" }) {
    const cfg = { ...FINANCE_SETTINGS_DEFAULTS, ...settings };
    const todayStr = new Date().toISOString().split("T")[0];
    const yearStart = `${new Date().getFullYear()}-01-01`;

    const completed = completedOnly(bookings);
    const approvedExpenses = expenses.filter(e => e.status === "approved");

    // ── Sales & Collections (Completed jobs only) ──
    const periodCompleted = completed.filter(b => inRange(invoiceDate(b), from, to));
    const salesPeriod = periodCompleted.reduce((s, b) => s + parseFloat(b.price || b.totalAmount || 0), 0);
    const salesTotal = completed.reduce((s, b) => s + parseFloat(b.price || b.totalAmount || 0), 0);

    const collectedInPeriod = completed.filter(b => inRange(paymentDate(b), from, to));
    const collectedPeriod = collectedInPeriod.reduce((s, b) => s + collectedAmount(b), 0);
    const collectedTotal = completed.reduce((s, b) => s + collectedAmount(b), 0);

    // Snapshot — what's owed right now, not tied to any period.
    const unpaid = unpaidCompleted(completed);
    const unpaidOwed = unpaid.reduce((s, b) => s + receivableBalance(b), 0);

    const paidCount = completed.filter(b => b.paymentStatus === "paid").length;
    const partialCount = completed.filter(b => b.paymentStatus === "partial").length;
    const unpaidCount = completed.filter(b => b.paymentStatus === "unpaid").length;

    // ── Cash Position ──
    const cashJobs = completed.filter(b => (b.paymentMethod || "") === "cash");
    const cashReceivedPeriod = cashJobs.filter(b => inRange(paymentDate(b), from, to)).reduce((s, b) => s + collectedAmount(b), 0);
    const cashReceivedTotal = cashJobs.reduce((s, b) => s + collectedAmount(b), 0);

    const cashExpenses = approvedExpenses.filter(e => e.paymentMethod === "Company Cash");
    const cashUsedForExpensesTotal = cashExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    // A reimbursement paid out of the cash drawer is also a real cash outflow,
    // separate from the original expense (which may have been "Personal").
    const cashUsedForReimbursements = expenses
        .filter(e => e.isReimbursable && e.reimbursementStatus === "paid" && e.reimbursedVia === "cash")
        .reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    const cashDepositedTotal = cashDeposits.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    const cashDepositedPeriod = cashDeposits.filter(d => inRange(d.date, from, to)).reduce((s, d) => s + parseFloat(d.amount || 0), 0);

    // Running balance — deliberately not period-filtered, same reasoning as a bank balance.
    const cashRemainingInHand = Math.max(0, cashReceivedTotal - cashUsedForExpensesTotal - cashUsedForReimbursements - cashDepositedTotal);
    const totalExpensesAllTime = approvedExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    // Everything the company owns: money actually collected minus every
    // approved expense recognized so far (accrual — an expense counts the
    // moment it's approved, whether or not it's been paid back yet).
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

    // ── Profit (accrual: sales from completed jobs minus expenses, for the period) ──
    const netProfitPeriod = salesPeriod - expensesPeriod;
    const salesYTD = completed.filter(b => inRange(invoiceDate(b), yearStart, todayStr)).reduce((s, b) => s + parseFloat(b.price || 0), 0);
    const netProfitYTD = salesYTD - expensesYTD;
    const profitMarginYTD = salesYTD > 0 ? netProfitYTD / salesYTD : 0;

    return {
        sales: {
            salesPeriod, salesTotal,
            collectedPeriod, collectedTotal,
            unpaidOwed,
            paidCount, partialCount, unpaidCount,
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

// Mirrors the Forecast & KPI Dashboard sheet — run-rate projections from the
// current month's pace so far. Same Completed-jobs-only scope as Overview,
// so "Outstanding" here always matches "Unpaid (Owed)" there.
export function computeFinanceForecast({ bookings = [], expenses = [] }) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const todayStr = now.toISOString().split("T")[0];

    const completed = completedOnly(bookings);
    const approvedExpenses = expenses.filter(e => e.status === "approved");

    const monthCompleted = completed.filter(b => inRange(invoiceDate(b), monthStart, todayStr));
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
