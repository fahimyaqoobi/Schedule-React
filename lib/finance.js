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

// "Sales Invoiced" should follow when the invoice was created, not the job's
// scheduled service date — a job booked today for next month is invoiced
// today. createdAt is our closest proxy to Invoice Date; falls back to the
// service date for older records that predate this field.
function invoiceDate(b) {
    return datePart(b.createdAt) || b.date || "";
}

// "Payments Collected" should follow when the payment was recorded (paidAt).
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

// A booking only becomes a real receivable once it's an accepted booking
// (not a Lead/Quote/Follow Up still being negotiated) and isn't already
// settled. Shared by both Overview and Forecast so "Outstanding
// Receivables" can never disagree between the two views.
function isReceivable(b) {
    return b.paymentStatus !== "paid" && b.paymentStatus !== "redo"
        && !["Lead", "Quote", "Follow Up"].includes(b.status);
}

function receivableBalance(b) {
    return Math.max(0, parseFloat(b.price || 0) - parseFloat(b.amountReceived || 0));
}

// Mirrors the structure of the company's finance workbook (Dashboard sheet):
// Sales & Collections, Cash Position, Expenses, Profit — computed live from
// our own bookings/expenses/cashDeposits, for an arbitrary date range.
export function computeFinanceOverview({ bookings = [], expenses = [], cashDeposits = [], settings = {}, from = "", to = "" }) {
    const cfg = { ...FINANCE_SETTINGS_DEFAULTS, ...settings };
    const todayStr = new Date().toISOString().split("T")[0];
    const yearStart = `${new Date().getFullYear()}-01-01`;

    const activeBookings = bookings.filter(b => b.status !== "Cancelled");
    const approvedExpenses = expenses.filter(e => e.status === "approved");

    // ── Sales & Collections ──
    const periodBookings = activeBookings.filter(b => inRange(invoiceDate(b), from, to));
    const salesInvoicedPeriod = periodBookings.reduce((s, b) => s + parseFloat(b.price || b.totalAmount || 0), 0);
    const salesInvoicedTotal = activeBookings.reduce((s, b) => s + parseFloat(b.price || b.totalAmount || 0), 0);

    const collectedInPeriod = activeBookings.filter(b => inRange(paymentDate(b), from, to));
    const paymentsCollectedPeriod = collectedInPeriod.reduce((s, b) => s + collectedAmount(b), 0);
    const paymentsCollectedTotal = activeBookings.reduce((s, b) => s + collectedAmount(b), 0);

    const receivables = activeBookings.filter(isReceivable);
    const outstandingReceivables = receivables.reduce((s, b) => s + receivableBalance(b), 0);
    const overdueCutoff = new Date(Date.now() - cfg.paymentTermsDays * 86400000).toISOString().split("T")[0];
    const overdueReceivables = receivables.filter(b => b.date && b.date < overdueCutoff)
        .reduce((s, b) => s + receivableBalance(b), 0);

    const paidCount = activeBookings.filter(b => b.paymentStatus === "paid").length;
    const partialCount = activeBookings.filter(b => b.paymentStatus === "partial").length;
    const unpaidCount = activeBookings.filter(b => b.paymentStatus === "unpaid").length;

    // ── Cash Position ──
    const cashBookings = activeBookings.filter(b => (b.paymentMethod || "") === "cash");
    const cashReceivedPeriod = cashBookings.filter(b => inRange(paymentDate(b), from, to)).reduce((s, b) => s + collectedAmount(b), 0);
    const cashReceivedTotal = cashBookings.reduce((s, b) => s + collectedAmount(b), 0);

    const cashExpenses = approvedExpenses.filter(e => e.paymentMethod === "Company Cash");
    const cashUsedForExpensesTotal = cashExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    const cashDepositedTotal = cashDeposits.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    const cashDepositedPeriod = cashDeposits.filter(d => inRange(d.date, from, to)).reduce((s, d) => s + parseFloat(d.amount || 0), 0);

    // Running balance — deliberately not period-filtered, same reasoning as a bank balance.
    const cashRemainingInHand = Math.max(0, cashReceivedTotal - cashUsedForExpensesTotal - cashDepositedTotal);
    const totalExpensesAllTime = approvedExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const availableCompanyFunds = cfg.openingCapital + paymentsCollectedTotal - totalExpensesAllTime;
    const estimatedBankPosition = availableCompanyFunds - cashRemainingInHand;

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

    // ── Profit (accrual: sales invoiced minus expenses, for the period) ──
    const netProfitPeriod = salesInvoicedPeriod - expensesPeriod;
    const salesInvoicedYTD = activeBookings.filter(b => inRange(invoiceDate(b), yearStart, todayStr)).reduce((s, b) => s + parseFloat(b.price || 0), 0);
    const netProfitYTD = salesInvoicedYTD - expensesYTD;
    const profitMarginYTD = salesInvoicedYTD > 0 ? netProfitYTD / salesInvoicedYTD : 0;

    return {
        sales: {
            salesInvoicedPeriod, salesInvoicedTotal,
            paymentsCollectedPeriod, paymentsCollectedTotal,
            outstandingReceivables, overdueReceivables,
            paidCount, partialCount, unpaidCount,
        },
        cash: {
            estimatedBankPosition, cashReceivedPeriod, cashReceivedTotal,
            cashUsedForExpensesTotal, cashDepositedPeriod, cashDepositedTotal,
            cashRemainingInHand, availableCompanyFunds,
        },
        expenses: {
            expensesPeriod, expensesYTD, payrollExpenseTotal,
            operatingExpensesTotal, startupCapitalTotal, reimbursementsPending,
            totalExpensesAllTime,
        },
        profit: {
            netProfitPeriod, netProfitYTD, profitMarginYTD, salesInvoicedYTD,
        },
        settings: cfg,
    };
}

// Mirrors the Forecast & KPI Dashboard sheet — run-rate projections from the
// current month's pace so far. Uses the same invoiceDate/paymentDate/
// isReceivable rules as computeFinanceOverview so figures that appear on
// both views (e.g. Outstanding Receivables) always agree.
export function computeFinanceForecast({ bookings = [], expenses = [] }) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const todayStr = now.toISOString().split("T")[0];

    const activeBookings = bookings.filter(b => b.status !== "Cancelled");
    const approvedExpenses = expenses.filter(e => e.status === "approved");

    const monthBookings = activeBookings.filter(b => inRange(invoiceDate(b), monthStart, todayStr));
    const currentMonthSales = monthBookings.reduce((s, b) => s + parseFloat(b.price || 0), 0);
    const avgDailySales = daysElapsed > 0 ? currentMonthSales / daysElapsed : 0;
    const expectedMonthEndSales = avgDailySales * daysInMonth;

    const monthExpenses = approvedExpenses.filter(e => inRange(e.date, monthStart, todayStr));
    const currentMonthExpenses = monthExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const avgDailyExpenses = daysElapsed > 0 ? currentMonthExpenses / daysElapsed : 0;
    const expectedMonthEndExpenses = avgDailyExpenses * daysInMonth;
    const expectedMonthEndProfit = expectedMonthEndSales - expectedMonthEndExpenses;

    const totalInvoicedAllTime = activeBookings.reduce((s, b) => s + parseFloat(b.price || 0), 0);
    const totalCollectedAllTime = activeBookings.reduce((s, b) => s + collectedAmount(b), 0);
    const collectionRate = totalInvoicedAllTime > 0 ? totalCollectedAllTime / totalInvoicedAllTime : 0;
    const outstandingReceivables = activeBookings.filter(isReceivable).reduce((s, b) => s + receivableBalance(b), 0);
    const expectedCollectionsThisMonth = outstandingReceivables * collectionRate;

    const completedJobsThisMonth = monthBookings.filter(b => b.status === "Completed").length;
    const averageRevenuePerJob = currentMonthSales > 0 && monthBookings.length > 0 ? currentMonthSales / monthBookings.length : 0;

    return {
        daysElapsed, daysInMonth,
        currentMonthSales, avgDailySales, expectedMonthEndSales,
        currentMonthExpenses, avgDailyExpenses, expectedMonthEndExpenses,
        expectedMonthEndProfit,
        collectionRate, outstandingReceivables, expectedCollectionsThisMonth,
        completedJobsThisMonth, averageRevenuePerJob,
    };
}
