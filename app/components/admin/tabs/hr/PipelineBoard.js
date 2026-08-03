"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
    DndContext, DragOverlay, useDraggable, useDroppable,
    PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { HIRING_STAGES, getStageMeta, getNextStage } from "@/lib/hiringPipeline";
import ApplicationCard from "./ApplicationCard";
import StageTransitionForm from "./StageTransitionForm";

const REJECTED_COLUMN = { value: "rejected", label: "✕ Rejected" };
const BOARD_STAGES = [...HIRING_STAGES, REJECTED_COLUMN];

function DraggableCard({ application, ...cardProps }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: application.id,
        data: { type: "application-card" },
    });
    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 50 : undefined }
        : undefined;
    return (
        <ApplicationCard
            ref={setNodeRef}
            application={application}
            style={style}
            dragHandleProps={{ ...attributes, ...listeners }}
            isDragging={isDragging}
            {...cardProps}
        />
    );
}

function StageColumn({ stage, applications, cardProps }) {
    const meta = getStageMeta(stage.value);
    const { setNodeRef, isOver } = useDroppable({ id: stage.value });
    return (
        <div className="flex w-[82vw] max-w-96 shrink-0 snap-start flex-col rounded-xl border border-border bg-muted/30 sm:w-72 lg:w-80">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: meta.fill }} />
                    <span className="text-xs font-bold text-foreground">{stage.label}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">{applications.length}</Badge>
            </div>
            <div
                ref={setNodeRef}
                className={cn("flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2.5 transition-colors", isOver && "bg-primary/10")}
                style={{ maxHeight: "min(calc(100vh - 340px), 60vh)" }}
            >
                {applications.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center py-6 text-center text-[11px] text-muted-foreground">No candidates</div>
                ) : applications.map(a => <DraggableCard key={a.id} application={a} {...cardProps} />)}
            </div>
        </div>
    );
}

// Hiring-pipeline Kanban board — directly mirrors the mechanics of
// calendar/BoardView.js (DndContext, useDraggable/useDroppable, per-stage
// column, hidden-by-default terminal column), but every drop opens a
// structured stage-transition form rather than writing immediately: unlike
// a booking status, every hiring stage requires an actor/decision/notes
// capture, so the write only happens on form submit.
export default function PipelineBoard({ getAuthHeaders }) {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [hideRejected, setHideRejected] = useState(true);
    const [activeApplication, setActiveApplication] = useState(null);
    const [pendingTransition, setPendingTransition] = useState(null); // { application, fromStage, mode }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/hr/applications", { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load candidates.");
            setApplications(data.applications || []);
        } catch (err) {
            setError(err.message || "Failed to load candidates.");
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => { load(); }, [load]);

    const activeApplications = useMemo(() => applications.filter(a => a.status !== "hired" && a.status !== "withdrawn"), [applications]);

    const columns = useMemo(
        () => BOARD_STAGES.filter(s => !(hideRejected && s.value === "rejected")),
        [hideRejected]
    );

    const byStage = useMemo(() => {
        const map = Object.fromEntries(BOARD_STAGES.map(s => [s.value, []]));
        activeApplications.forEach(a => { if (map[a.status]) map[a.status].push(a); });
        return map;
    }, [activeApplications]);

    const cardProps = {};

    function handleDragStart(event) {
        setActiveApplication(activeApplications.find(a => a.id === event.active.id) || null);
    }

    function handleDragEnd(event) {
        setActiveApplication(null);
        const { active, over } = event;
        if (!over) return;
        const application = activeApplications.find(a => a.id === active.id);
        if (!application || application.status === over.id) return;

        if (over.id === "rejected") {
            setPendingTransition({ application, fromStage: application.status, mode: "reject" });
            return;
        }
        if (over.id === getNextStage(application.status)) {
            setPendingTransition({ application, fromStage: application.status, mode: "advance" });
        }
        // Any other drop target (skipping stages, dropping backward) is a no-op.
    }

    async function handleTransitionSubmit({ mode, decision, notes, file }) {
        const { application, fromStage } = pendingTransition;
        const headers = await getAuthHeaders();
        let documentUrl = "";
        let documentName = "";

        if (file) {
            const uploadData = new FormData();
            uploadData.append("file", file);
            uploadData.append("applicationId", application.id);
            uploadData.append("stage", fromStage);
            const authHeader = headers.Authorization ? { Authorization: headers.Authorization } : {};
            const uploadRes = await fetch("/api/uploads/hiring-stage-document", { method: "POST", headers: authHeader, body: uploadData });
            const uploadData_ = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadData_.error || "Failed to upload document.");
            documentUrl = uploadData_.url;
            documentName = uploadData_.name;
        }

        const res = await fetch(`/api/hr/applications/${application.id}/transition`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ action: mode, decision, notes, documentUrl, documentName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update candidate.");
        await load();
    }

    if (loading && applications.length === 0) {
        return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <input type="checkbox" checked={!hideRejected} onChange={e => setHideRejected(!e.target.checked)} className="size-3.5" />
                    Show Rejected
                </label>
                <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                    <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                </Button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
                    {columns.map(stage => (
                        <StageColumn key={stage.value} stage={stage} applications={byStage[stage.value] || []} cardProps={cardProps} />
                    ))}
                </div>
                <DragOverlay>
                    {activeApplication ? <ApplicationCard application={activeApplication} /> : null}
                </DragOverlay>
            </DndContext>

            <StageTransitionForm
                open={Boolean(pendingTransition)}
                onOpenChange={(open) => { if (!open) setPendingTransition(null); }}
                application={pendingTransition?.application}
                fromStage={pendingTransition?.fromStage}
                mode={pendingTransition?.mode}
                onSubmit={handleTransitionSubmit}
            />
        </div>
    );
}
