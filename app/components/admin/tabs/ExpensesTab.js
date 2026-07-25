"use client";
import { useState } from "react";
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS } from "../../../../lib/expenses";

function StatusPill({ status }) {
    const map = {
        pending_approval: { label: "Pending", cls: "status-badge status-pending" },
        approved: { label: "Approved", cls: "status-badge status-completed" },
        rejected: { label: "Rejected", cls: "status-badge status-cancelled" }
    };
    const item = map[status] || { label: status, cls: "status-badge" };
    return <span className={item.cls}>{item.label}</span>;
}

function EditRow({ expense, onSave, onCancel }) {
    const [draft, setDraft] = useState({
        amount: expense.amount, category: expense.category, vendor: expense.vendor || "",
        description: expense.description || "", date: expense.date, paymentMethod: expense.paymentMethod || "",
        isReimbursable: Boolean(expense.isReimbursable),
    });
    return (
        <tr style={{ background: "#fffbeb" }}>
            <td><input type="date" value={draft.date} onChange={e => setDraft(p => ({ ...p, date: e.target.value }))} style={{ width: 130 }} /></td>
            <td colSpan={2}>
                <input type="text" value={draft.vendor} onChange={e => setDraft(p => ({ ...p, vendor: e.target.value }))} placeholder="Vendor" style={{ width: "100%" }} />
                <select value={draft.category} onChange={e => setDraft(p => ({ ...p, category: e.target.value }))} style={{ width: "100%", marginTop: 4 }}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </td>
            <td><input type="number" step="0.01" value={draft.amount} onChange={e => setDraft(p => ({ ...p, amount: e.target.value }))} style={{ width: 90 }} /></td>
            <td colSpan={3}>
                <select value={draft.paymentMethod} onChange={e => setDraft(p => ({ ...p, paymentMethod: e.target.value }))} style={{ width: "100%" }}>
                    {EXPENSE_PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, marginTop: 4 }}>
                    <input type="checkbox" checked={draft.isReimbursable} onChange={e => setDraft(p => ({ ...p, isReimbursable: e.target.checked }))} />
                    Reimbursable
                </label>
            </td>
            <td style={{ whiteSpace: "nowrap" }}>
                <button type="button" className="team-primary-action" onClick={() => onSave(draft)}>Save</button>
                <button type="button" className="team-secondary-action" onClick={onCancel} style={{ marginLeft: 4 }}>Cancel</button>
            </td>
        </tr>
    );
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
    handleEditExpense,
    handleDeleteExpense,
}) {
    const [editingId, setEditingId] = useState(null);
    const [reimbursingId, setReimbursingId] = useState(null);

    const list = canReviewExpenses ? reviewedExpenses : myExpenses;
    const pendingReimbursements = canReviewExpenses
        ? reviewedExpenses.filter(e => e.isReimbursable && e.reimbursementStatus === "pending" && e.status === "approved")
        : [];

    return (
        <div className="animate-fade flex flex-col gap-6">
            <div className="ops-control-header">
                <div>
                    <p className="ops-eyebrow">Expense Management</p>
                    <h3 className="ops-title">Receipts & Reimbursements</h3>
                    <p className="ops-copy">
                        {canReviewExpenses
                            ? "Add expenses directly, or review what staff submit. Approved expenses feed the Finance dashboard."
                            : "Upload a receipt photo to submit an expense for manager approval."}
                    </p>
                </div>
            </div>

            {expenseFeedback && (
                <div className="people-profile-message">{expenseFeedback}</div>
            )}

            {canReviewExpenses && pendingReimbursements.length > 0 && (
                <div className="settings-card" style={{ border: "1.5px solid #fde68a", background: "#fffbeb" }}>
                    <div className="panel-header border-b border-slate-100 pb-3 flex justify-between items-center">
                        <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">⚠ Reimbursements Pending</h4>
                        <span className="badge badge-warning">{pendingReimbursements.length}</span>
                    </div>
                    <div className="flex flex-col gap-3 pt-3">
                        {pendingReimbursements.map(expense => (
                            <div key={expense.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px" }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{expense.vendor || expense.description || expense.category} — ${Number(expense.amount).toFixed(2)}</div>
                                    <div style={{ fontSize: 11, color: "#64748b" }}>Owed to {expense.submittedByName} · {expense.date}</div>
                                </div>
                                {reimbursingId === expense.id ? (
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button type="button" className="team-primary-action" onClick={() => { handleReviewExpense(expense.id, "mark_reimbursed", { reimbursedVia: "bank" }); setReimbursingId(null); }}>From Bank</button>
                                        <button type="button" className="team-primary-action" onClick={() => { handleReviewExpense(expense.id, "mark_reimbursed", { reimbursedVia: "cash" }); setReimbursingId(null); }}>From Cash</button>
                                        <button type="button" className="team-secondary-action" onClick={() => setReimbursingId(null)}>Cancel</button>
                                    </div>
                                ) : (
                                    <button type="button" className="team-primary-action" onClick={() => setReimbursingId(expense.id)}>Mark Reimbursed</button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="settings-card">
                <div className="panel-header border-b border-slate-100 pb-3">
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">
                        {expenseForm.adminDirect ? "Add an Expense" : "Submit a New Expense"}
                    </h4>
                </div>
                <div className="settings-form">
                    {canReviewExpenses && (
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#475569" }}>
                            <input type="checkbox" checked={expenseForm.adminDirect} onChange={e => setExpenseForm(prev => ({ ...prev, adminDirect: e.target.checked }))} />
                            Add directly as admin — auto-approved, no receipt required
                        </label>
                    )}
                    <div className="form-group">
                        <label>Vendor</label>
                        <input type="text" value={expenseForm.vendor || ""} onChange={e => setExpenseForm(prev => ({ ...prev, vendor: e.target.value }))} placeholder="e.g. Home Depot" />
                    </div>
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
                    <div className="form-group">
                        <label>Paid Via</label>
                        <select value={expenseForm.paymentMethod || "Personal (Reimbursable)"} onChange={e => setExpenseForm(prev => ({ ...prev, paymentMethod: e.target.value, isReimbursable: e.target.value === "Personal (Reimbursable)" }))}>
                            {EXPENSE_PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        {expenseForm.paymentMethod === "Personal (Reimbursable)" && (
                            <small className="text-slate-400">Paid personally — flagged for reimbursement once approved.</small>
                        )}
                    </div>
                    <label className="settings-photo-upload">
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={e => handleExpenseReceiptCapture(e.target.files?.[0])}
                            disabled={expenseReceiptUploading}
                        />
                        {expenseReceiptUploading ? "Uploading Receipt..." : (expenseForm.receiptUrl ? `Receipt attached: ${expenseForm.receiptName}` : (expenseForm.adminDirect ? "Attach Receipt Photo (optional)" : "Take Or Upload Receipt Photo"))}
                    </label>
                    <button
                        type="button"
                        onClick={handleSubmitExpense}
                        disabled={expenseSubmitting || expenseReceiptUploading}
                        className="btn btn-primary h-[44px] rounded-lg text-white font-bold transition mt-2"
                    >
                        {expenseSubmitting ? "Saving..." : (expenseForm.adminDirect ? "Add Expense" : "Submit Expense")}
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
                                    <h4>{expense.vendor ? `${expense.vendor} — ` : ""}{expense.submittedByName}</h4>
                                    <p>{expense.date} — {expense.description || "No description provided."}</p>
                                    {expense.receiptUrl && <a href={expense.receiptUrl} target="_blank" rel="noreferrer">View receipt photo</a>}
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
                                <th>Vendor</th>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Reimbursement</th>
                                <th>Receipt</th>
                                {canReviewExpenses && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {list.length === 0 ? (
                                <tr><td colSpan={canReviewExpenses ? 8 : 7} className="text-center p-8 text-slate-400 text-xs">No expenses recorded yet.</td></tr>
                            ) : list.map(expense => (
                                editingId === expense.id ? (
                                    <EditRow
                                        key={expense.id}
                                        expense={expense}
                                        onCancel={() => setEditingId(null)}
                                        onSave={(patch) => { handleEditExpense(expense.id, patch); setEditingId(null); }}
                                    />
                                ) : (
                                    <tr key={expense.id}>
                                        <td>{expense.date}</td>
                                        <td>{expense.vendor || "—"}{expense.autoGenerated && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", borderRadius: 99, padding: "1px 6px" }}>AUTO</span>}</td>
                                        <td>{expense.category}</td>
                                        <td>${Number(expense.amount).toFixed(2)}</td>
                                        <td><StatusPill status={expense.status} /></td>
                                        <td>
                                            {!expense.isReimbursable ? (
                                                <span className="text-slate-300 text-xs">—</span>
                                            ) : expense.reimbursementStatus === "paid" ? (
                                                <span className="status-badge status-completed">Reimbursed ({expense.reimbursedVia})</span>
                                            ) : (
                                                <span className="status-badge status-pending">Pending</span>
                                            )}
                                        </td>
                                        <td>{expense.receiptUrl ? <a href={expense.receiptUrl} target="_blank" rel="noreferrer">View</a> : "—"}</td>
                                        {canReviewExpenses && (
                                            <td style={{ whiteSpace: "nowrap" }}>
                                                <button type="button" className="action-btn btn-edit" onClick={() => setEditingId(expense.id)} title="Edit">{Icons.Edit()}</button>
                                                <button type="button" className="action-btn btn-delete" onClick={() => handleDeleteExpense(expense.id)} title="Delete">{Icons.Trash()}</button>
                                            </td>
                                        )}
                                    </tr>
                                )
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
