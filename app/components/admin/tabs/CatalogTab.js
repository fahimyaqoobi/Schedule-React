"use client";
import dynamic from "next/dynamic";

const V2SettingsManager = dynamic(() => import("../../V2SettingsManager"), {
    ssr: false,
    loading: () => (
        <div className="mt-8 rounded-brand-lg border border-brand-mist bg-white p-10 text-center shadow-sparkle">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-mist border-t-brand-action"></div>
            <p className="font-heading text-xs font-bold uppercase tracking-wider text-brand-slate">Loading Catalog Studio</p>
        </div>
    ),
});

export default function CatalogTab({ catalog, setCatalog, onSave }) {
    return (
        <div className="animate-fade">
            <V2SettingsManager catalog={catalog} setCatalog={setCatalog} onSave={onSave} />
        </div>
    );
}
