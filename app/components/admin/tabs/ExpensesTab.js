"use client";

const EXPENSE_CATEGORIES = ["Supplies", "Fuel & Mileage", "Equipment", "Uniforms", "Parking & Tolls", "Other"];

function StatusPill({ status }) {
    const map = {
        pending_approval: { label: "Pending", cls: "status-badge status-pending" },
        approved: { label: "Approved", cls: "status-badge status-completed" },
        rejected: { label: "Rejected", cls: "status-badge status-cancelled" }
    };
    const item = map[status] || { label: status, cls: "status-badge" };
    return <span className={item.cls}>{item.label}</span>;
}

export default function ExpensesTab({
    Icons,
    canReviewExpenses,
    myExpenses,
    pendingExpenseApprovals,
    reviewedExpenses,
    expenseForm,
    setExpenseForm,
    expenseReceiptUploading,
    expenseSubmitting,
    expenseFeedback,
    expenseRejectReason,
    setExpenseRejectReason,
    handleExpenseReceiptCapture,
    handleSubmitExpense,
    handleReviewExpense,
}) {
    return (
        <div className="animate-fade flex flex-col gap-6">
            <div className="ops-control-header">
                <div>
                    <p className="ops-eyebrow">Expense Management</p>
                    <h3 className="ops-title">Receipts & Reimbursements</h3>
                    <p className="ops-copy">
                        Upload a receipt photo to submit an expense for manager approval. Approved expenses feed the business-health dashboard and will sync to your accounting system once connected.
                    </p>
                </div>
            </div>

            {expenseFeedback && (
                <div className="people-profile-message">{expenseFeedback}</div>
            )}

            <div className="settings-card">
                <div className="panel-header border-b border-slate-100 pb-3">
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Submit a New Expense</h4>
                </div>
                <div className="settings-form">
                    <div className="form-group">
                        <label>Amount ($)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={expenseForm.amount}
                            onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="form-group">
                        <label>Category</label>
                        <select value={expenseForm.category} onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}>
                            {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Date</label>
                        <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>Description (optional)</label>
                        <textarea value={expenseForm.description} onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))} placeholder="What was this for?" />
                    </div>
                    <label className="settings-photo-upload">
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={e => handleExpenseReceiptCapture(e.target.files?.[0])}
                            disabled={expenseReceiptUploading}
                        />
                        {expenseReceiptUploading ? "Uploading Receipt..." : (expenseForm.receiptUrl ? `Receipt attached: ${expenseForm.receiptName}` : "Take Or Upload Receipt Photo")}
                    </label>
                    <button
                        type="button"
                        onClick={handleSubmitExpense}
                        disabled={expenseSubmitting || expenseReceiptUploading}
                        className="btn btn-primary h-[44px] rounded-lg text-white font-bold transition mt-2"
                    >
                        {expenseSubmitting ? "Submitting..." : "Submit Expense"}
                    </button>
                </div>
            </div>

            {canReviewExpenses && pendingExpenseApprovals.length > 0 && (
                <div className="settings-card">
                    <div className="panel-header border-b border-slate-100 pb-3 flex justify-between items-center">
                        <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Pending Approvals</h4>
                        <span className="badge badge-warning">{pendingExpenseApprovals.length} Pending</span>
                    </div>
                    <div className="flex flex-col gap-3 pt-3">
                        {pendingExpenseApprovals.map(expense => (
                            <div key={expense.id} className="people-review-panel">
                                <div>
                                    <p className="ops-eyebrow">{expense.category} • ${Number(expense.amount).toFixed(2)}</p>
                                    <h4>{expense.submittedByName}</h4>
                                    <p>{expense.date} — {expense.description || "No description provided."}</p>
                                    <a href={expense.receiptUrl} target="_blank" rel="noreferrer">View receipt photo</a>
                                </div>
                                <textarea
                                    placeholder="Optional rejection reason"
                                    value={expenseRejectReason[expense.id] || ""}
                                    onChange={e => setExpenseRejectReason(prev => ({ ...prev, [expense.id]: e.target.value }))}
                                />
                                <div className="people-review-actions">
                                    <button type="button" className="team-primary-action" onClick={() => handleReviewExpense(expense.id, "approve")}>
                                        Approve
                                    </button>
                                    <button type="button" className="team-secondary-action" onClick={() => handleReviewExpense(expense.id, "reject")}>
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="settings-card">
                <div className="panel-header border-b border-slate-100 pb-3">
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">
                        {canReviewExpenses ? "All Expense History" : "My Expense History"}
                    </h4>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                {canReviewExpenses && <th>Staff</th>}
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Receipt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(canReviewExpenses ? reviewedExpenses : myExpenses).length === 0 ? (
                                <tr><td colSpan={canReviewExpenses ? 6 : 5} className="text-center p-8 text-slate-400 text-xs">No expenses recorded yet.</td></tr>
                            ) : (canReviewExpenses ? reviewedExpenses : myExpenses).map(expense => (
                                <tr key={expense.id}>
                                    <td>{expense.date}</td>
                                    {canReviewExpenses && <td>{expense.submittedByName}</td>}
                                    <td>{expense.category}</td>
                                    <td>${Number(expense.amount).toFixed(2)}</td>
                                    <td><StatusPill status={expense.status} /></td>
                                    <td><a href={expense.receiptUrl} target="_blank" rel="noreferrer">View</a></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
