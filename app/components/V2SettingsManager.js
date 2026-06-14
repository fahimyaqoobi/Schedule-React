"use client";

import React, { useState } from "react";

const fieldClass = "catalog-studio-field";
const secondaryButtonClass = "catalog-studio-button catalog-studio-button-secondary";
const dangerButtonClass = "catalog-studio-button catalog-studio-button-danger";

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

    if (!activeCategory) return null;

    return (
        <section className="catalog-studio-shell mt-10 overflow-hidden rounded-brand-lg border border-brand-mist bg-white shadow-sparkle">
            <div className="catalog-studio-topbar border-b border-brand-mist bg-white px-8 py-7">
                <div className="min-w-0">
                    <p className="font-heading text-xs font-bold uppercase tracking-wider text-brand-sky">Desktop Catalog Studio</p>
                    <h3 className="mt-1 font-heading text-3xl font-black uppercase leading-none text-brand-slate">
                        V2 Dynamic Service Manager
                    </h3>
                    <p className="mt-3 max-w-3xl text-base font-semibold leading-6 text-slate-500">
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
                <aside className="rounded-brand-lg border border-brand-mist bg-white p-5 shadow-sm">
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
                </aside>

                <div className="flex min-w-0 flex-col gap-6">
                    <div className="rounded-brand-lg border border-brand-mist bg-white p-7 shadow-sm">
                        <div className="catalog-studio-service-header mb-6 gap-5">
                            <div className="min-w-0">
                                <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-brand-sky">Selected Service</p>
                                <h4 className="mt-2 break-words font-heading text-[2rem] font-black leading-tight text-brand-slate">{activeCategory.name}</h4>
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
                    </div>

                    {activeCategory.pricingModel === "size_based" && (
                        <div className="rounded-brand-lg border border-brand-mist bg-white p-6 shadow-sm">
                            <div className="mb-5 flex items-center justify-between gap-4">
                                <h4 className="font-heading text-sm font-black uppercase tracking-wider text-brand-slate">Size Tiers</h4>
                                <button type="button" onClick={addSizeTier} className={secondaryButtonClass}>
                                    + Add Tier
                                </button>
                            </div>
                            <div className="catalog-studio-grid-head catalog-studio-tier-row border-b border-brand-mist pb-3">
                                <span>Tier Name</span>
                                <span>Price</span>
                                <span>Hours</span>
                                <span className="text-right">Action</span>
                            </div>
                            <div className="max-h-[360px] overflow-y-auto pt-4">
                                {(activeCategory.sizes || []).map(size => (
                                    <div key={size.id} className="catalog-studio-grid-row catalog-studio-tier-row">
                                        <input
                                            type="text"
                                            value={size.name}
                                            onChange={e => updateSize(size.id, "name", e.target.value)}
                                            className={fieldClass}
                                        />
                                        <input
                                            type="number"
                                            value={size.price}
                                            onChange={e => updateSize(size.id, "price", parseFloat(e.target.value))}
                                            className={fieldClass}
                                        />
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={size.durationHrs}
                                            onChange={e => updateSize(size.id, "durationHrs", parseFloat(e.target.value) || 0)}
                                            className={fieldClass}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => deleteSizeTier(size.id)}
                                            className={dangerButtonClass}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="min-w-0">
                    <div className="flex h-full flex-col rounded-brand-lg border border-brand-mist bg-white shadow-sm">
                        <div className="flex items-center justify-between gap-4 border-b border-brand-mist px-6 py-5">
                            <div>
                                <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-brand-sky">Rules</p>
                                <h4 className="font-heading text-2xl font-black text-brand-slate">Service-Specific Add-ons</h4>
                            </div>
                            <button type="button" onClick={addAddon} className={secondaryButtonClass}>
                                + Add Add-on
                            </button>
                        </div>

                        <div className="catalog-studio-grid-head catalog-studio-addon-row border-b border-brand-mist bg-slate-50/70 px-6 py-3">
                            <span>Add-on Name</span>
                            <span>Price</span>
                            <span>Quantity</span>
                            <span className="text-right">Action</span>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            {(activeCategory.addons || []).length === 0 ? (
                                <div className="flex h-40 items-center justify-center rounded-brand-sm border border-dashed border-brand-mist text-sm font-semibold text-slate-400">
                                    No add-ons configured for this service.
                                </div>
                            ) : (
                                (activeCategory.addons || []).map(addon => (
                                    <div key={addon.id} className="catalog-studio-grid-row catalog-studio-addon-row border-b border-slate-100 last:border-b-0">
                                        <input
                                            type="text"
                                            value={addon.name}
                                            onChange={e => updateAddon(addon.id, "name", e.target.value)}
                                            className={fieldClass}
                                        />
                                        <div className="relative">
                                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-heading text-xs font-black text-slate-400">$</span>
                                            <input
                                                type="number"
                                                value={addon.price}
                                                onChange={e => updateAddon(addon.id, "price", parseFloat(e.target.value))}
                                                className={`${fieldClass} catalog-studio-field-currency`}
                                            />
                                        </div>
                                        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-brand-sm border border-brand-mist/90 bg-white px-4">
                                            <input
                                                type="checkbox"
                                                checked={addon.qtySelector}
                                                onChange={e => updateAddon(addon.id, "qtySelector", e.target.checked)}
                                                className="h-4 w-4 rounded-brand-sm border-brand-mist accent-brand-action"
                                            />
                                            <span className="font-heading text-[10px] font-bold uppercase text-slate-500">Qty selector</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => deleteAddon(addon.id)}
                                            className={dangerButtonClass}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
