"use client";

export default function PromotionsTab({
    promotionRules,
    setPromotionRules,
    documentCopy,
    updateDocumentCopyField,
    handleSavePromotions,
    promotionSaving,
}) {
    return (
        <div className="animate-fade space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-700">Promotions</p>
                        <h3 className="mt-2 text-3xl font-black text-slate-900">Document, Referral and Discount Control</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                            Manage the wording shown on estimates, bookings, invoices, receipts, and any public promotions shown to customers.
                        </p>
                    </div>
                    <button onClick={handleSavePromotions} className="btn btn-primary btn-sm" disabled={promotionSaving}>
                        {promotionSaving ? "Saving..." : "Save Document Settings"}
                    </button>
                </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Customer Document Copy</p>
                    <h4 className="mt-2 text-2xl font-black text-slate-900">Terms, Notes and Service Notes</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{document}"}</code> inside terms when you want the system to write estimate, booking, invoice, or receipt automatically.
                    </p>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                    <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Service Notes Title</span>
                            <input value={documentCopy.serviceNotesTitle || ""} onChange={e => updateDocumentCopyField("serviceNotesTitle", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Default Service Notes Body</span>
                            <textarea value={documentCopy.serviceNotesBody || ""} onChange={e => updateDocumentCopyField("serviceNotesBody", e.target.value)} className="min-h-[120px] rounded-xl border border-slate-200 px-3 py-2" />
                        </label>
                    </div>
                    <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Notes Title</span>
                            <input value={documentCopy.notesTitle || ""} onChange={e => updateDocumentCopyField("notesTitle", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Notes Body</span>
                            <textarea value={documentCopy.notesBody || ""} onChange={e => updateDocumentCopyField("notesBody", e.target.value)} className="min-h-[120px] rounded-xl border border-slate-200 px-3 py-2" />
                        </label>
                    </div>
                    <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Terms Title</span>
                            <input value={documentCopy.termsTitle || ""} onChange={e => updateDocumentCopyField("termsTitle", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Terms Body</span>
                            <textarea value={documentCopy.termsBody || ""} onChange={e => updateDocumentCopyField("termsBody", e.target.value)} className="min-h-[180px] rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm leading-6" />
                        </label>
                        <p className="text-xs text-slate-500">Each line becomes one bullet in the PDF and document preview.</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4">
                {promotionRules.map((promo, index) => (
                    <div key={promo.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Promo Name</span>
                                    <input value={promo.name} onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="rounded-xl border border-slate-200 px-3 py-2" />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Promo Code</span>
                                    <input value={promo.code} onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, code: e.target.value.toUpperCase().replace(/\s+/g, "") } : item))} className="rounded-xl border border-slate-200 px-3 py-2" />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Type</span>
                                    <select value={promo.type} onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, type: e.target.value } : item))} className="rounded-xl border border-slate-200 px-3 py-2">
                                        <option value="fixed">Fixed Amount</option>
                                        <option value="percent">Percent</option>
                                        <option value="referral">Referral</option>
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Value</span>
                                    <input type="number" value={promo.value} onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, value: Number(e.target.value || 0) } : item))} className="rounded-xl border border-slate-200 px-3 py-2" />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Scope</span>
                                    <select value={promo.scope || "all"} onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, scope: e.target.value, applicableServices: e.target.value === "all" ? [] : (item.applicableServices || []) } : item))} className="rounded-xl border border-slate-200 px-3 py-2">
                                        <option value="all">All Services</option>
                                        <option value="service">Specific Services Only</option>
                                    </select>
                                </label>
                                {promo.scope === "service" && (
                                    <label className="sm:col-span-2 flex flex-col gap-1">
                                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Applicable Services (comma-separated)</span>
                                        <input
                                            value={(promo.applicableServices || []).join(", ")}
                                            onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, applicableServices: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } : item))}
                                            placeholder="e.g. Window Cleaning, Gutter Cleaning"
                                            className="rounded-xl border border-slate-200 px-3 py-2"
                                        />
                                    </label>
                                )}
                                <label className="sm:col-span-2 flex flex-col gap-1">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Description</span>
                                    <textarea value={promo.description || ""} onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} className="min-h-[90px] rounded-xl border border-slate-200 px-3 py-2" />
                                </label>
                            </div>

                            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Rules</div>
                                <div className="grid gap-2 text-sm text-slate-700">
                                    {[
                                        ["active", "Active"],
                                        ["oneTimeOnly", "One time only"],
                                        ["stackable", "Can be used with others"],
                                        ["soloOnly", "Must be used alone"],
                                        ["repeatable", "Repeat use allowed"],
                                        ["referralRequired", "Needs referred customer purchase"],
                                        ["showOnDocuments", "Show on estimates, invoices, and receipts"],
                                    ].map(([field, label]) => (
                                        <label key={field} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(promo[field])}
                                                onChange={e => setPromotionRules(prev => prev.map((item, i) => i === index ? { ...item, [field]: e.target.checked } : item))}
                                            />
                                            <span>{label}</span>
                                        </label>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPromotionRules(prev => prev.filter((_, i) => i !== index))}
                                    className="btn btn-secondary btn-sm mt-4"
                                >
                                    Remove Promotion
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                type="button"
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
                className="btn btn-secondary btn-sm"
            >
                Add Promotion
            </button>
        </div>
    );
}
