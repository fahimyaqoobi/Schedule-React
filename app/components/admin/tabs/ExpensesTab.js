"use client";
import { useState } from "react";
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS } from "../../../../lib/expenses";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pencil, Trash2, Upload, TriangleAlert, ExternalLink, Receipt } from "lucide-react";

function StatusPill({ status }) {
    const map = {
        pending_approval: { label: "Pending", variant: "secondary" },
        approved: { label: "Approved", variant: "default" },
        rejected: { label: "Rejected", variant: "destructive" },
    };
    const item = map[status] || { label: status, variant: "outline" };
    return <Badge variant={item.variant}>{item.label}</Badge>;
}

function EditRow({ expense, onSave, onCancel }) {
    const [draft, setDraft] = useState({
        amount: expense.amount, category: expense.category, vendor: expense.vendor || "",
        description: expense.description || "", date: expense.date, paymentMethod: expense.paymentMethod || "",
        isReimbursable: Boolean(expense.isReimbursable),
    });
    return (
        <TableRow className="bg-amber-50 dark:bg-amber-950/20">
            <TableCell><Input type="date" value={draft.date} onChange={e => setDraft(p => ({ ...p, date: e.target.value }))} className="w-36" /></TableCell>
            <TableCell colSpan={2}>
                <Input type="text" value={draft.vendor} onChange={e => setDraft(p => ({ ...p, vendor: e.target.value }))} placeholder="Vendor" className="mb-1.5" />
                <Select value={draft.category} onValueChange={v => setDraft(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
            </TableCell>
            <TableCell><Input type="number" step="0.01" value={draft.amount} onChange={e => setDraft(p => ({ ...p, amount: e.target.value }))} className="w-24" /></TableCell>
            <TableCell colSpan={3}>
                <Select value={draft.paymentMethod} onValueChange={v => setDraft(p => ({ ...p, paymentMethod: v }))}>
                    <SelectTrigger className="mb-1.5 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox checked={draft.isReimbursable} onCheckedChange={c => setDraft(p => ({ ...p, isReimbursable: Boolean(c) }))} />
                    Reimbursable
                </label>
            </TableCell>
            <TableCell className="whitespace-nowrap">
                <Button size="sm" onClick={() => onSave(draft)}>Save</Button>
                <Button size="sm" variant="outline" className="ml-1" onClick={onCancel}>Cancel</Button>
            </TableCell>
        </TableRow>
    );
}

export default function ExpensesTab({
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
        <div className="animate-fade flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Expense Management</p>
                    <CardTitle className="text-xl">Receipts &amp; Reimbursements</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {canReviewExpenses
                            ? "Add expenses directly, or review what staff submit. Approved expenses feed the Finance dashboard."
                            : "Upload a receipt photo to submit an expense for manager approval."}
                    </p>
                </CardHeader>
            </Card>

            {expenseFeedback && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">{expenseFeedback}</div>
            )}

            {canReviewExpenses && pendingReimbursements.length > 0 && (
                <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                    <CardHeader className="flex-row items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <TriangleAlert className="size-4 text-amber-600" /> Reimbursements Pending
                        </CardTitle>
                        <Badge variant="outline" className="border-amber-400 text-amber-700">{pendingReimbursements.length}</Badge>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {pendingReimbursements.map(expense => (
                            <div key={expense.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-card px-3.5 py-2.5">
                                <div>
                                    <div className="text-sm font-bold text-foreground">{expense.vendor || expense.description || expense.category} — ${Number(expense.amount).toFixed(2)}</div>
                                    <div className="text-xs text-muted-foreground">Owed to {expense.submittedByName} · {expense.date}</div>
                                </div>
                                {reimbursingId === expense.id ? (
                                    <div className="flex gap-1.5">
                                        <Button size="sm" onClick={() => { handleReviewExpense(expense.id, "mark_reimbursed", { reimbursedVia: "bank" }); setReimbursingId(null); }}>From Bank</Button>
                                        <Button size="sm" onClick={() => { handleReviewExpense(expense.id, "mark_reimbursed", { reimbursedVia: "cash" }); setReimbursingId(null); }}>From Cash</Button>
                                        <Button size="sm" variant="outline" onClick={() => setReimbursingId(null)}>Cancel</Button>
                                    </div>
                                ) : (
                                    <Button size="sm" onClick={() => setReimbursingId(expense.id)}>Mark Reimbursed</Button>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{expenseForm.adminDirect ? "Add an Expense" : "Submit a New Expense"}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {canReviewExpenses && (
                        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <Checkbox checked={expenseForm.adminDirect} onCheckedChange={c => setExpenseForm(prev => ({ ...prev, adminDirect: Boolean(c) }))} />
                            Add directly as admin — auto-approved, no receipt required
                        </label>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label>Vendor</Label>
                            <Input type="text" value={expenseForm.vendor || ""} onChange={e => setExpenseForm(prev => ({ ...prev, vendor: e.target.value }))} placeholder="e.g. Home Depot" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Amount ($)</Label>
                            <Input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="0.00" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Category</Label>
                            <Select value={expenseForm.category} onValueChange={v => setExpenseForm(prev => ({ ...prev, category: v }))}>
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>{EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Date</Label>
                            <Input type="date" value={expenseForm.date} onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Description (optional)</Label>
                        <Textarea value={expenseForm.description} onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))} placeholder="What was this for?" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Paid Via</Label>
                        <Select
                            value={expenseForm.paymentMethod || "Personal (Reimbursable)"}
                            onValueChange={v => setExpenseForm(prev => ({ ...prev, paymentMethod: v, isReimbursable: v === "Personal (Reimbursable)" }))}
                        >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>{EXPENSE_PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                        {expenseForm.paymentMethod === "Personal (Reimbursable)" && (
                            <small className="text-muted-foreground">Paid personally — flagged for reimbursement once approved.</small>
                        )}
                    </div>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 py-6 text-center text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted">
                        <Upload className="size-4" />
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={e => handleExpenseReceiptCapture(e.target.files?.[0])}
                            disabled={expenseReceiptUploading}
                        />
                        {expenseReceiptUploading ? "Uploading Receipt…" : (expenseForm.receiptUrl ? `Receipt attached: ${expenseForm.receiptName}` : (expenseForm.adminDirect ? "Attach Receipt Photo (optional)" : "Take Or Upload Receipt Photo"))}
                    </label>
                    <Button onClick={handleSubmitExpense} disabled={expenseSubmitting || expenseReceiptUploading}>
                        {expenseSubmitting ? "Saving…" : (expenseForm.adminDirect ? "Add Expense" : "Submit Expense")}
                    </Button>
                </CardContent>
            </Card>

            {canReviewExpenses && pendingExpenseApprovals.length > 0 && (
                <Card>
                    <CardHeader className="flex-row items-center justify-between gap-2">
                        <CardTitle className="text-sm">Pending Approvals</CardTitle>
                        <Badge variant="outline">{pendingExpenseApprovals.length} Pending</Badge>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {pendingExpenseApprovals.map(expense => (
                            <div key={expense.id} className="rounded-lg border border-border p-3.5">
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{expense.category} • ${Number(expense.amount).toFixed(2)}</p>
                                <h4 className="mt-0.5 text-sm font-bold text-foreground">{expense.vendor ? `${expense.vendor} — ` : ""}{expense.submittedByName}</h4>
                                <p className="mt-0.5 text-xs text-muted-foreground">{expense.date} — {expense.description || "No description provided."}</p>
                                {expense.receiptUrl && (
                                    <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                                        View receipt photo <ExternalLink className="size-3" />
                                    </a>
                                )}
                                <Textarea
                                    placeholder="Optional rejection reason"
                                    value={expenseRejectReason[expense.id] || ""}
                                    onChange={e => setExpenseRejectReason(prev => ({ ...prev, [expense.id]: e.target.value }))}
                                    className="mt-2"
                                />
                                <div className="mt-2 flex gap-2">
                                    <Button size="sm" onClick={() => handleReviewExpense(expense.id, "approve")}>Approve</Button>
                                    <Button size="sm" variant="outline" onClick={() => handleReviewExpense(expense.id, "reject")}>Reject</Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card className="p-0">
                <CardHeader className="p-4 pb-0">
                    <CardTitle className="text-sm">{canReviewExpenses ? "All Expense History" : "My Expense History"}</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {list.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                            <Receipt className="size-6 opacity-50" />
                            No expenses recorded yet.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reimbursement</TableHead>
                                    <TableHead>Receipt</TableHead>
                                    {canReviewExpenses && <TableHead>Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {list.map(expense => (
                                    editingId === expense.id ? (
                                        <EditRow
                                            key={expense.id}
                                            expense={expense}
                                            onCancel={() => setEditingId(null)}
                                            onSave={(patch) => { handleEditExpense(expense.id, patch); setEditingId(null); }}
                                        />
                                    ) : (
                                        <TableRow key={expense.id}>
                                            <TableCell>{expense.date}</TableCell>
                                            <TableCell>
                                                {expense.vendor || "—"}
                                                {expense.autoGenerated && <Badge variant="outline" className="ml-1.5 text-[9px]">AUTO</Badge>}
                                            </TableCell>
                                            <TableCell>{expense.category}</TableCell>
                                            <TableCell>${Number(expense.amount).toFixed(2)}</TableCell>
                                            <TableCell><StatusPill status={expense.status} /></TableCell>
                                            <TableCell>
                                                {!expense.isReimbursable ? (
                                                    <span className="text-xs text-muted-foreground/50">—</span>
                                                ) : expense.reimbursementStatus === "paid" ? (
                                                    <Badge>Reimbursed ({expense.reimbursedVia})</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Pending</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {expense.receiptUrl ? (
                                                    <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">View</a>
                                                ) : "—"}
                                            </TableCell>
                                            {canReviewExpenses && (
                                                <TableCell className="whitespace-nowrap">
                                                    <Button variant="ghost" size="icon-xs" onClick={() => setEditingId(expense.id)} title="Edit"><Pencil className="size-3.5" /></Button>
                                                    <Button variant="ghost" size="icon-xs" onClick={() => handleDeleteExpense(expense.id)} title="Delete"><Trash2 className="size-3.5" /></Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    )
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
