"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2, Save, ChevronUp, ChevronDown, Camera, X, Settings, ClipboardList, Ruler, Home as HomeIcon, BedDouble, ShowerHead } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── small helpers ────────────────────────────────────────────────────────────
function createLocalId(prefix) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function SectionCard({ children, className }) {
    return <Card className={cn("overflow-hidden p-0", className)}>{children}</Card>;
}

function SectionHeader({ icon, title, subtitle, action }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-2.5">
                <span className="text-lg">{icon}</span>
                <div>
                    <p className="text-sm font-extrabold text-foreground">{title}</p>
                    {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

function Btn({ children, onClick, variant = "secondary", disabled, className }) {
    const map = { primary: "default", secondary: "secondary", danger: "outline", ghost: "ghost" };
    return (
        <Button
            type="button"
            variant={map[variant]}
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={cn(variant === "danger" && "border-destructive/30 text-destructive hover:text-destructive", variant === "ghost" && "text-primary", className)}
        >
            {children}
        </Button>
    );
}

function Field({ label, hint, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</Label>
            {children}
            {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
        </div>
    );
}

function TextInput({ value, onChange, placeholder, className }) {
    return <Input type="text" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={className} />;
}

function NumberInput({ value, onChange, step = 1, min, placeholder, prefix, suffix }) {
    return (
        <div className="relative flex items-center">
            {prefix && <span className="pointer-events-none absolute left-2.5 text-xs font-extrabold text-muted-foreground">{prefix}</span>}
            <Input
                type="number"
                value={value ?? ""}
                onChange={e => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                step={step}
                min={min}
                placeholder={placeholder}
                className={cn(prefix && "pl-6", suffix && "pr-9")}
            />
            {suffix && <span className="pointer-events-none absolute right-2.5 text-[11px] font-extrabold text-muted-foreground">{suffix}</span>}
        </div>
    );
}

// ─── Task row list ─────────────────────────────────────────────────────────────
function TaskEditor({ tasks = [], onAdd, onUpdate, onDelete, accent }) {
    return (
        <div className="flex flex-col gap-1.5">
            {tasks.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-border py-5 text-center text-xs font-semibold text-muted-foreground">
                    No tasks yet — add steps cleaners must complete.
                </div>
            ) : (
                tasks.map((task, idx) => (
                    <div key={task.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                        <span className="min-w-5 text-center text-[11px] font-extrabold text-muted-foreground/50">{idx + 1}</span>
                        <Input
                            type="text"
                            value={task.label}
                            onChange={e => onUpdate(task.id, "label", e.target.value)}
                            placeholder="Describe this step…"
                            className="h-8 flex-1 text-xs"
                        />
                        <label className="flex shrink-0 cursor-pointer items-center gap-1" title="Require a photo for this step">
                            <Checkbox checked={task.requiresPhoto} onCheckedChange={c => onUpdate(task.id, "requiresPhoto", Boolean(c))} />
                            <Camera className={cn("size-3.5", task.requiresPhoto ? "text-primary" : "text-muted-foreground")} />
                        </label>
                        <Button type="button" variant="ghost" size="icon-xs" className="shrink-0 text-destructive hover:text-destructive" onClick={() => onDelete(task.id)} title="Remove task">
                            <X className="size-3.5" />
                        </Button>
                    </div>
                ))
            )}
            <Btn variant="ghost" onClick={onAdd} className="w-fit"><Plus className="size-3.5" /> Add step</Btn>
        </div>
    );
}

// Compact editable table row shared by the Bathrooms / Frequencies / Global Fees tables.
function TableRow({ columns, children, zebra }) {
    return (
        <div className={cn("grid items-center gap-2.5 border-b border-border px-5 py-2.5 last:border-0", zebra && "bg-muted/20")} style={{ gridTemplateColumns: columns }}>
            {children}
        </div>
    );
}
function TableHeadRow({ columns, headers }) {
    return (
        <div className="grid gap-2.5 border-b border-border bg-muted/40 px-5 py-2" style={{ gridTemplateColumns: columns }}>
            {headers.map(h => <span key={h} className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{h}</span>)}
        </div>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function V2SettingsManager({ catalog, setCatalog, onSave }) {
    const [activeServiceId, setActiveServiceId] = useState(catalog.categories[0]?.id || "");
    const [editorTab, setEditorTab] = useState("types"); // "basics" | "types" | "sizes" | "addons" | "settings"
    const [isSaving, setIsSaving] = useState(false);
    const [expandedTypeId, setExpandedTypeId] = useState(null);
    const [expandedAddonId, setExpandedAddonId] = useState(null);

    const cat = catalog.categories.find(c => c.id === activeServiceId);

    const stats = React.useMemo(() => ({
        services: catalog.categories.length,
        tiers: catalog.categories.reduce((s, c) => s + (c.sizes?.length || 0), 0),
        addons: catalog.categories.reduce((s, c) => s + (c.addons?.length || 0), 0),
        tasks: catalog.categories.reduce((s, c) => s + (c.serviceTypes || []).reduce((ss, st) => ss + (st.tasks?.length || 0), 0), 0),
    }), [catalog.categories]);

    const handleSave = async () => {
        setIsSaving(true);
        try { await onSave(catalog); } finally { setIsSaving(false); }
    };

    // ── generic updater ───────────────────────────────────────────────────────
    const updateField = (field, value) =>
        setCatalog(prev => ({ ...prev, categories: prev.categories.map(c => c.id === activeServiceId ? { ...c, [field]: value } : c) }));

    // ── service CRUD ──────────────────────────────────────────────────────────
    const addService = () => {
        const newCat = { id: createLocalId("service"), name: "New Service", pricingModel: "size_based", baseRate: 0, durationHrs: 1, sizeLabel: "", serviceTypes: [], sizes: [], addons: [], tasks: [], hasPropertyType: false, propertyTypes: [], hasBedrooms: false, hasBathrooms: false };
        setCatalog(prev => ({ ...prev, categories: [...prev.categories, newCat] }));
        setActiveServiceId(newCat.id);
        setEditorTab("basics");
    };
    const deleteService = () => {
        setCatalog(prev => {
            const remaining = prev.categories.filter(c => c.id !== activeServiceId);
            setActiveServiceId(remaining[0]?.id || "");
            return { ...prev, categories: remaining };
        });
    };

    // ── service types ─────────────────────────────────────────────────────────
    const addServiceType = () => {
        const t = { id: createLocalId("stype"), name: "New Type", multiplier: 1.0, tasks: [] };
        updateField("serviceTypes", [...(cat.serviceTypes || []), t]);
        setExpandedTypeId(t.id);
    };
    const updateServiceType = (typeId, field, value) =>
        updateField("serviceTypes", (cat.serviceTypes || []).map(st => st.id === typeId ? { ...st, [field]: value } : st));
    const deleteServiceType = (typeId) =>
        updateField("serviceTypes", (cat.serviceTypes || []).filter(st => st.id !== typeId));
    const addServiceTypeTask = (typeId) => {
        const task = { id: createLocalId("sttask"), label: "", requiresPhoto: false };
        updateField("serviceTypes", (cat.serviceTypes || []).map(st => st.id === typeId ? { ...st, tasks: [...(st.tasks || []), task] } : st));
    };
    const updateServiceTypeTask = (typeId, taskId, field, value) =>
        updateField("serviceTypes", (cat.serviceTypes || []).map(st =>
            st.id === typeId ? { ...st, tasks: (st.tasks || []).map(t => t.id === taskId ? { ...t, [field]: value } : t) } : st
        ));
    const deleteServiceTypeTask = (typeId, taskId) =>
        updateField("serviceTypes", (cat.serviceTypes || []).map(st =>
            st.id === typeId ? { ...st, tasks: (st.tasks || []).filter(t => t.id !== taskId) } : st
        ));

    // ── sizes ─────────────────────────────────────────────────────────────────
    const addSize = () => {
        const s = { id: createLocalId("tier"), name: "New Tier", price: 0, durationHrs: 1, propertyTypeId: cat.propertyTypes?.[0]?.id || "" };
        const newSizes = [...(cat.sizes || []), s];
        const updatedPropertyTypes = (cat.propertyTypes || []).map(pt =>
            pt.id === s.propertyTypeId ? { ...pt, sizeIds: [...(pt.sizeIds || []), s.id] } : pt
        );
        setCatalog(prev => ({ ...prev, categories: prev.categories.map(c => c.id === activeServiceId ? { ...c, sizes: newSizes, propertyTypes: updatedPropertyTypes } : c) }));
    };
    const updateSize = (sizeId, field, value) =>
        updateField("sizes", (cat.sizes || []).map(s => s.id === sizeId ? { ...s, [field]: value } : s));
    const deleteSize = (sizeId) => {
        const newSizes = (cat.sizes || []).filter(s => s.id !== sizeId);
        const updatedPropertyTypes = (cat.propertyTypes || []).map(pt => ({ ...pt, sizeIds: (pt.sizeIds || []).filter(id => id !== sizeId) }));
        setCatalog(prev => ({ ...prev, categories: prev.categories.map(c => c.id === activeServiceId ? { ...c, sizes: newSizes, propertyTypes: updatedPropertyTypes } : c) }));
    };
    const assignSizeToPropertyType = (sizeId, ptId) => {
        const newSizes = (cat.sizes || []).map(s => s.id === sizeId ? { ...s, propertyTypeId: ptId || null } : s);
        const newPts = (cat.propertyTypes || []).map(pt => {
            if (pt.id === ptId) return pt.sizeIds.includes(sizeId) ? pt : { ...pt, sizeIds: [...pt.sizeIds, sizeId] };
            return { ...pt, sizeIds: (pt.sizeIds || []).filter(id => id !== sizeId) };
        });
        setCatalog(prev => ({ ...prev, categories: prev.categories.map(c => c.id === activeServiceId ? { ...c, sizes: newSizes, propertyTypes: newPts } : c) }));
    };

    // ── addons ────────────────────────────────────────────────────────────────
    const addAddon = () => {
        const a = { id: createLocalId("addon"), name: "New Add-on", price: 0, qtySelector: false, tasks: [] };
        updateField("addons", [...(cat.addons || []), a]);
        setExpandedAddonId(a.id);
    };
    const updateAddon = (addonId, field, value) =>
        updateField("addons", (cat.addons || []).map(a => a.id === addonId ? { ...a, [field]: value } : a));
    const deleteAddon = (addonId) =>
        updateField("addons", (cat.addons || []).filter(a => a.id !== addonId));
    const addAddonTask = (addonId) => {
        const task = { id: createLocalId("atask"), label: "", requiresPhoto: false };
        updateField("addons", (cat.addons || []).map(a => a.id === addonId ? { ...a, tasks: [...(a.tasks || []), task] } : a));
    };
    const updateAddonTask = (addonId, taskId, field, value) =>
        updateField("addons", (cat.addons || []).map(a =>
            a.id === addonId ? { ...a, tasks: (a.tasks || []).map(t => t.id === taskId ? { ...t, [field]: value } : t) } : a
        ));
    const deleteAddonTask = (addonId, taskId) =>
        updateField("addons", (cat.addons || []).map(a =>
            a.id === addonId ? { ...a, tasks: (a.tasks || []).filter(t => t.id !== taskId) } : a
        ));

    // ── property types ────────────────────────────────────────────────────────
    const addPropertyType = () => {
        const pt = { id: createLocalId("pt"), name: "New Group", sizeIds: [] };
        updateField("propertyTypes", [...(cat.propertyTypes || []), pt]);
    };
    const updatePropertyType = (ptId, field, value) =>
        updateField("propertyTypes", (cat.propertyTypes || []).map(pt => pt.id === ptId ? { ...pt, [field]: value } : pt));
    const deletePropertyType = (ptId) =>
        updateField("propertyTypes", (cat.propertyTypes || []).filter(pt => pt.id !== ptId));

    // ── fallback task list ────────────────────────────────────────────────────
    const addTask = () => updateField("tasks", [...(cat.tasks || []), { id: createLocalId("task"), label: "", requiresPhoto: false }]);
    const updateTask = (taskId, field, value) =>
        updateField("tasks", (cat.tasks || []).map(t => t.id === taskId ? { ...t, [field]: value } : t));
    const deleteTask = (taskId) =>
        updateField("tasks", (cat.tasks || []).filter(t => t.id !== taskId));

    // ── Global Settings: bathrooms ────────────────────────────────────────────
    const bathroomsArr = Object.entries(catalog.bathrooms || {}).map(([label, price]) => ({ label, price }));

    const updateBathroom = (oldLabel, field, rawValue) => {
        setCatalog(prev => {
            const updated = { ...prev.bathrooms };
            if (field === "label") {
                const price = updated[oldLabel];
                delete updated[oldLabel];
                updated[rawValue] = price;
            } else {
                updated[oldLabel] = parseFloat(rawValue) || 0;
            }
            return { ...prev, bathrooms: updated };
        });
    };
    const addBathroom = () => {
        const prices = Object.values(catalog.bathrooms || {});
        const nextPrice = prices.length > 0 ? (prices[prices.length - 1] + 14) : 14;
        const label = `${Object.keys(catalog.bathrooms || {}).length + 1} Bathrooms`;
        setCatalog(prev => ({ ...prev, bathrooms: { ...prev.bathrooms, [label]: nextPrice } }));
    };
    const deleteBathroom = (label) => {
        setCatalog(prev => {
            const updated = { ...prev.bathrooms };
            delete updated[label];
            return { ...prev, bathrooms: updated };
        });
    };

    // ── Global Settings: frequencies ──────────────────────────────────────────
    const freqArr = Object.entries(catalog.frequencies || {}).map(([key, val]) => ({ key, ...val }));

    const updateFrequency = (key, field, rawValue) => {
        setCatalog(prev => ({
            ...prev,
            frequencies: {
                ...prev.frequencies,
                [key]: { ...prev.frequencies[key], [field]: field === "discount" ? (parseFloat(rawValue) || 0) / 100 : rawValue }
            }
        }));
    };
    const renameFreqKey = (oldKey, newKey) => {
        if (!newKey || newKey === oldKey) return;
        setCatalog(prev => {
            const entries = Object.entries(prev.frequencies || {});
            const updated = {};
            entries.forEach(([k, v]) => { updated[k === oldKey ? newKey : k] = v; });
            return { ...prev, frequencies: updated };
        });
    };
    const addFrequency = () => {
        const key = `New Frequency ${Date.now()}`;
        setCatalog(prev => ({ ...prev, frequencies: { ...prev.frequencies, [key]: { name: "New Frequency", discount: 0 } } }));
    };
    const deleteFrequency = (key) => {
        setCatalog(prev => {
            const updated = { ...prev.frequencies };
            delete updated[key];
            return { ...prev, frequencies: updated };
        });
    };

    // ── Global Settings: global add-ons ──────────────────────────────────────
    const updateGlobalAddon = (id, field, value) =>
        setCatalog(prev => ({ ...prev, globalAddons: (prev.globalAddons || []).map(a => a.id === id ? { ...a, [field]: value } : a) }));
    const addGlobalAddon = () => {
        const a = { id: createLocalId("gaddon"), name: "New Global Fee", price: 0, qtySelector: false };
        setCatalog(prev => ({ ...prev, globalAddons: [...(prev.globalAddons || []), a] }));
    };
    const deleteGlobalAddon = (id) =>
        setCatalog(prev => ({ ...prev, globalAddons: (prev.globalAddons || []).filter(a => a.id !== id) }));

    const TopBar = ({ showStats }) => (
        <div className="flex flex-wrap items-center justify-between gap-5 border-b border-border bg-card px-7 py-4.5">
            <div>
                <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Catalog Studio · Desktop Only</p>
                <p className="text-xl font-black text-foreground">V2 Service Manager</p>
            </div>
            {showStats && (
                <div className="flex items-center gap-4">
                    {[
                        ["Services", stats.services, "text-primary"],
                        ["Tiers", stats.tiers, "text-cyan-600"],
                        ["Add-ons", stats.addons, "text-teal-600"],
                        ["Tasks", stats.tasks, "text-violet-600"],
                    ].map(([label, val, color]) => (
                        <div key={label} className="text-center">
                            <p className={cn("text-xl leading-none font-black", color)}>{val}</p>
                            <p className="mt-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">{label}</p>
                        </div>
                    ))}
                </div>
            )}
            <Button onClick={handleSave} disabled={isSaving} className="shadow-sm">
                {isSaving ? "Saving…" : <><Save className="size-4" /> Save Catalog</>}
            </Button>
        </div>
    );

    if (activeServiceId === "__global__") {
        return (
            <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-muted/20 shadow-md">
                <TopBar showStats={false} />

                <div className="grid min-h-150 grid-cols-[260px_1fr]">
                    <div className="border-r border-border bg-card p-3">
                        <Btn variant="secondary" onClick={() => setActiveServiceId(catalog.categories[0]?.id || "")} className="mb-3 w-full">← Back to Services</Btn>
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 dark:bg-amber-950/20">
                            <p className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-amber-800 dark:text-amber-300"><Settings className="size-3.5" /> Global Settings</p>
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">These values apply across ALL services. Changes take effect after you Save Catalog.</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6 overflow-y-auto p-6">
                        <SectionCard>
                            <SectionHeader icon="🚿" title="Bathroom Surcharges" subtitle="Extra charge added per bathroom count — applies to services with 'Has Bathrooms?' enabled"
                                action={<Btn variant="ghost" onClick={addBathroom}><Plus className="size-3.5" /> Add Row</Btn>} />
                            <TableHeadRow columns="1fr 140px 40px" headers={["Label (shown to customer)", "Extra Charge", ""]} />
                            {bathroomsArr.length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">No bathroom tiers yet.</div>}
                            {bathroomsArr.map(({ label, price }, idx) => (
                                <TableRow key={label} columns="1fr 140px 40px" zebra={idx % 2 === 1}>
                                    <Input value={label} onChange={e => updateBathroom(label, "label", e.target.value)} className="h-8 w-[90%] text-xs" />
                                    <NumberInput value={price} onChange={v => updateBathroom(label, "price", v)} prefix="+$" />
                                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => deleteBathroom(label)}><X className="size-4" /></Button>
                                </TableRow>
                            ))}
                        </SectionCard>

                        <SectionCard>
                            <SectionHeader icon="📅" title="Frequency Discounts" subtitle="Recurring booking discounts — applied before tax at checkout"
                                action={<Btn variant="ghost" onClick={addFrequency}><Plus className="size-3.5" /> Add</Btn>} />
                            <TableHeadRow columns="140px 1fr 120px 40px" headers={["Frequency Key", "Display Name", "Discount %", ""]} />
                            {freqArr.length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">No frequency options yet.</div>}
                            {freqArr.map(({ key, name, discount }, idx) => (
                                <TableRow key={key} columns="140px 1fr 120px 40px" zebra={idx % 2 === 1}>
                                    <Input defaultValue={key} onBlur={e => renameFreqKey(key, e.target.value)} className="h-8 w-[90%] bg-muted text-xs font-bold" />
                                    <Input value={name} onChange={e => updateFrequency(key, "name", e.target.value)} className="h-8 w-[90%] text-xs" />
                                    <NumberInput value={Math.round((discount || 0) * 100)} min={0} onChange={v => updateFrequency(key, "discount", v)} suffix="%" />
                                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => deleteFrequency(key)}><X className="size-4" /></Button>
                                </TableRow>
                            ))}
                            <div className="border-t border-emerald-200 bg-emerald-50 px-5 py-2.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                                💡 A 0% discount = no change (e.g. "One-Time"). Discounts are applied to the subtotal before tax.
                            </div>
                        </SectionCard>

                        <SectionCard>
                            <SectionHeader icon="🌐" title="Global Fees & Add-ons" subtitle="Fees that can be added to any booking regardless of service type"
                                action={<Btn variant="ghost" onClick={addGlobalAddon}><Plus className="size-3.5" /> Add Fee</Btn>} />
                            <TableHeadRow columns="1fr 130px 160px 40px" headers={["Fee Name", "Amount", "Qty Setting", ""]} />
                            {(catalog.globalAddons || []).length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">No global fees configured.</div>}
                            {(catalog.globalAddons || []).map((addon, idx) => (
                                <TableRow key={addon.id} columns="1fr 130px 160px 40px" zebra={idx % 2 === 1}>
                                    <Input value={addon.name} onChange={e => updateGlobalAddon(addon.id, "name", e.target.value)} className="h-8 w-[90%] text-xs" />
                                    <NumberInput value={addon.price} onChange={v => updateGlobalAddon(addon.id, "price", parseFloat(v) || 0)} prefix="$" />
                                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-muted/30 px-2.5 py-1.5">
                                        <Checkbox checked={!!addon.qtySelector} onCheckedChange={c => updateGlobalAddon(addon.id, "qtySelector", Boolean(c))} />
                                        <span className="text-[11px] font-semibold text-muted-foreground">Qty selector</span>
                                    </label>
                                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => deleteGlobalAddon(addon.id)}><X className="size-4" /></Button>
                                </TableRow>
                            ))}
                            <div className="border-t border-blue-200 bg-blue-50 px-5 py-2.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
                                💡 Global fees appear as optional add-ons in every booking regardless of which service is booked. Set price to $0 to make a fee free (e.g. seasonal promotion).
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        );
    }

    if (!cat) return null;

    const TABS = [
        { id: "types", label: "Service Types", count: (cat.serviceTypes || []).length, accent: "text-violet-600 border-violet-600", chip: "bg-violet-600" },
        { id: "sizes", label: cat.sizeLabel || "Size Tiers", count: (cat.sizes || []).length, accent: "text-cyan-600 border-cyan-600", chip: "bg-cyan-600" },
        { id: "addons", label: "Add-ons", count: (cat.addons || []).length, accent: "text-teal-600 border-teal-600", chip: "bg-teal-600" },
        { id: "basics", label: "Basics", accent: "text-muted-foreground border-muted-foreground" },
        { id: "settings", label: "Dimensions", accent: "text-amber-600 border-amber-600" },
    ];

    return (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-muted/20 shadow-md">
            <TopBar showStats />

            <div className="grid min-h-150 grid-cols-[260px_1fr]">
                <div className="flex flex-col border-r border-border bg-card">
                    <div className="flex items-center justify-between px-4 pt-4 pb-2.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Services</span>
                        <Btn variant="ghost" onClick={addService}><Plus className="size-3.5" /> New</Btn>
                    </div>
                    <div className="flex-1 overflow-y-auto px-3 pb-2">
                        {catalog.categories.map(c => {
                            const isActive = c.id === activeServiceId;
                            const typeCount = (c.serviceTypes || []).length;
                            const sizeCount = (c.sizes || []).length;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setActiveServiceId(c.id)}
                                    className={cn(
                                        "mb-1 block w-full rounded-xl border-2 px-3.5 py-3 text-left",
                                        isActive ? "border-primary bg-primary/10" : "border-transparent"
                                    )}
                                >
                                    <p className={cn("text-sm font-extrabold leading-tight", isActive ? "text-primary" : "text-foreground")}>{c.name}</p>
                                    <div className={cn("mt-1 flex gap-2 text-[10px]", isActive ? "text-primary/80" : "text-muted-foreground")}>
                                        <span>{typeCount} type{typeCount !== 1 ? "s" : ""}</span>
                                        <span>·</span>
                                        <span>{sizeCount} tier{sizeCount !== 1 ? "s" : ""}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="border-t border-border p-3">
                        <button
                            type="button"
                            onClick={() => setActiveServiceId("__global__")}
                            className="block w-full rounded-xl border-2 border-amber-300 bg-amber-50 px-3.5 py-2.5 text-left dark:bg-amber-950/20"
                        >
                            <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-800 dark:text-amber-300"><Settings className="size-3.5" /> Global Settings</p>
                            <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-400">Bathrooms · Frequencies · Global Fees</p>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col">
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-6 py-3.5">
                        <div>
                            <p className="text-base font-black text-foreground">{cat.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{cat.pricingModel?.replaceAll("_", " ")} · {(cat.serviceTypes || []).length} types · {(cat.sizes || []).length} tiers · {(cat.addons || []).length} add-ons</p>
                        </div>
                        <Btn variant="danger" onClick={deleteService} disabled={catalog.categories.length <= 1}><Trash2 className="size-3.5" /> Delete Service</Btn>
                    </div>

                    <div className="flex gap-0 overflow-x-auto border-b border-border bg-muted/30">
                        {TABS.map(tab => {
                            const isActive = editorTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setEditorTab(tab.id)}
                                    className={cn(
                                        "flex shrink-0 items-center gap-1.5 border-b-[3px] px-5 py-3",
                                        isActive ? cn("bg-card", tab.accent) : "border-transparent"
                                    )}
                                >
                                    <span className={cn("text-xs font-extrabold", isActive ? "" : "text-muted-foreground")}>{tab.label}</span>
                                    {tab.count !== undefined && (
                                        <Badge className={cn("h-4.5 px-1.5 text-[10px]", isActive ? tab.chip : "bg-muted text-muted-foreground")}>{tab.count}</Badge>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">

                        {editorTab === "types" && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-extrabold text-foreground">Service Types</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">Each type has its own price multiplier and task checklist for cleaners.</p>
                                    </div>
                                    <Btn onClick={addServiceType} className="border border-violet-200 bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/30"><Plus className="size-3.5" /> Add Type</Btn>
                                </div>

                                {(cat.serviceTypes || []).length === 0 && (
                                    <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center text-sm font-semibold text-muted-foreground">
                                        No service types yet. Add variants like &quot;Standard&quot;, &quot;Deep Clean&quot;, &quot;Move In/Out&quot;…
                                    </div>
                                )}

                                {(cat.serviceTypes || []).map((st, idx) => {
                                    const isOpen = expandedTypeId === st.id;
                                    const multiplierLabel = st.multiplier === 1 ? "Base price" : `×${parseFloat(st.multiplier).toFixed(2)} — ${Math.round((st.multiplier - 1) * 100)}% more`;
                                    return (
                                        <SectionCard key={st.id}>
                                            <div
                                                className={cn("flex cursor-pointer items-center gap-3 px-4.5 py-3.5", isOpen ? "border-b border-violet-200 bg-violet-50 dark:bg-violet-950/20" : "bg-card")}
                                                onClick={() => setExpandedTypeId(isOpen ? null : st.id)}
                                            >
                                                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-[11px] font-extrabold text-white">{idx + 1}</div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-extrabold text-foreground">{st.name || "Untitled Type"}</p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">{multiplierLabel} · {(st.tasks || []).length} task{(st.tasks || []).length !== 1 ? "s" : ""}</p>
                                                </div>
                                                {st.multiplier > 1 && <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/30">×{parseFloat(st.multiplier).toFixed(2)}</Badge>}
                                                {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                                            </div>

                                            {isOpen && (
                                                <div className="p-4.5">
                                                    <div className="mb-5 grid grid-cols-[1fr_180px] gap-3.5">
                                                        <Field label="Type Name" hint="e.g. Standard Clean, Deep Clean, Move In/Out">
                                                            <TextInput value={st.name} onChange={v => updateServiceType(st.id, "name", v)} placeholder="e.g. Deep Clean" />
                                                        </Field>
                                                        <Field label="Price Multiplier" hint="1.0 = no change · 1.35 = 35% higher">
                                                            <NumberInput value={st.multiplier} onChange={v => updateServiceType(st.id, "multiplier", parseFloat(v) || 1)} step={0.05} min={0.5} />
                                                        </Field>
                                                    </div>

                                                    {(cat.sizes || []).length > 0 && (
                                                        <div className="mb-4 flex gap-5 overflow-x-auto rounded-lg bg-violet-50 p-3.5 dark:bg-violet-950/20">
                                                            {(cat.sizes || []).slice(0, 4).map(s => (
                                                                <div key={s.id} className="shrink-0 text-center">
                                                                    <p className="text-xs font-extrabold text-violet-700 dark:text-violet-400">${(parseFloat(s.price || 0) * parseFloat(st.multiplier || 1)).toFixed(2)}</p>
                                                                    <p className="text-[9px] text-violet-500">{s.name}</p>
                                                                </div>
                                                            ))}
                                                            {(cat.sizes || []).length > 4 && <div className="shrink-0 self-center text-[10px] text-violet-500">+{(cat.sizes || []).length - 4} more</div>}
                                                        </div>
                                                    )}

                                                    <div className="mb-3.5">
                                                        <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                                                            Cleaner Task Checklist
                                                            <span className="ml-2 text-[10px] font-semibold normal-case tracking-normal text-muted-foreground/70">— steps cleaners must tick off during this job type (📷 = photo required)</span>
                                                        </p>
                                                        <TaskEditor
                                                            tasks={st.tasks || []}
                                                            onAdd={() => addServiceTypeTask(st.id)}
                                                            onUpdate={(taskId, field, value) => updateServiceTypeTask(st.id, taskId, field, value)}
                                                            onDelete={(taskId) => deleteServiceTypeTask(st.id, taskId)}
                                                        />
                                                    </div>

                                                    <div className="border-t border-border pt-3">
                                                        <Btn variant="danger" onClick={() => deleteServiceType(st.id)}><Trash2 className="size-3.5" /> Delete &quot;{st.name || "this type"}&quot;</Btn>
                                                    </div>
                                                </div>
                                            )}
                                        </SectionCard>
                                    );
                                })}
                            </div>
                        )}

                        {editorTab === "sizes" && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="flex items-center gap-1.5 text-sm font-extrabold text-foreground"><Ruler className="size-4" /> {cat.sizeLabel || "Size Tiers"}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">Set the base price and duration for each tier. Service type multipliers are applied on top.</p>
                                    </div>
                                    <Btn onClick={addSize} className="border border-cyan-200 bg-cyan-100 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-950/30"><Plus className="size-3.5" /> Add Tier</Btn>
                                </div>

                                {(cat.sizes || []).length === 0 ? (
                                    <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center text-sm font-semibold text-muted-foreground">No size tiers yet.</div>
                                ) : (
                                    <SectionCard>
                                        <TableHeadRow
                                            columns={cat.hasPropertyType ? "1fr 110px 90px 140px 40px" : "1fr 110px 90px 40px"}
                                            headers={cat.hasPropertyType ? ["Name", "Base Price", "Hours", "Property Group", ""] : ["Name", "Base Price", "Hours", ""]}
                                        />
                                        <div className="max-h-120 overflow-y-auto">
                                            {(cat.sizes || []).map((size, idx) => (
                                                <TableRow key={size.id} columns={cat.hasPropertyType ? "1fr 110px 90px 140px 40px" : "1fr 110px 90px 40px"} zebra={idx % 2 === 1}>
                                                    <Input value={size.name} onChange={e => updateSize(size.id, "name", e.target.value)} className="h-8 text-xs" />
                                                    <NumberInput value={size.price} onChange={v => updateSize(size.id, "price", parseFloat(v) || 0)} prefix="$" />
                                                    <NumberInput value={size.durationHrs} step={0.5} onChange={v => updateSize(size.id, "durationHrs", parseFloat(v) || 0)} suffix="hrs" />
                                                    {cat.hasPropertyType && (
                                                        <Select value={size.propertyTypeId || "none"} onValueChange={v => assignSizeToPropertyType(size.id, v === "none" ? null : v)}>
                                                            <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">— None —</SelectItem>
                                                                {(cat.propertyTypes || []).map(pt => <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => deleteSize(size.id)} title="Remove this tier"><X className="size-4" /></Button>
                                                </TableRow>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}
                            </div>
                        )}

                        {editorTab === "addons" && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-extrabold text-foreground">Add-ons</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">Extras customers can add to this service. Each add-on can have its own cleaner tasks.</p>
                                    </div>
                                    <Btn onClick={addAddon} className="border border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30"><Plus className="size-3.5" /> Add Add-on</Btn>
                                </div>

                                {(cat.addons || []).length === 0 && (
                                    <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center text-sm font-semibold text-muted-foreground">No add-ons configured for this service.</div>
                                )}

                                {(cat.addons || []).map(addon => {
                                    const isOpen = expandedAddonId === addon.id;
                                    return (
                                        <SectionCard key={addon.id}>
                                            <div
                                                className={cn("flex cursor-pointer items-center gap-3 px-4 py-3", isOpen ? "border-b border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" : "bg-card")}
                                                onClick={() => setExpandedAddonId(isOpen ? null : addon.id)}
                                            >
                                                <div className="flex-1">
                                                    <p className="text-sm font-extrabold text-foreground">{addon.name || "Untitled Add-on"}</p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        ${parseFloat(addon.price || 0).toFixed(2)} {addon.qtySelector ? "· qty selector" : "· on/off"} {(addon.tasks || []).length > 0 ? `· ${(addon.tasks || []).length} task${(addon.tasks || []).length !== 1 ? "s" : ""}` : ""}
                                                    </p>
                                                </div>
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30">${parseFloat(addon.price || 0).toFixed(2)}</Badge>
                                                {(addon.tasks || []).length > 0 && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30">{(addon.tasks || []).length} tasks</Badge>}
                                                {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                                            </div>

                                            {isOpen && (
                                                <div className="p-4">
                                                    <div className="mb-4 grid grid-cols-[1fr_130px_160px] gap-3.5">
                                                        <Field label="Add-on Name">
                                                            <TextInput value={addon.name} onChange={v => updateAddon(addon.id, "name", v)} placeholder="e.g. Inside the Oven" />
                                                        </Field>
                                                        <Field label="Price ($)">
                                                            <NumberInput value={addon.price} onChange={v => updateAddon(addon.id, "price", parseFloat(v) || 0)} prefix="$" />
                                                        </Field>
                                                        <Field label="Qty Mode" hint="On/off = single toggle · Qty = number input">
                                                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-muted/30 px-3 py-2">
                                                                <Checkbox checked={!!addon.qtySelector} onCheckedChange={c => updateAddon(addon.id, "qtySelector", Boolean(c))} />
                                                                <span className="text-xs font-semibold text-foreground">Qty selector on</span>
                                                            </label>
                                                        </Field>
                                                    </div>

                                                    <div className="mb-3.5 border-t border-border pt-3.5">
                                                        <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                                                            Extra Steps for Cleaners
                                                            <span className="ml-2 text-[10px] font-semibold normal-case tracking-normal text-muted-foreground/70">— added to the job checklist when this add-on is selected</span>
                                                        </p>
                                                        <TaskEditor
                                                            tasks={addon.tasks || []}
                                                            onAdd={() => addAddonTask(addon.id)}
                                                            onUpdate={(taskId, field, value) => updateAddonTask(addon.id, taskId, field, value)}
                                                            onDelete={(taskId) => deleteAddonTask(addon.id, taskId)}
                                                        />
                                                    </div>

                                                    <div className="border-t border-border pt-3">
                                                        <Btn variant="danger" onClick={() => deleteAddon(addon.id)}><Trash2 className="size-3.5" /> Delete &quot;{addon.name || "this add-on"}&quot;</Btn>
                                                    </div>
                                                </div>
                                            )}
                                        </SectionCard>
                                    );
                                })}
                            </div>
                        )}

                        {editorTab === "basics" && (
                            <div className="flex flex-col gap-5">
                                <SectionCard>
                                    <SectionHeader icon="⚙️" title="Service Basics" subtitle="Core configuration for this service" />
                                    <CardContent className="flex flex-col gap-4 p-5">
                                        <Field label="Service Name">
                                            <TextInput value={cat.name} onChange={v => updateField("name", v)} placeholder="e.g. House Cleaning (Interior)" />
                                        </Field>
                                        <div className="grid grid-cols-2 gap-3.5">
                                            <Field label="Pricing Model">
                                                <Select value={cat.pricingModel} onValueChange={v => updateField("pricingModel", v)}>
                                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="flat_rate">Flat Rate</SelectItem>
                                                        <SelectItem value="size_based">Size-Based Tiers</SelectItem>
                                                        <SelectItem value="flat_plus_unit">Base Rate + Per Unit</SelectItem>
                                                        <SelectItem value="flat_plus_sqft">Base Rate + Per SqFt</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </Field>
                                            <Field label="Size / Scope Label" hint="Replaces 'Size Tiers' as the heading shown to customers">
                                                <TextInput value={cat.sizeLabel} onChange={v => updateField("sizeLabel", v)} placeholder="e.g. Number of Panels, Yard Size" />
                                            </Field>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3.5">
                                            <Field label="Base Rate ($)" hint="Used when no size tier is selected">
                                                <NumberInput value={cat.baseRate} onChange={v => updateField("baseRate", parseFloat(v) || 0)} prefix="$" />
                                            </Field>
                                            <Field label="Duration (hrs)" hint="Default duration for this service">
                                                <NumberInput value={cat.durationHrs} onChange={v => updateField("durationHrs", parseFloat(v) || 0)} step={0.5} suffix="hrs" />
                                            </Field>
                                        </div>
                                        {(cat.pricingModel === "flat_plus_unit" || cat.pricingModel === "flat_plus_sqft") && (
                                            <div className="grid grid-cols-2 gap-3.5">
                                                <Field label="Unit Label">
                                                    <TextInput value={cat.unitName} onChange={v => updateField("unitName", v)} placeholder="e.g. Additional Pane" />
                                                </Field>
                                                <Field label="Unit Price ($)">
                                                    <NumberInput value={cat.unitPrice} onChange={v => updateField("unitPrice", parseFloat(v) || 0)} prefix="$" />
                                                </Field>
                                            </div>
                                        )}
                                    </CardContent>
                                </SectionCard>

                                <SectionCard>
                                    <SectionHeader
                                        icon={<ClipboardList className="size-4.5" />}
                                        title="Fallback Task Checklist"
                                        subtitle="Used for old bookings without a service type"
                                        action={<Btn variant="ghost" onClick={addTask}><Plus className="size-3.5" /> Add Step</Btn>}
                                    />
                                    <CardContent className="p-5">
                                        <div className="mb-3.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                                            💡 These steps are only used when a booking has no &quot;service type&quot; selected (older bookings). New bookings use the tasks from each Service Type above.
                                        </div>
                                        <TaskEditor tasks={cat.tasks || []} onAdd={addTask} onUpdate={updateTask} onDelete={deleteTask} />
                                    </CardContent>
                                </SectionCard>
                            </div>
                        )}

                        {editorTab === "settings" && (
                            <div className="flex flex-col gap-5">
                                <SectionCard>
                                    <SectionHeader icon="📐" title="Optional Dimensions" subtitle="Enable extra booking fields for this service" />
                                    <CardContent className="flex flex-col gap-3.5 p-5">
                                        {[
                                            { field: "hasPropertyType", label: "Property Types", desc: "Groups sizes into Apartment / Townhouse / House etc.", Icon: HomeIcon },
                                            { field: "hasBedrooms", label: "Bedrooms", desc: "Shows bedroom count as part of size selection.", Icon: BedDouble },
                                            { field: "hasBathrooms", label: "Bathrooms", desc: "Adds a bathroom surcharge picker to the booking.", Icon: ShowerHead },
                                        ].map(dim => (
                                            <label key={dim.field} className={cn(
                                                "flex cursor-pointer items-start gap-3.5 rounded-xl border-2 px-4 py-3.5",
                                                cat[dim.field] ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20" : "border-border bg-muted/20"
                                            )}>
                                                <Checkbox checked={!!cat[dim.field]} onCheckedChange={c => updateField(dim.field, Boolean(c))} className="mt-0.5" />
                                                <div>
                                                    <p className="flex items-center gap-1.5 text-sm font-extrabold text-foreground"><dim.Icon className="size-4" /> {dim.label}</p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">{dim.desc}</p>
                                                </div>
                                                {cat[dim.field] && <Badge className="ml-auto shrink-0 bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30">ON</Badge>}
                                            </label>
                                        ))}
                                    </CardContent>
                                </SectionCard>

                                {cat.hasPropertyType && (
                                    <SectionCard>
                                        <SectionHeader
                                            icon="🏘️"
                                            title="Property Type Groups"
                                            subtitle="Name each group — then assign sizes to them in the Sizes tab"
                                            action={<Btn variant="ghost" onClick={addPropertyType}><Plus className="size-3.5" /> Add Group</Btn>}
                                        />
                                        <CardContent className="flex flex-col gap-2 p-4.5">
                                            {(cat.propertyTypes || []).length === 0 && (
                                                <div className="rounded-lg border-2 border-dashed border-border py-5 text-center text-xs font-semibold text-muted-foreground">No property types yet.</div>
                                            )}
                                            {(cat.propertyTypes || []).map(pt => (
                                                <div key={pt.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5">
                                                    <Input value={pt.name} onChange={e => updatePropertyType(pt.id, "name", e.target.value)} placeholder="e.g. Apartment" className="h-8 flex-1 text-xs" />
                                                    <span className="text-[11px] whitespace-nowrap text-muted-foreground">{(pt.sizeIds || []).length} size{(pt.sizeIds || []).length !== 1 ? "s" : ""} assigned</span>
                                                    <Btn variant="danger" onClick={() => deletePropertyType(pt.id)}>Remove</Btn>
                                                </div>
                                            ))}
                                            <p className="mt-1 text-[11px] text-muted-foreground">
                                                To assign sizes to these groups, go to the <strong>Sizes</strong> tab — each row has a &quot;Property Group&quot; dropdown.
                                            </p>
                                        </CardContent>
                                    </SectionCard>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
