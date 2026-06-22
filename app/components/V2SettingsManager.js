"use client";

import React, { useState } from "react";

const fieldClass = "catalog-studio-field";
const secondaryButtonClass = "catalog-studio-button catalog-studio-button-secondary";
const dangerButtonClass = "catalog-studio-button catalog-studio-button-danger";
const fieldGroupClass = "space-y-2";

export default function V2SettingsManager({ catalog, setCatalog, onSave }) {
    const [activeTab, setActiveTab] = useState(catalog.categories[0]?.id || "");
    const [isSaving, setIsSaving] = useState(false);

    const createLocalId = (prefix) => {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return `${prefix}_${crypto.randomUUID()}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    };

    const catalogStats = React.useMemo(() => {
        const categories = catalog.categories.length;
        const tiers = catalog.categories.reduce((sum, cat) => sum + (cat.sizes?.length || 0), 0);
        const addons = catalog.categories.reduce((sum, cat) => sum + (cat.addons?.length || 0), 0);
        return { categories, tiers, addons };
    }, [catalog.categories]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(catalog);
        } finally {
            setIsSaving(false);
        }
    };

    const activeCategory = catalog.categories.find(c => c.id === activeTab);

    const updateCategoryField = (field, value) => {
        setCatalog(prev => ({
            ...prev,
            categories: prev.categories.map(cat =>
                cat.id === activeTab ? { ...cat, [field]: value } : cat
            )
        }));
    };

    const updateSize = (sizeId, field, value) => {
        setCatalog(prev => ({
            ...prev,
            categories: prev.categories.map(cat =>
                cat.id === activeTab
                    ? {
                        ...cat,
                        sizes: (cat.sizes || []).map(s => s.id === sizeId ? { ...s, [field]: value } : s)
                    }
                    : cat
            )
        }));
    };

    const updateAddon = (addonId, field, value) => {
        setCatalog(prev => ({
            ...prev,
            categories: prev.categories.map(cat =>
                cat.id === activeTab
                    ? {
                        ...cat,
                        addons: (cat.addons || []).map(a => a.id === addonId ? { ...a, [field]: value } : a)
                    }
                    : cat
            )
        }));
    };

    const addSizeTier = () => {
        const newTier = {
            id: createLocalId("tier"),
            name: "New Tier",
            price: 0,
            durationHrs: 1
        };

        setCatalog(prev => ({
            ...prev,
            categories: prev.categories.map(cat =>
                cat.id === activeTab
                    ? { ...cat, sizes: [...(cat.sizes || []), newTier] }
                    : cat
            )
        }));
    };

    const addAddon = () => {
        const newAddon = {
            id: createLocalId("addon"),
            name: "New Add-on",
            price: 0,
            qtySelector: false
        };

        setCatalog(prev => ({
            ...prev,
            categories: prev.categories.map(cat =>
                cat.id === activeTab
                    ? { ...cat, addons: [...(cat.addons || []), newAddon] }
                    : cat
            )
        }));
    };

    const addService = () => {
        const newService = {
            id: createLocalId("service"),
            name: "New Service",
            pricingModel: "flat_rate",
            baseRate: 0,
            durationHrs: 1,
            unitName: "Unit",
            unitPrice: 0,
            sizes: [],
            addons: []
        };

        setCatalog(prev => ({
            ...prev,
            categories: [...prev.categories, newService]
        }));
        setActiveTab(newService.id);
    };

    const deleteService = () => {
        setCatalog(prev => {
            const remainingCategories = prev.categories.filter(cat => cat.id !== activeTab);
            const nextActiveTab = remainingCategories[0]?.id || "";
            setActiveTab(nextActiveTab);

            return {
                ...prev,
                categories: remainingCategories
            };
        });
    };

    const deleteSizeTier = (sizeId) => {
        setCatalog(prev => ({
            ...prev,
            categories: prev.categories.map(cat =>
                cat.id === activeTab
                    ? { ...cat, sizes: (cat.sizes || []).filter(size => size.id !== sizeId) }
                    : cat
            )
        }));
    };

    const deleteAddon = (addonId) => {
        setCatalog(prev => ({
            ...prev,
            categories: prev.categories.map(cat =>
                cat.id === activeTab
                    ? { ...cat, addons: (cat.addons || []).filter(addon => addon.id !== addonId) }
                    : cat
            )
        }));
    };

    const addTask = () => {
        const newTask = { id: createLocalId("task"), label: "New Task", requiresPhoto: false };
        setCatalog(prev => ({
            ...prev,
            categories: prev.categories.map(cat =>
                cat.id === activeTab
                    ? { ...cat, tasks: [...(cat.tasks || []), newTask] }
                    : cat
            )
        }));
    };

    const updateTask = (taskId, field, value) => {
        setCatalog(prev => ({
            ...prev,
            categories: prev.categories.map(cat =>
                cat.id === activeTab
                    ? { ...cat, tasks: (cat.tasks || []).map(t => t.id === taskId ? { ...t, [field]: value } : t) }
                    : cat
            )
        }));
    };

    const deleteTask = (taskId) => {
        setCatalog(prev => ({
            ...prev,
            categories: prev.categories.map(cat =>
                cat.id === activeTab
                    ? { ...cat, tasks: (cat.tasks || []).filter(t => t.id !== taskId) }
                    : cat
            )
        }));
    };

    if (!activeCategory) return null;

    return (
        <section className="catalog-studio-shell mt-10 overflow-hidden rounded-brand-lg border border-brand-mist bg-white shadow-sparkle">
            <div className="catalog-studio-topbar border-b border-brand-mist bg-white px-8 py-7">
                <div className="catalog-studio-heading-block min-w-0">
                    <p className="catalog-studio-eyebrow">Desktop Catalog Studio</p>
                    <h3 className="catalog-studio-hero-title">
                        V2 Dynamic Service Manager
                    </h3>
                    <p className="catalog-studio-hero-copy max-w-3xl">
                        A wide-format control surface for pricing models, service tiers, and add-on rules.
                    </p>
                </div>
                <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-brand-sm border border-brand-mist bg-slate-50">
                    <div className="border-r border-brand-mist px-5 py-3 text-center">
                        <span className="block font-heading text-2xl font-black text-brand-action">{catalogStats.categories}</span>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Services</span>
                    </div>
                    <div className="border-r border-brand-mist px-5 py-3 text-center">
                        <span className="block font-heading text-2xl font-black text-brand-green">{catalogStats.tiers}</span>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tiers</span>
                    </div>
                    <div className="px-5 py-3 text-center">
                        <span className="block font-heading text-2xl font-black text-brand-deep">{catalogStats.addons}</span>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Add-ons</span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex h-14 min-w-[240px] items-center justify-center rounded-brand-sm bg-brand-action px-7 font-heading text-base font-bold text-white shadow-sparkle transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSaving ? "Saving Catalog..." : "Save V2 Catalog"}
                </button>
            </div>

            <div className="catalog-studio-layout bg-slate-50/70 p-6">
                <section className="rounded-brand-lg border border-brand-mist bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                        <h4 className="font-heading text-sm font-black uppercase tracking-wider text-brand-slate">Services</h4>
                        <span className="rounded-full bg-brand-mist/55 px-2.5 py-1 text-[10px] font-bold text-brand-slate">
                            {catalog.categories.length}
                        </span>
                    </div>
                    <div className="flex max-h-[610px] flex-col gap-3 overflow-y-auto pr-1">
                        {catalog.categories.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveTab(cat.id)}
                                className={`catalog-studio-service-card group text-left transition ${
                                    activeTab === cat.id
                                        ? "border-brand-action bg-brand-action text-white shadow-sparkle"
                                        : "border-brand-mist bg-white text-brand-slate hover:border-brand-sky hover:bg-brand-mist/20"
                                }`}
                            >
                                <span className="block font-heading text-base font-black leading-6">{cat.name}</span>
                                <span className={`mt-2 block text-xs font-semibold uppercase tracking-wide ${
                                    activeTab === cat.id ? "text-white/75" : "text-slate-400 group-hover:text-brand-deep"
                                }`}>
                                    {cat.pricingModel.replaceAll("_", " ")}
                                </span>
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={addService}
                        className="catalog-studio-button mt-5 w-full border border-brand-mint bg-brand-mint/25 font-heading text-sm font-bold text-brand-green transition hover:bg-brand-mint/45"
                    >
                        + Add Service
                    </button>
                </section>

                <section className="rounded-brand-lg border border-brand-mist bg-white p-7 shadow-sm">
                    <div className="catalog-studio-service-header catalog-studio-section-heading mb-6 gap-5">
                        <div className="min-w-0">
                            <p className="catalog-studio-eyebrow">Selected Service</p>
                            <h4 className="catalog-studio-section-title break-words">{activeCategory.name}</h4>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <span className="rounded-full bg-brand-action/10 px-4 py-2 font-heading text-xs font-bold uppercase text-brand-action">
                                {activeCategory.pricingModel.replaceAll("_", " ")}
                            </span>
                            <button
                                type="button"
                                onClick={deleteService}
                                disabled={catalog.categories.length <= 1}
                                className={`${dangerButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                                Delete Service
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="mb-2.5 block font-heading text-xs font-bold uppercase tracking-wide text-brand-slate">Service Name</label>
                            <input
                                type="text"
                                value={activeCategory.name}
                                onChange={e => updateCategoryField("name", e.target.value)}
                                className={fieldClass}
                            />
                        </div>

                        <div>
                            <label className="mb-2.5 block font-heading text-xs font-bold uppercase tracking-wide text-brand-slate">Pricing Model</label>
                            <select
                                value={activeCategory.pricingModel}
                                onChange={e => updateCategoryField("pricingModel", e.target.value)}
                                className={fieldClass}
                            >
                                <option value="flat_rate">Flat Rate</option>
                                <option value="size_based">Size-Based Tiers</option>
                                <option value="flat_plus_unit">Base Rate + Per Unit</option>
                                <option value="flat_plus_sqft">Base Rate + Per SqFt</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="mb-2.5 block font-heading text-xs font-bold uppercase tracking-wide text-brand-slate">Base Rate</label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-heading text-xs font-black text-slate-400">$</span>
                                    <input
                                        type="number"
                                        value={activeCategory.baseRate}
                                        onChange={e => updateCategoryField("baseRate", parseFloat(e.target.value))}
                                        className={`${fieldClass} catalog-studio-field-currency`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-2.5 block font-heading text-xs font-bold uppercase tracking-wide text-brand-slate">Duration</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={activeCategory.durationHrs || 0}
                                        onChange={e => updateCategoryField("durationHrs", parseFloat(e.target.value))}
                                        className={`${fieldClass} catalog-studio-field-unit`}
                                    />
                                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-heading text-xs font-black text-slate-400">hrs</span>
                                </div>
                            </div>
                        </div>

                        {(activeCategory.pricingModel === "flat_plus_unit" || activeCategory.pricingModel === "flat_plus_sqft") && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block font-heading text-xs font-bold uppercase tracking-wide text-brand-slate">Unit Label</label>
                                    <input
                                        type="text"
                                        value={activeCategory.unitName || ""}
                                        onChange={e => updateCategoryField("unitName", e.target.value)}
                                        className={fieldClass}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block font-heading text-xs font-bold uppercase tracking-wide text-brand-slate">Unit Price</label>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-heading text-xs font-black text-slate-400">$</span>
                                        <input
                                            type="number"
                                            value={activeCategory.unitPrice || 0}
                                            onChange={e => updateCategoryField("unitPrice", parseFloat(e.target.value) || 0)}
                                            className={`${fieldClass} catalog-studio-field-currency`}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {activeCategory.pricingModel === "size_based" && (
                    <section className="rounded-brand-lg border border-brand-mist bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center justify-between gap-4">
                            <h4 className="font-heading text-sm font-black uppercase tracking-wider text-brand-slate">Size Tiers</h4>
                            <button type="button" onClick={addSizeTier} className={secondaryButtonClass}>
                                + Add Tier
                            </button>
                        </div>
                        <div className="max-h-[420px] overflow-y-auto pt-1">
                            {(activeCategory.sizes || []).map(size => (
                                <details key={size.id} className="catalog-studio-collapsible" open>
                                    <summary className="catalog-studio-collapsible-summary">
                                        <span className="catalog-studio-collapsible-title">{size.name || "Untitled Tier"}</span>
                                        <span className="catalog-studio-collapsible-meta">
                                            ${parseFloat(size.price || 0).toFixed(2)} • {parseFloat(size.durationHrs || 0).toFixed(1)} hrs
                                        </span>
                                    </summary>
                                    <div className="catalog-studio-collapsible-body">
                                        <div className="catalog-studio-collapsible-grid">
                                            <div className={fieldGroupClass}>
                                                <label className="catalog-studio-mini-label">Tier Name</label>
                                                <input
                                                    type="text"
                                                    value={size.name}
                                                    onChange={e => updateSize(size.id, "name", e.target.value)}
                                                    className={fieldClass}
                                                />
                                            </div>
                                            <div className={fieldGroupClass}>
                                                <label className="catalog-studio-mini-label">Price</label>
                                                <input
                                                    type="number"
                                                    value={size.price}
                                                    onChange={e => updateSize(size.id, "price", parseFloat(e.target.value))}
                                                    className={fieldClass}
                                                />
                                            </div>
                                            <div className={fieldGroupClass}>
                                                <label className="catalog-studio-mini-label">Hours</label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={size.durationHrs}
                                                    onChange={e => updateSize(size.id, "durationHrs", parseFloat(e.target.value) || 0)}
                                                    className={fieldClass}
                                                />
                                            </div>
                                        </div>
                                        <div className="catalog-studio-collapsible-actions">
                                            <button
                                                type="button"
                                                onClick={() => deleteSizeTier(size.id)}
                                                className={dangerButtonClass}
                                            >
                                                Delete Tier
                                            </button>
                                        </div>
                                    </div>
                                </details>
                            ))}
                        </div>
                    </section>
                )}

                <section className="flex h-full flex-col rounded-brand-lg border border-brand-mist bg-white shadow-sm">
                    <div className="catalog-studio-section-heading flex items-center justify-between gap-4 border-b border-brand-mist px-6 py-5">
                        <div>
                            <p className="catalog-studio-eyebrow">Rules</p>
                            <h4 className="catalog-studio-section-title">Service-Specific Add-ons</h4>
                        </div>
                        <button type="button" onClick={addAddon} className={secondaryButtonClass}>
                            + Add Add-on
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {(activeCategory.addons || []).length === 0 ? (
                            <div className="flex h-40 items-center justify-center rounded-brand-sm border border-dashed border-brand-mist text-sm font-semibold text-slate-400">
                                No add-ons configured for this service.
                            </div>
                        ) : (
                            (activeCategory.addons || []).map(addon => (
                                <details key={addon.id} className="catalog-studio-collapsible" open>
                                    <summary className="catalog-studio-collapsible-summary">
                                        <span className="catalog-studio-collapsible-title">{addon.name || "Untitled Add-on"}</span>
                                        <span className="catalog-studio-collapsible-meta">
                                            ${parseFloat(addon.price || 0).toFixed(2)} • {addon.qtySelector ? "Qty selector on" : "Single add-on"}
                                        </span>
                                    </summary>
                                    <div className="catalog-studio-collapsible-body">
                                        <div className="catalog-studio-collapsible-grid">
                                            <div className={fieldGroupClass}>
                                                <label className="catalog-studio-mini-label">Add-on Name</label>
                                                <input
                                                    type="text"
                                                    value={addon.name}
                                                    onChange={e => updateAddon(addon.id, "name", e.target.value)}
                                                    className={fieldClass}
                                                />
                                            </div>
                                            <div className={fieldGroupClass}>
                                                <label className="catalog-studio-mini-label">Price</label>
                                                <div className="relative">
                                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-heading text-xs font-black text-slate-400">$</span>
                                                    <input
                                                        type="number"
                                                        value={addon.price}
                                                        onChange={e => updateAddon(addon.id, "price", parseFloat(e.target.value))}
                                                        className={`${fieldClass} catalog-studio-field-currency`}
                                                    />
                                                </div>
                                            </div>
                                            <div className={fieldGroupClass}>
                                                <label className="catalog-studio-mini-label">Quantity Setting</label>
                                                <label className="flex h-11 cursor-pointer items-center gap-2 rounded-brand-sm border border-brand-mist/90 bg-white px-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={addon.qtySelector}
                                                        onChange={e => updateAddon(addon.id, "qtySelector", e.target.checked)}
                                                        className="h-4 w-4 rounded-brand-sm border-brand-mist accent-brand-action"
                                                    />
                                                    <span className="font-heading text-[10px] font-bold uppercase text-slate-500">Qty selector</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="catalog-studio-collapsible-actions">
                                            <button
                                                type="button"
                                                onClick={() => deleteAddon(addon.id)}
                                                className={dangerButtonClass}
                                            >
                                                Delete Add-on
                                            </button>
                                        </div>
                                    </div>
                                </details>
                            ))
                        )}
                    </div>
                </section>

                {/* ── TASK CHECKLIST ── */}
                <section className="rounded-brand-lg border border-brand-mist bg-white shadow-sm overflow-hidden">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
                        <div>
                            <p className="catalog-studio-eyebrow">Cleaner Workflow</p>
                            <h4 className="catalog-studio-section-title">Task Checklist</h4>
                        </div>
                        <button type="button" onClick={addTask} className={secondaryButtonClass}>
                            + Add Task
                        </button>
                    </div>
                    <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                        {(activeCategory.tasks || []).length === 0 ? (
                            <div style={{ padding: "32px 0", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600, border: "2px dashed #e2e8f0", borderRadius: 12 }}>
                                No tasks yet. Add tasks to guide cleaners step by step.
                            </div>
                        ) : (
                            (activeCategory.tasks || []).map((task, idx) => (
                                <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px" }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", minWidth: 20 }}>{idx + 1}</span>
                                    <input
                                        type="text"
                                        value={task.label}
                                        onChange={e => updateTask(task.id, "label", e.target.value)}
                                        placeholder="Task description…"
                                        style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#1e293b", background: "#fff" }}
                                    />
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>
                                        <input
                                            type="checkbox"
                                            checked={task.requiresPhoto}
                                            onChange={e => updateTask(task.id, "requiresPhoto", e.target.checked)}
                                            style={{ width: 15, height: 15, accentColor: "#3b82f6", cursor: "pointer" }}
                                        />
                                        📷 Photo required
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => deleteTask(task.id)}
                                        style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))
                        )}
                        <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                            Tasks marked "Photo required" will gate the Start Job and Submit for Review buttons in the cleaner workflow.
                        </p>
                    </div>
                </section>
            </div>
        </section>
    );
}
