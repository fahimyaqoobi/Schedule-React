"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { WORKER_TYPE_OPTIONS } from "@/lib/hiringPipeline";

const EMPTY_FORM = { legalName: "", email: "", phone: "", city: "", province: "ON", workerTypeInterest: "", coverNote: "" };

export default function ApplyForm() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [resumeFile, setResumeFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);

    function update(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        if (!form.legalName.trim() || !form.email.trim() || !form.phone.trim() || !form.workerTypeInterest) {
            setError("Please fill in your name, email, phone, and the role you're applying for.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/careers/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to submit application.");
            }

            if (resumeFile) {
                const uploadData = new FormData();
                uploadData.append("file", resumeFile);
                uploadData.append("applicationToken", data.applicationToken);
                const uploadRes = await fetch("/api/uploads/applicant-document", { method: "POST", body: uploadData });
                if (!uploadRes.ok) {
                    console.error("Resume upload failed, application was still submitted.");
                }
            }

            setSubmitted(true);
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    if (submitted) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                    <h2 className="text-lg font-semibold">Application received!</h2>
                    <p className="text-sm text-muted-foreground">
                        Thanks for applying, {form.legalName.split(" ")[0] || "there"}. Our HR team will review your application and reach out with next steps.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Apply now</CardTitle>
                <CardDescription>Tell us a bit about yourself and we'll be in touch.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="legalName">Full name</Label>
                        <Input id="legalName" value={form.legalName} onChange={e => update("legalName", e.target.value)} placeholder="Jane Doe" required />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="you@example.com" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" type="tel" value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="(416) 555-0123" required />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" value={form.city} onChange={e => update("city", e.target.value)} placeholder="Ottawa" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="workerTypeInterest">Role you're applying for</Label>
                            <Select value={form.workerTypeInterest} onValueChange={v => update("workerTypeInterest", v)}>
                                <SelectTrigger id="workerTypeInterest">
                                    <span data-slot="select-value">
                                        {WORKER_TYPE_OPTIONS.find(o => o.value === form.workerTypeInterest)?.label || "Select a role"}
                                    </span>
                                </SelectTrigger>
                                <SelectContent>
                                    {WORKER_TYPE_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="coverNote">Tell us about yourself (optional)</Label>
                        <Textarea id="coverNote" value={form.coverNote} onChange={e => update("coverNote", e.target.value)} placeholder="Relevant experience, availability, anything you'd like us to know..." rows={4} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="resume">Resume (optional)</Label>
                        <label
                            htmlFor="resume"
                            className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                        >
                            <Upload className="h-4 w-4" />
                            {resumeFile ? resumeFile.name : "Choose a file to upload"}
                        </label>
                        <input
                            id="resume"
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,image/*"
                            onChange={e => setResumeFile(e.target.files?.[0] || null)}
                        />
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <Button type="submit" disabled={submitting} className="w-full">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit application"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
