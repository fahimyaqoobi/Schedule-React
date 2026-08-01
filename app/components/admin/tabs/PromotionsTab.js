"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export default function PromotionsTab({
    promotionRules,
    setPromotionRules,
    documentCopy,
    updateDocumentCopyField,
    handleSavePromotions,
    promotionSaving,
}) {
    return (
        <div className="animate-fade flex flex-col gap-4">
            <Card>
                <CardHeader className="flex-row flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Promotions</p>
                        <CardTitle className="text-xl">Document, Referral and Discount Control</CardTitle>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            Manage the wording shown on estimates, bookings, invoices, receipts, and any public promotions shown to customers.
                        </p>
                    </div>
                    <Button onClick={handleSavePromotions} disabled={promotionSaving}>
                        {promotionSaving ? "Saving…" : "Save Document Settings"}
                    </Button>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Customer Document Copy</p>
                    <CardTitle className="text-lg">Terms, Notes and Service Notes</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Use <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{document}"}</code> inside terms when you want the system to write estimate, booking, invoice, or receipt automatically.
                    </p>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-2">
                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Service Notes Title</Label>
                            <Input value={documentCopy.serviceNotesTitle || ""} onChange={e => updateDocumentCopyField("serviceNotesTitle", e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Default Service Notes Body</Label>
                            <Textarea value={documentCopy.serviceNotesBody || ""} onChange={e => updateDocumentCopyField("serviceNotesBody", e.target.value)} className="min-h-30" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Notes Title</Label>
                            <Input value={documentCopy.notesTitle || ""} onChange={e => updateDocumentCopyField("notesTitle", e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Notes Body</Label>
                            <Textarea value={documentCopy.notesBody || ""} onChange={e => updateDocumentCopyField("notesBody", e.target.value)} className="min-h-30" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 lg:col-span-2">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Terms Title</Label>
                            <Input value={documentCopy.termsTitle || ""} onChange={e => updateDocumentCopyField("termsTitle", e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Terms Body</Label>
                            <Textarea value={documentCopy.termsBody || ""} onChange={e => updateDocumentCopyField("termsBody", e.target.value)} className="min-h-45 font-mono text-sm leading-6" />
                        </div>
                        <p className="text-xs text-muted-foreground">Each line becomes one bullet in the PDF and document preview.</p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
                {promotionRules.map((promo, index) => (
                    <Card key={promo.id}>
                        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.8fr]">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Promo Name</Label>
                                    <Input value={promo.name} onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Promo Code</Label>
                                    <Input value={promo.code} onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, code: e.target.value.toUpperCase().replace(/\s+/g, "") } : item))} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Type</Label>
                                    <Select value={promo.type} onValueChange={v => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, type: v } : item))}>
                                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                                            <SelectItem value="percent">Percent</SelectItem>
                                            <SelectItem value="referral">Referral</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Value</Label>
                                    <Input type="number" value={promo.value} onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, value: Number(e.target.value || 0) } : item))} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Scope</Label>
                                    <Select value={promo.scope || "all"} onValueChange={v => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, scope: v, applicableServices: v === "all" ? [] : (item.applicableServices || []) } : item))}>
                                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Services</SelectItem>
                                            <SelectItem value="service">Specific Services Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {promo.scope === "service" && (
                                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                                        <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Applicable Services (comma-separated)</Label>
                                        <Input
                                            value={(promo.applicableServices || []).join(", ")}
                                            onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, applicableServices: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } : item))}
                                            placeholder="e.g. Window Cleaning, Gutter Cleaning"
                                        />
                                    </div>
                                )}
                                <div className="flex flex-col gap-1.5 sm:col-span-2">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Description</Label>
                                    <Textarea value={promo.description || ""} onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} className="min-h-22" />
                                </div>
                            </div>

                            <div className="rounded-lg border border-border bg-muted/30 p-4">
                                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Rules</p>
                                <div className="flex flex-col gap-1.5">
                                    {[
                                        ["active", "Active"],
                                        ["oneTimeOnly", "One time only"],
                                        ["stackable", "Can be used with others"],
                                        ["soloOnly", "Must be used alone"],
                                        ["repeatable", "Repeat use allowed"],
                                        ["referralRequired", "Needs referred customer purchase"],
                                        ["showOnDocuments", "Show on estimates, invoices, and receipts"],
                                    ].map(([field, label]) => (
                                        <label key={field} className="flex items-center gap-2.5 rounded-md bg-card px-3 py-2 text-sm">
                                            <Checkbox
                                                checked={Boolean(promo[field])}
                                                onCheckedChange={c => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, [field]: Boolean(c) } : item))}
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3.5 w-full text-destructive hover:text-destructive"
                                    onClick={() => setPromotionRules(prev => prev.filter((_, i) => i !== index))}
                                >
                                    <Trash2 className="size-3.5" /> Remove Promotion
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Button
                variant="outline"
                className="w-fit"
                onClick={() => setPromotionRules(prev => ([
                    ...prev,
                    {
                        id: `promo_${Date.now()}`,
                        code: `PROMO${prev.length + 1}`,
                        name: "New Promotion",
                        type: "fixed",
                        value: 0,
                        scope: "all",
                        applicableServices: [],
                        active: true,
                        oneTimeOnly: false,
                        stackable: false,
                        soloOnly: false,
                        repeatable: false,
                        referralRequired: false,
                        showOnDocuments: true,
                        description: "",
                    }
                ]))}
            >
                <Plus className="size-4" /> Add Promotion
            </Button>
        </div>
    );
}
