"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { getStageMeta, STAGES_REQUIRING_DOCUMENT } from "@/lib/hiringPipeline";

const DECISION_OPTIONS = [
    { value: "pass", label: "Pass" },
    { value: "fail", label: "Needs follow-up" },
];

// One reusable dialog for every stage transition (advance/reject/withdraw) —
// every review-type stage captures the same actor/date/decision/notes shape
// (plus an optional document for compliance-bearing stages), so a single
// form + write path handles all of them instead of one bespoke form per
// stage.
export default function StageTransitionForm({ open, onOpenChange, application, fromStage, mode, onSubmit }) {
    const [decision, setDecision] = useState("pass");
    const [notes, setNotes] = useState("");
    const [file, setFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    if (!application) return null;

    const stageMeta = getStageMeta(fromStage);
    const requiresDocument = STAGES_REQUIRING_DOCUMENT.includes(fromStage);
    const isReject = mode === "reject";

    async function handleSubmit() {
        setError("");
        if (isReject && !notes.trim()) {
            setError("Please provide a reason for rejecting this candidate.");
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit({ mode, decision, notes, file });
            setDecision("pass");
            setNotes("");
            setFile(null);
            onOpenChange(false);
        } catch (err) {
            setError(err.message || "Failed to save. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isReject ? "Reject candidate" : `Advance past ${stageMeta.label}`}
                    </DialogTitle>
                    <DialogDescription>
                        {application.personal?.legalName} — {isReject ? "this will remove them from the active pipeline." : `logging the ${stageMeta.label} stage.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {!isReject && (
                        <div className="space-y-2">
                            <Label>Outcome</Label>
                            <Select value={decision} onValueChange={setDecision}>
                                <SelectTrigger>
                                    <span data-slot="select-value">{DECISION_OPTIONS.find(o => o.value === decision)?.label}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    {DECISION_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="stage-notes">{isReject ? "Reason" : "Notes"}</Label>
                        <Textarea id="stage-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={isReject ? "Why is this candidate being rejected?" : "Any notes from this stage..."} />
                    </div>

                    {!isReject && requiresDocument && (
                        <div className="space-y-2">
                            <Label htmlFor="stage-document">Document</Label>
                            <label htmlFor="stage-document" className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                                <Upload className="h-4 w-4" />
                                {file ? file.name : "Attach signed document"}
                            </label>
                            <input id="stage-document" type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                        </div>
                    )}

                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
                    <Button variant={isReject ? "destructive" : "default"} onClick={handleSubmit} disabled={submitting}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isReject ? "Reject" : "Advance")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
