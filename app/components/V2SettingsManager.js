"use client";

import React, { useState } from "react";

// ─── small helpers ────────────────────────────────────────────────────────────
function createLocalId(prefix) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function Badge({ children, color = "#3b82f6", bg = "#dbeafe" }) {
    return (
        <span style={{ background: bg, color, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
            {children}
        </span>
    );
}

function SectionCard({ children, style }) {
    return (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", ...style }}>
            {children}
        </div>
    );
}

function SectionHeader({ icon, title, subtitle, action }) {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f1f5f9", background: "#fafafa" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b" }}>{title}</div>
                    {subtitle && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{subtitle}</div>}
                </div>
            </div>
            {action}
        </div>
    );
}

function Btn({ children, onClick, variant = "secondary", disabled, style }) {
    const styles = {
        primary:   { background: "#2563eb", color: "#fff", border: "none" },
        secondary: { background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0" },
        danger:    { background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" },
        ghost:     { background: "none",    color: "#2563eb", border: "1px dashed #bfdbfe" },
    };
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{ padding: "6px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 5, ...styles[variant], ...style }}
        >
            {children}
        </button>
    );
}

function Field({ label, hint, children }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
            {children}
            {hint && <span style={{ fontSize: 10, color: "#94a3b8" }}>{hint}</span>}
        </div>
    );
}

function TextInput({ value, onChange, placeholder, style }) {
    return (
        <input
            type="text"
            value={value || ""}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#1e293b", background: "#f8fafc", width: "100%", boxSizing: "border-box", ...style }}
        />
    );
}

function NumberInput({ value, onChange, step = 1, min, placeholder, prefix, suffix }) {
    return (
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            {prefix && <span style={{ position: "absolute", left: 10, fontSize: 12, fontWeight: 800, color: "#94a3b8", pointerEvents: "none" }}>{prefix}</span>}
            <input
                type="number"
                value={value ?? ""}
                onChange={e => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                step={step}
                min={min}
                placeholder={placeholder}
                style={{ border: "1px solid #e2e8f0", borderRadius: 9, padding: `8px ${suffix ? "36px" : "12px"} 8px ${prefix ? "24px" : "12px"}`, fontSize: 13, fontWeight: 600, color: "#1e293b", background: "#f8fafc", width: "100%", boxSizing: "border-box" }}
            />
            {suffix && <span style={{ position: "absolute", right: 10, fontSize: 11, fontWeight: 800, color: "#94a3b8", pointerEvents: "none" }}>{suffix}</span>}
        </div>
    );
}

// ─── Task row list ─────────────────────────────────────────────────────────────
function TaskEditor({ tasks = [], onAdd, onUpdate, onDelete, accent = "#3b82f6" }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tasks.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: 12, fontWeight: 600, border: "2px dashed #e2e8f0", borderRadius: 10 }}>
                    No tasks yet — add steps cleaners must complete.
                </div>
            ) : (
                tasks.map((task, idx) => (
                    <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#cbd5e1", minWidth: 20, textAlign: "center" }}>{idx + 1}</span>
                        <input
                            type="text"
                            value={task.label}
                            onChange={e => onUpdate(task.id, "label", e.target.value)}
                            placeholder="Describe this step…"
                            style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#1e293b", background: "#fff" }}
                        />
                        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", flexShrink: 0 }} title="Require a photo for this step">
                            <input
                                type="checkbox"
                                checked={task.requiresPhoto}
                                onChange={e => onUpdate(task.id, "requiresPhoto", e.target.checked)}
                                style={{ width: 14, height: 14, accentColor: accent, cursor: "pointer" }}
                            />
                            <span style={{ fontSize: 11, fontWeight: 700, color: task.requiresPhoto ? accent : "#94a3b8" }}>📷</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => onDelete(task.id)}
                            title="Remove task"
                            style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                        >
                            ×
                        </button>
                    </div>
                ))
            )}
            <Btn variant="ghost" onClick={onAdd} style={{ alignSelf: "flex-start", marginTop: 2 }}>
                + Add step
            </Btn>
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

    if (!cat) return null;

    const TABS = [
        { id: "types",   label: "Service Types", count: (cat.serviceTypes || []).length, accent: "#7c3aed" },
        { id: "sizes",   label: cat.sizeLabel || "Size Tiers", count: (cat.sizes || []).length, accent: "#0891b2" },
        { id: "addons",  label: "Add-ons", count: (cat.addons || []).length, accent: "#0d9488" },
        { id: "basics",  label: "Basics", accent: "#64748b" },
        { id: "settings",label: "Dimensions", accent: "#d97706" },
    ];

    const activeTabObj = TABS.find(t => t.id === editorTab) || TABS[0];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "#f8fafc", borderRadius: 20, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>

            {/* ── TOP BAR ─────────────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "18px 28px", background: "#fff", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 2 }}>Catalog Studio · Desktop Only</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#1e293b" }}>V2 Service Manager</div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    {[
                        { label: "Services", val: stats.services, color: "#2563eb" },
                        { label: "Tiers", val: stats.tiers, color: "#0891b2" },
                        { label: "Add-ons", val: stats.addons, color: "#0d9488" },
                        { label: "Tasks", val: stats.tasks, color: "#7c3aed" },
                    ].map(s => (
                        <div key={s.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8" }}>{s.label}</div>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ padding: "12px 28px", background: isSaving ? "#94a3b8" : "#2563eb", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: isSaving ? "not-allowed" : "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
                >
                    {isSaving ? "Saving…" : "💾  Save Catalog"}
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 600 }}>

                {/* ── LEFT: service list ──────────────────────────────────── */}
                <div style={{ background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>Services</span>
                        <Btn variant="ghost" onClick={addService} style={{ fontSize: 11, padding: "4px 10px" }}>+ New</Btn>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px 12px" }}>
                        {catalog.categories.map(c => {
                            const isActive = c.id === activeServiceId;
                            const typeCount = (c.serviceTypes || []).length;
                            const sizeCount = (c.sizes || []).length;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setActiveServiceId(c.id)}
                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12, border: isActive ? "2px solid #2563eb" : "2px solid transparent", background: isActive ? "#eff6ff" : "transparent", cursor: "pointer", marginBottom: 4, transition: "all 0.15s" }}
                                >
                                    <div style={{ fontSize: 13, fontWeight: 800, color: isActive ? "#1d4ed8" : "#1e293b", lineHeight: "1.3" }}>{c.name}</div>
                                    <div style={{ fontSize: 10, color: isActive ? "#3b82f6" : "#94a3b8", marginTop: 4, display: "flex", gap: 8 }}>
                                        <span>{typeCount} type{typeCount !== 1 ? "s" : ""}</span>
                                        <span>·</span>
                                        <span>{sizeCount} tier{sizeCount !== 1 ? "s" : ""}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── RIGHT: editor ───────────────────────────────────────── */}
                <div style={{ display: "flex", flexDirection: "column" }}>

                    {/* Service name bar */}
                    <div style={{ padding: "14px 24px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 900, color: "#1e293b" }}>{cat.name}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{cat.pricingModel?.replaceAll("_", " ")} · {(cat.serviceTypes || []).length} types · {(cat.sizes || []).length} tiers · {(cat.addons || []).length} add-ons</div>
                        </div>
                        <Btn variant="danger" onClick={deleteService} disabled={catalog.categories.length <= 1}>Delete Service</Btn>
                    </div>

                    {/* Tab strip */}
                    <div style={{ display: "flex", gap: 0, background: "#f8fafc", borderBottom: "1px solid #e2e8f0", overflowX: "auto" }}>
                        {TABS.map(tab => {
                            const isActive = editorTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setEditorTab(tab.id)}
                                    style={{ padding: "12px 20px", border: "none", borderBottom: isActive ? `3px solid ${tab.accent}` : "3px solid transparent", background: isActive ? "#fff" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, transition: "all 0.15s" }}
                                >
                                    <span style={{ fontSize: 12, fontWeight: 800, color: isActive ? tab.accent : "#94a3b8" }}>{tab.label}</span>
                                    {tab.count !== undefined && (
                                        <span style={{ fontSize: 10, fontWeight: 800, background: isActive ? tab.accent : "#e2e8f0", color: isActive ? "#fff" : "#94a3b8", borderRadius: 20, padding: "1px 7px" }}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab content */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

                        {/* ══ SERVICE TYPES TAB ══════════════════════════════ */}
                        {editorTab === "types" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>Service Types</div>
                                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Each type has its own price multiplier and task checklist for cleaners.</div>
                                    </div>
                                    <Btn variant="secondary" onClick={addServiceType} style={{ background: "#ede9fe", color: "#7c3aed", border: "1px solid #ddd6fe" }}>+ Add Type</Btn>
                                </div>

                                {(cat.serviceTypes || []).length === 0 && (
                                    <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600, border: "2px dashed #e2e8f0", borderRadius: 14 }}>
                                        No service types yet. Add variants like "Standard", "Deep Clean", "Move In/Out"…
                                    </div>
                                )}

                                {(cat.serviceTypes || []).map((st, idx) => {
                                    const isOpen = expandedTypeId === st.id;
                                    const multiplierLabel = st.multiplier === 1 ? "Base price" : `×${parseFloat(st.multiplier).toFixed(2)} — ${Math.round((st.multiplier - 1) * 100)}% more`;
                                    return (
                                        <SectionCard key={st.id}>
                                            {/* Type header */}
                                            <div
                                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer", background: isOpen ? "#faf5ff" : "#fff", borderBottom: isOpen ? "1px solid #ede9fe" : "none" }}
                                                onClick={() => setExpandedTypeId(isOpen ? null : st.id)}
                                            >
                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#7c3aed", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{st.name || "Untitled Type"}</div>
                                                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                                        {multiplierLabel} · {(st.tasks || []).length} task{(st.tasks || []).length !== 1 ? "s" : ""}
                                                    </div>
                                                </div>
                                                {st.multiplier > 1 && <Badge color="#7c3aed" bg="#ede9fe">×{parseFloat(st.multiplier).toFixed(2)}</Badge>}
                                                <span style={{ fontSize: 12, color: "#94a3b8" }}>{isOpen ? "▲" : "▼"}</span>
                                            </div>

                                            {isOpen && (
                                                <div style={{ padding: "18px" }}>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 14, marginBottom: 20 }}>
                                                        <Field label="Type Name" hint="e.g. Standard Clean, Deep Clean, Move In/Out">
                                                            <TextInput value={st.name} onChange={v => updateServiceType(st.id, "name", v)} placeholder="e.g. Deep Clean" />
                                                        </Field>
                                                        <Field label="Price Multiplier" hint="1.0 = no change · 1.35 = 35% higher">
                                                            <NumberInput value={st.multiplier} onChange={v => updateServiceType(st.id, "multiplier", parseFloat(v) || 1)} step={0.05} min={0.5} />
                                                        </Field>
                                                    </div>

                                                    {/* Price preview bar */}
                                                    {(cat.sizes || []).length > 0 && (
                                                        <div style={{ background: "#f5f3ff", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 20, overflowX: "auto" }}>
                                                            {(cat.sizes || []).slice(0, 4).map(s => (
                                                                <div key={s.id} style={{ flexShrink: 0, textAlign: "center" }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed" }}>${(parseFloat(s.price || 0) * parseFloat(st.multiplier || 1)).toFixed(2)}</div>
                                                                    <div style={{ fontSize: 9, color: "#a78bfa" }}>{s.name}</div>
                                                                </div>
                                                            ))}
                                                            {(cat.sizes || []).length > 4 && <div style={{ flexShrink: 0, fontSize: 10, color: "#a78bfa", alignSelf: "center" }}>+{(cat.sizes || []).length - 4} more</div>}
                                                        </div>
                                                    )}

                                                    {/* Task checklist */}
                                                    <div style={{ marginBottom: 14 }}>
                                                        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                                                            Cleaner Task Checklist
                                                            <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>
                                                                — steps cleaners must tick off during this job type (📷 = photo required)
                                                            </span>
                                                        </div>
                                                        <TaskEditor
                                                            tasks={st.tasks || []}
                                                            onAdd={() => addServiceTypeTask(st.id)}
                                                            onUpdate={(taskId, field, value) => updateServiceTypeTask(st.id, taskId, field, value)}
                                                            onDelete={(taskId) => deleteServiceTypeTask(st.id, taskId)}
                                                            accent="#7c3aed"
                                                        />
                                                    </div>

                                                    <div style={{ paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                                                        <Btn variant="danger" onClick={() => deleteServiceType(st.id)}>Delete "{st.name || "this type"}"</Btn>
                                                    </div>
                                                </div>
                                            )}
                                        </SectionCard>
                                    );
                                })}
                            </div>
                        )}

                        {/* ══ SIZE TIERS TAB ═════════════════════════════════ */}
                        {editorTab === "sizes" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{cat.sizeLabel || "Size Tiers"}</div>
                                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Set the base price and duration for each tier. Service type multipliers are applied on top.</div>
                                    </div>
                                    <Btn variant="secondary" onClick={addSize} style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>+ Add Tier</Btn>
                                </div>

                                {(cat.sizes || []).length === 0 ? (
                                    <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600, border: "2px dashed #e2e8f0", borderRadius: 14 }}>
                                        No size tiers yet.
                                    </div>
                                ) : (
                                    <SectionCard>
                                        {/* Table header */}
                                        <div style={{ display: "grid", gridTemplateColumns: cat.hasPropertyType ? "1fr 110px 90px 140px 40px" : "1fr 110px 90px 40px", gap: 10, padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Name</span>
                                            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Base Price</span>
                                            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Hours</span>
                                            {cat.hasPropertyType && <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Property Group</span>}
                                            <span></span>
                                        </div>
                                        <div style={{ maxHeight: 480, overflowY: "auto" }}>
                                            {(cat.sizes || []).map((size, idx) => (
                                                <div
                                                    key={size.id}
                                                    style={{ display: "grid", gridTemplateColumns: cat.hasPropertyType ? "1fr 110px 90px 140px 40px" : "1fr 110px 90px 40px", gap: 10, padding: "10px 16px", alignItems: "center", borderBottom: idx < (cat.sizes || []).length - 1 ? "1px solid #f1f5f9" : "none", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}
                                                >
                                                    <input
                                                        type="text"
                                                        value={size.name}
                                                        onChange={e => updateSize(size.id, "name", e.target.value)}
                                                        style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, color: "#1e293b", background: "#fff", width: "100%" }}
                                                    />
                                                    <div style={{ position: "relative" }}>
                                                        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 800, color: "#94a3b8" }}>$</span>
                                                        <input
                                                            type="number"
                                                            value={size.price}
                                                            onChange={e => updateSize(size.id, "price", parseFloat(e.target.value) || 0)}
                                                            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px 6px 20px", fontSize: 13, fontWeight: 600, color: "#1e293b", background: "#fff", width: "100%" }}
                                                        />
                                                    </div>
                                                    <div style={{ position: "relative" }}>
                                                        <input
                                                            type="number"
                                                            step="0.5"
                                                            value={size.durationHrs}
                                                            onChange={e => updateSize(size.id, "durationHrs", parseFloat(e.target.value) || 0)}
                                                            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 28px 6px 8px", fontSize: 13, fontWeight: 600, color: "#1e293b", background: "#fff", width: "100%" }}
                                                        />
                                                        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 800, color: "#94a3b8" }}>hrs</span>
                                                    </div>
                                                    {cat.hasPropertyType && (
                                                        <select
                                                            value={size.propertyTypeId || ""}
                                                            onChange={e => assignSizeToPropertyType(size.id, e.target.value || null)}
                                                            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px", fontSize: 12, fontWeight: 600, color: "#475569", background: "#fff", width: "100%" }}
                                                        >
                                                            <option value="">— None —</option>
                                                            {(cat.propertyTypes || []).map(pt => (
                                                                <option key={pt.id} value={pt.id}>{pt.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteSize(size.id)}
                                                        title="Remove this tier"
                                                        style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}
                            </div>
                        )}

                        {/* ══ ADD-ONS TAB ════════════════════════════════════ */}
                        {editorTab === "addons" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>Add-ons</div>
                                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Extras customers can add to this service. Each add-on can have its own cleaner tasks.</div>
                                    </div>
                                    <Btn variant="secondary" onClick={addAddon} style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}>+ Add Add-on</Btn>
                                </div>

                                {(cat.addons || []).length === 0 && (
                                    <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600, border: "2px dashed #e2e8f0", borderRadius: 14 }}>
                                        No add-ons configured for this service.
                                    </div>
                                )}

                                {(cat.addons || []).map(addon => {
                                    const isOpen = expandedAddonId === addon.id;
                                    return (
                                        <SectionCard key={addon.id}>
                                            <div
                                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: isOpen ? "#f0fdf4" : "#fff", borderBottom: isOpen ? "1px solid #bbf7d0" : "none" }}
                                                onClick={() => setExpandedAddonId(isOpen ? null : addon.id)}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b" }}>{addon.name || "Untitled Add-on"}</div>
                                                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                                        ${parseFloat(addon.price || 0).toFixed(2)} {addon.qtySelector ? "· qty selector" : "· on/off"} {(addon.tasks || []).length > 0 ? `· ${(addon.tasks || []).length} task${(addon.tasks || []).length !== 1 ? "s" : ""}` : ""}
                                                    </div>
                                                </div>
                                                <Badge color="#15803d" bg="#dcfce7">${parseFloat(addon.price || 0).toFixed(2)}</Badge>
                                                {(addon.tasks || []).length > 0 && <Badge color="#1d4ed8" bg="#dbeafe">{(addon.tasks || []).length} tasks</Badge>}
                                                <span style={{ fontSize: 12, color: "#94a3b8" }}>{isOpen ? "▲" : "▼"}</span>
                                            </div>

                                            {isOpen && (
                                                <div style={{ padding: "16px" }}>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 160px", gap: 14, marginBottom: 16 }}>
                                                        <Field label="Add-on Name">
                                                            <TextInput value={addon.name} onChange={v => updateAddon(addon.id, "name", v)} placeholder="e.g. Inside the Oven" />
                                                        </Field>
                                                        <Field label="Price ($)">
                                                            <NumberInput value={addon.price} onChange={v => updateAddon(addon.id, "price", parseFloat(v) || 0)} prefix="$" />
                                                        </Field>
                                                        <Field label="Qty Mode" hint="On/off = single toggle · Qty = number input">
                                                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 9, background: "#f8fafc" }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!addon.qtySelector}
                                                                    onChange={e => updateAddon(addon.id, "qtySelector", e.target.checked)}
                                                                    style={{ width: 15, height: 15, accentColor: "#0d9488", cursor: "pointer" }}
                                                                />
                                                                <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Qty selector on</span>
                                                            </label>
                                                        </Field>
                                                    </div>

                                                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14, marginBottom: 14 }}>
                                                        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                                                            Extra Steps for Cleaners
                                                            <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>
                                                                — added to the job checklist when this add-on is selected
                                                            </span>
                                                        </div>
                                                        <TaskEditor
                                                            tasks={addon.tasks || []}
                                                            onAdd={() => addAddonTask(addon.id)}
                                                            onUpdate={(taskId, field, value) => updateAddonTask(addon.id, taskId, field, value)}
                                                            onDelete={(taskId) => deleteAddonTask(addon.id, taskId)}
                                                            accent="#0d9488"
                                                        />
                                                    </div>

                                                    <div style={{ paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                                                        <Btn variant="danger" onClick={() => deleteAddon(addon.id)}>Delete "{addon.name || "this add-on"}"</Btn>
                                                    </div>
                                                </div>
                                            )}
                                        </SectionCard>
                                    );
                                })}
                            </div>
                        )}

                        {/* ══ BASICS TAB ═════════════════════════════════════ */}
                        {editorTab === "basics" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                <SectionCard>
                                    <SectionHeader icon="⚙️" title="Service Basics" subtitle="Core configuration for this service" />
                                    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                                        <Field label="Service Name">
                                            <TextInput value={cat.name} onChange={v => updateField("name", v)} placeholder="e.g. House Cleaning (Interior)" />
                                        </Field>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                            <Field label="Pricing Model">
                                                <select
                                                    value={cat.pricingModel}
                                                    onChange={e => updateField("pricingModel", e.target.value)}
                                                    style={{ border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#1e293b", background: "#f8fafc" }}
                                                >
                                                    <option value="flat_rate">Flat Rate</option>
                                                    <option value="size_based">Size-Based Tiers</option>
                                                    <option value="flat_plus_unit">Base Rate + Per Unit</option>
                                                    <option value="flat_plus_sqft">Base Rate + Per SqFt</option>
                                                </select>
                                            </Field>
                                            <Field label="Size / Scope Label" hint="Replaces 'Size Tiers' as the heading shown to customers">
                                                <TextInput value={cat.sizeLabel} onChange={v => updateField("sizeLabel", v)} placeholder="e.g. Number of Panels, Yard Size" />
                                            </Field>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                            <Field label="Base Rate ($)" hint="Used when no size tier is selected">
                                                <NumberInput value={cat.baseRate} onChange={v => updateField("baseRate", parseFloat(v) || 0)} prefix="$" />
                                            </Field>
                                            <Field label="Duration (hrs)" hint="Default duration for this service">
                                                <NumberInput value={cat.durationHrs} onChange={v => updateField("durationHrs", parseFloat(v) || 0)} step={0.5} suffix="hrs" />
                                            </Field>
                                        </div>
                                        {(cat.pricingModel === "flat_plus_unit" || cat.pricingModel === "flat_plus_sqft") && (
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                                <Field label="Unit Label">
                                                    <TextInput value={cat.unitName} onChange={v => updateField("unitName", v)} placeholder="e.g. Additional Pane" />
                                                </Field>
                                                <Field label="Unit Price ($)">
                                                    <NumberInput value={cat.unitPrice} onChange={v => updateField("unitPrice", parseFloat(v) || 0)} prefix="$" />
                                                </Field>
                                            </div>
                                        )}
                                    </div>
                                </SectionCard>

                                {/* Fallback task checklist */}
                                <SectionCard>
                                    <SectionHeader
                                        icon="📋"
                                        title="Fallback Task Checklist"
                                        subtitle="Used for old bookings without a service type"
                                        action={<Btn variant="ghost" onClick={addTask} style={{ fontSize: 11, padding: "5px 12px" }}>+ Add Step</Btn>}
                                    />
                                    <div style={{ padding: "16px 20px" }}>
                                        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                                            💡 These steps are only used when a booking has no "service type" selected (older bookings). New bookings use the tasks from each Service Type above.
                                        </div>
                                        <TaskEditor
                                            tasks={cat.tasks || []}
                                            onAdd={addTask}
                                            onUpdate={updateTask}
                                            onDelete={deleteTask}
                                        />
                                    </div>
                                </SectionCard>
                            </div>
                        )}

                        {/* ══ DIMENSIONS TAB ═════════════════════════════════ */}
                        {editorTab === "settings" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                <SectionCard>
                                    <SectionHeader icon="📐" title="Optional Dimensions" subtitle="Enable extra booking fields for this service" />
                                    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                                        {[
                                            { field: "hasPropertyType", label: "Property Types", desc: "Groups sizes into Apartment / Townhouse / House etc.", icon: "🏠" },
                                            { field: "hasBedrooms",    label: "Bedrooms",       desc: "Shows bedroom count as part of size selection.",    icon: "🛏" },
                                            { field: "hasBathrooms",   label: "Bathrooms",      desc: "Adds a bathroom surcharge picker to the booking.",  icon: "🚿" },
                                        ].map(dim => (
                                            <label key={dim.field} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", border: `2px solid ${cat[dim.field] ? "#bfdbfe" : "#e2e8f0"}`, borderRadius: 12, background: cat[dim.field] ? "#eff6ff" : "#fafafa", cursor: "pointer" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!cat[dim.field]}
                                                    onChange={e => updateField(dim.field, e.target.checked)}
                                                    style={{ width: 18, height: 18, marginTop: 1, accentColor: "#2563eb", cursor: "pointer", flexShrink: 0 }}
                                                />
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{dim.icon} {dim.label}</div>
                                                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{dim.desc}</div>
                                                </div>
                                                {cat[dim.field] && <Badge color="#1d4ed8" bg="#dbeafe" style={{ marginLeft: "auto", flexShrink: 0 }}>ON</Badge>}
                                            </label>
                                        ))}
                                    </div>
                                </SectionCard>

                                {/* Property Types manager */}
                                {cat.hasPropertyType && (
                                    <SectionCard>
                                        <SectionHeader
                                            icon="🏘️"
                                            title="Property Type Groups"
                                            subtitle="Name each group — then assign sizes to them in the Sizes tab"
                                            action={<Btn variant="ghost" onClick={addPropertyType} style={{ fontSize: 11 }}>+ Add Group</Btn>}
                                        />
                                        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                                            {(cat.propertyTypes || []).length === 0 && (
                                                <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: 12, fontWeight: 600, border: "2px dashed #e2e8f0", borderRadius: 10 }}>
                                                    No property types yet.
                                                </div>
                                            )}
                                            {(cat.propertyTypes || []).map(pt => (
                                                <div key={pt.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff" }}>
                                                    <input
                                                        type="text"
                                                        value={pt.name}
                                                        onChange={e => updatePropertyType(pt.id, "name", e.target.value)}
                                                        placeholder="e.g. Apartment"
                                                        style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, color: "#1e293b", background: "#f8fafc" }}
                                                    />
                                                    <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                                                        {(pt.sizeIds || []).length} size{(pt.sizeIds || []).length !== 1 ? "s" : ""} assigned
                                                    </span>
                                                    <Btn variant="danger" onClick={() => deletePropertyType(pt.id)} style={{ padding: "4px 10px", fontSize: 11 }}>Remove</Btn>
                                                </div>
                                            ))}
                                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                                                To assign sizes to these groups, go to the <strong>Sizes</strong> tab — each row has a "Property Group" dropdown.
                                            </div>
                                        </div>
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
