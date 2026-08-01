"use client";
import { Check, MapPin, ChevronRight, KeyRound, Camera, Plus, X, Play, Square, CircleCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import JobChatCard from "../shared/JobChatCard";
import { cn } from "@/lib/utils";

const STEPS = [["Check In", 0], ["Working", 1], ["Submit", 2]];
const STEP_PHASES = ["before_start", "in_progress", "after_photos"];

function Stepper({ phase }) {
    const cur = STEP_PHASES.indexOf(phase);
    return (
        <div className="flex items-center">
            {STEPS.map(([label, i]) => {
                const active = cur >= i;
                const done = cur > i;
                return (
                    <div key={label} className="flex flex-1 items-center last:flex-none">
                        <div className="flex flex-col items-center gap-1">
                            <div className={cn(
                                "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                                done ? "bg-primary text-primary-foreground" : active ? "border-2 border-primary text-primary" : "border border-border text-muted-foreground"
                            )}>
                                {done ? <Check className="size-3.5" /> : i + 1}
                            </div>
                            <span className={cn("text-[10px] font-semibold", active ? "text-primary" : "text-muted-foreground")}>{label}</span>
                        </div>
                        {i < 2 && <div className={cn("mx-1 h-0.5 flex-1", done ? "bg-primary" : "bg-border")} />}
                    </div>
                );
            })}
        </div>
    );
}

function HeroCard({ booking, metaItems }) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="text-base font-extrabold text-foreground">🧹 {booking.service}</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    {metaItems.map(([label, value]) => (
                        <div key={label}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                            <p className="text-sm font-semibold text-foreground">{value}</p>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function AddressCard({ booking, getGoogleMapsDirectionsUrl, formatAddress }) {
    return (
        <a href={getGoogleMapsDirectionsUrl(booking)} target="_blank" rel="noreferrer">
            <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 p-3.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><MapPin className="size-4" /></div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-muted-foreground">Tap for Directions</p>
                        <p className="truncate text-sm font-semibold text-foreground">{formatAddress(booking)}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
            </Card>
        </a>
    );
}

function PhotoGrid({ photos, onAdd, onRemove }) {
    return (
        <div className="mt-2 flex flex-wrap gap-2">
            {photos.map(photo => (
                <div key={photo.id} className="relative size-16 overflow-hidden rounded-lg border border-border bg-muted">
                    {photo.url ? (
                        <img src={photo.url} alt="" className="size-full object-cover" />
                    ) : (
                        <div className="flex size-full items-center justify-center text-xs text-muted-foreground">{photo.uploading ? "…" : "?"}</div>
                    )}
                    {!photo.uploading && (
                        <button type="button" onClick={onRemove(photo.id)} className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-foreground/70 text-background">
                            <X className="size-2.5" />
                        </button>
                    )}
                </div>
            ))}
            <label className="flex size-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-input text-muted-foreground hover:bg-muted">
                <Plus className="size-5" />
                <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onAdd} />
            </label>
        </div>
    );
}

// Restyled + extracted from the "DISPATCH EDIT MODAL" in app/page.js — the
// cleaner's job workspace (before_start/in_progress/after_photos/submitted/
// read_only phases). Behavior is unchanged; every handler/state value the
// original inline JSX used is passed through as a prop, same as the rest of
// this codebase's tab components.
export default function JobWizard({
    phase,
    bookingForm,
    activeCleanerJobDraft,
    activeTimeEntry,
    jobsNow,
    jobsFeedback,
    timeEntrySaving,
    cleanerExtraTaskOpen,
    setCleanerExtraTaskOpen,
    cleanerExtraTaskInput,
    setCleanerExtraTaskInput,
    getAuthHeaders,
    currentUser,
    getGoogleMapsDirectionsUrl,
    formatAddress,
    formatRuntime,
    removeCleanerJobPhoto,
    updateCleanerJobPhotos,
    handleStartCleanerJob,
    toggleCleanerTaskComplete,
    addCleanerExtraTask,
    handleEndCleanerJob,
    handleSubmitJobForReview,
}) {
    const tasks = activeCleanerJobDraft?.tasks || [];

    return (
        <div className="flex flex-col gap-4">
            {phase !== "submitted" && phase !== "read_only" && <Stepper phase={phase} />}

            {phase === "submitted" && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <CircleCheck className="size-7" />
                        </div>
                        <div className="text-lg font-extrabold text-foreground">Job Submitted!</div>
                        <p className="text-sm text-muted-foreground">Your work has been submitted for admin review. You will be notified once it is approved.</p>
                    </CardContent>
                </Card>
            )}

            {phase === "read_only" && (
                <>
                    <HeroCard booking={bookingForm} metaItems={[
                        ["Date", bookingForm.date], ["Time", bookingForm.time], ["Duration", `${bookingForm.duration} hrs`],
                    ]} />
                    <AddressCard booking={bookingForm} getGoogleMapsDirectionsUrl={getGoogleMapsDirectionsUrl} formatAddress={formatAddress} />
                </>
            )}

            {phase === "before_start" && (() => {
                const reqTasks = tasks.filter(t => t.requiresPhoto);
                const beforeDone = reqTasks.every(t => (t.beforePhotos || []).some(p => p.url));
                return (
                    <>
                        <HeroCard booking={bookingForm} metaItems={[
                            ["Client", bookingForm.firstName || "Client"],
                            ["Date & Time", `${bookingForm.date} · ${bookingForm.time}`],
                            ["Duration", `${bookingForm.duration} hrs`],
                            ["Frequency", bookingForm.frequency || "One-Time"],
                        ]} />
                        <AddressCard booking={bookingForm} getGoogleMapsDirectionsUrl={getGoogleMapsDirectionsUrl} formatAddress={formatAddress} />

                        {(bookingForm.accessMode || bookingForm.accessDetails || bookingForm.specialNotes) && (
                            <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                                <CardContent className="flex flex-col gap-1 p-3.5 text-sm">
                                    <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                                        <KeyRound className="size-4" /> Access &amp; Instructions
                                    </div>
                                    {bookingForm.accessMode && <div className="text-amber-900 dark:text-amber-200"><b>Access:</b> {bookingForm.accessMode}</div>}
                                    {bookingForm.accessDetails && <div className="text-amber-900 dark:text-amber-200">{bookingForm.accessDetails}</div>}
                                    {bookingForm.specialNotes && <div className="text-amber-900 dark:text-amber-200">{bookingForm.specialNotes}</div>}
                                </CardContent>
                            </Card>
                        )}

                        <JobChatCard bookingId={bookingForm.id} getAuthHeaders={getAuthHeaders} currentActorId={currentUser?.uid} title="💬 Chat with Customer" />

                        <div>
                            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground"><Camera className="size-4" /> Before Photos</div>
                            {tasks.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No tasks defined for this service.</div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {tasks.map(task => (
                                        <Card key={task.id}>
                                            <CardContent className="p-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-semibold text-foreground">{task.label}</span>
                                                    {task.requiresPhoto && <Badge variant="outline" className="text-[10px]">Required</Badge>}
                                                </div>
                                                <PhotoGrid
                                                    photos={task.beforePhotos || []}
                                                    onAdd={e => updateCleanerJobPhotos(bookingForm.id, task.id, "beforePhotos", e.target.files)}
                                                    onRemove={photoId => () => removeCleanerJobPhoto(bookingForm.id, task.id, "beforePhotos", photoId)}
                                                />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                        {reqTasks.length > 0 && !beforeDone && (
                            <p className="text-center text-xs text-muted-foreground">Upload required before photos to unlock Start Job</p>
                        )}
                        <Button size="lg" disabled={!beforeDone || timeEntrySaving} onClick={() => handleStartCleanerJob(bookingForm)}>
                            <Play className="size-4" /> {timeEntrySaving ? "Starting…" : "Start Job"}
                        </Button>
                        {jobsFeedback && <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">{jobsFeedback}</div>}
                    </>
                );
            })()}

            {phase === "in_progress" && (() => {
                const completedCount = tasks.filter(t => t.completed).length;
                return (
                    <>
                        <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20">
                            <CardContent className="flex items-center justify-between gap-2 p-3.5">
                                <div>
                                    <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                        <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> Job in Progress
                                    </div>
                                    <div className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">{activeTimeEntry?.startedAt ? formatRuntime(activeTimeEntry.startedAt, jobsNow) : "—"}</div>
                                </div>
                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{completedCount}/{tasks.length}</Badge>
                            </CardContent>
                        </Card>

                        <JobChatCard bookingId={bookingForm.id} getAuthHeaders={getAuthHeaders} currentActorId={currentUser?.uid} title="💬 Chat with Customer" />

                        <div className="flex flex-col gap-2">
                            <div className="text-sm font-bold text-foreground">Your Tasks</div>
                            {tasks.map(task => (
                                <Card key={task.id} className={task.completed ? "opacity-60" : ""}>
                                    <CardContent className="flex items-start gap-3 p-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleCleanerTaskComplete(bookingForm.id, task.id)}
                                            className={cn(
                                                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                                                task.completed ? "border-primary bg-primary text-primary-foreground" : "border-input"
                                            )}
                                        >
                                            {task.completed && <Check className="size-3" />}
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <div className={cn("text-sm font-semibold text-foreground", task.completed && "line-through")}>{task.label}</div>
                                            {task.requiresPhoto && <Badge variant="outline" className="mt-1 gap-1 text-[10px]"><Camera className="size-2.5" /> Photo needed</Badge>}
                                            {((task.beforePhotos || []).length > 0 || (task.afterPhotos || []).length > 0) && (
                                                <div className="mt-1.5 flex gap-1">
                                                    {[...(task.beforePhotos || []), ...(task.afterPhotos || [])].map(photo => (
                                                        <div key={photo.id} className="size-9 overflow-hidden rounded border border-border bg-muted">
                                                            {photo.url ? <img src={photo.url} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">{photo.uploading ? "…" : "?"}</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {cleanerExtraTaskOpen ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        autoFocus
                                        placeholder="Describe the extra task…"
                                        value={cleanerExtraTaskInput}
                                        onChange={e => setCleanerExtraTaskInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") {
                                                addCleanerExtraTask(bookingForm.id, cleanerExtraTaskInput);
                                                setCleanerExtraTaskInput("");
                                                setCleanerExtraTaskOpen(false);
                                            }
                                        }}
                                    />
                                    <Button size="sm" onClick={() => { addCleanerExtraTask(bookingForm.id, cleanerExtraTaskInput); setCleanerExtraTaskInput(""); setCleanerExtraTaskOpen(false); }}>Add</Button>
                                    <Button size="sm" variant="outline" onClick={() => { setCleanerExtraTaskInput(""); setCleanerExtraTaskOpen(false); }}>Cancel</Button>
                                </div>
                            ) : (
                                <Button variant="outline" onClick={() => setCleanerExtraTaskOpen(true)}><Plus className="size-4" /> Add extra task</Button>
                            )}
                        </div>

                        <Button size="lg" variant="destructive" disabled={timeEntrySaving} onClick={() => handleEndCleanerJob(bookingForm)}>
                            <Square className="size-4" /> {timeEntrySaving ? "Saving…" : "End Job & Add After Photos"}
                        </Button>
                        {jobsFeedback && <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">{jobsFeedback}</div>}
                    </>
                );
            })()}

            {phase === "after_photos" && (() => {
                const reqTasks = tasks.filter(t => t.requiresPhoto);
                const afterDone = reqTasks.every(t => (t.afterPhotos || []).some(p => p.url));
                return (
                    <>
                        <Card className="border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
                            <CardContent className="p-3.5">
                                <div className="text-sm font-bold text-orange-800 dark:text-orange-300">Almost done!</div>
                                <div className="mt-0.5 text-xs text-orange-700 dark:text-orange-400">
                                    Tasks: {tasks.filter(t => t.completed).length}/{tasks.length} completed · Upload after photos then submit for review.
                                </div>
                            </CardContent>
                        </Card>

                        <JobChatCard bookingId={bookingForm.id} getAuthHeaders={getAuthHeaders} currentActorId={currentUser?.uid} title="💬 Chat with Customer" />

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Camera className="size-4" /> After Photos &amp; Task Review</div>
                            {tasks.map(task => (
                                <Card key={task.id}>
                                    <CardContent className="p-3">
                                        <div className="flex items-start gap-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleCleanerTaskComplete(bookingForm.id, task.id)}
                                                className={cn(
                                                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                                                    task.completed ? "border-primary bg-primary text-primary-foreground" : "border-input"
                                                )}
                                            >
                                                {task.completed && <Check className="size-3" />}
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className={cn("text-sm font-semibold text-foreground", task.completed && "line-through")}>{task.label}</span>
                                                    {task.requiresPhoto && <Badge variant="outline" className="text-[10px]">Required</Badge>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="pl-8">
                                            <p className="mb-1 text-xs font-semibold text-muted-foreground">After Photos</p>
                                            <PhotoGrid
                                                photos={task.afterPhotos || []}
                                                onAdd={e => updateCleanerJobPhotos(bookingForm.id, task.id, "afterPhotos", e.target.files)}
                                                onRemove={photoId => () => removeCleanerJobPhoto(bookingForm.id, task.id, "afterPhotos", photoId)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {reqTasks.length > 0 && !afterDone && (
                            <p className="text-center text-xs text-muted-foreground">Upload required after photos to submit for review</p>
                        )}
                        <Button size="lg" disabled={!afterDone || timeEntrySaving} onClick={() => handleSubmitJobForReview(bookingForm)}>
                            <CircleCheck className="size-4" /> {timeEntrySaving ? "Submitting…" : "Submit Job for Review"}
                        </Button>
                        {jobsFeedback && <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">{jobsFeedback}</div>}
                    </>
                );
            })()}
        </div>
    );
}
