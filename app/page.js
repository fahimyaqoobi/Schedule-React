"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
    signOut,
    onAuthStateChanged,
    updateProfile,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    signInWithCustomToken
} from "firebase/auth";
import { auth } from "../lib/firebase";
import {
    DEPARTMENTS,
    ROLE_DEFINITIONS,
    canManageSystem,
    getRoleLabel,
    normalizeRole,
    roleHasDepartment
} from "../lib/permissions";
import {
    BRANCHES,
    DEFAULT_BRANCH_ID,
    findBranchForAddress,
    getBranchById,
    getBranchScopeForUser
} from "../lib/branches";
import {
    buildAvailabilitySnapshot,
    normalizeStaffMember,
    normalizeStaffProfile,
    STAFF_SELF_SERVICE_ROLES
} from "../lib/staffProfiles";
import { calculatePayrollBreakdown } from "../lib/payroll";
import {
    buildBookingDocumentHtml,
    buildDocumentPricingBreakdown,
    getBookingDocumentLabel as getBookingDocumentType,
    getBookingDocumentNumber
} from "../lib/bookingDocuments";
import { DEFAULT_PROMOTIONS, ensurePromotionList, getCustomerEligiblePromotions } from "../lib/promotions";
import { getPersonalReferralCode } from "../lib/customerRewards";
import { DEFAULT_DOCUMENT_COPY, normalizeDocumentCopy } from "../lib/documentCopy";
import { computeBookingPricing } from "../lib/pricing";

import CatalogTab from "./components/admin/tabs/CatalogTab";
import PromotionsTab from "./components/admin/tabs/PromotionsTab";
import SettingsTab from "./components/admin/tabs/SettingsTab";
import DepartmentsTab from "./components/admin/tabs/DepartmentsTab";
import PermissionsTab from "./components/admin/tabs/PermissionsTab";
import EditRequestsTab from "./components/admin/tabs/EditRequestsTab";
import JobsPayrollTab from "./components/admin/tabs/JobsPayrollTab";
import TimeCardsTab from "./components/admin/tabs/TimeCardsTab";
import PayrollTab from "./components/admin/tabs/PayrollTab";
import TeamsTab from "./components/admin/tabs/TeamsTab";
import DashboardTab from "./components/admin/tabs/DashboardTab";
import BookingsTab from "./components/admin/tabs/BookingsTab";
import BookingWizard from "./components/admin/BookingWizard";
import CalendarTab from "./components/admin/tabs/CalendarTab";
import RecurringTab from "./components/admin/tabs/RecurringTab";
import ExpensesTab from "./components/admin/tabs/ExpensesTab";
import CustomersTab from "./components/admin/tabs/CustomersTab";
import MessagesTab from "./components/admin/tabs/MessagesTab";
import CleanerSupportChat from "./components/shared/CleanerSupportChat";
import CustomerProfileModal from "./components/admin/CustomerProfileModal";
import FinanceTab from "./components/admin/tabs/FinanceTab";
import JobChatCard from "./components/shared/JobChatCard";
import { customerKeyForBooking } from "../lib/phone";

const V2SettingsManager = dynamic(() => import("./components/V2SettingsManager"), {
    ssr: false,
    loading: () => (
        <div className="mt-8 rounded-brand-lg border border-brand-mist bg-white p-10 text-center shadow-sparkle">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-mist border-t-brand-action"></div>
            <p className="font-heading text-xs font-bold uppercase tracking-wider text-brand-slate">
                Loading Catalog Studio
            </p>
        </div>
    )
});

// Font Awesome / Lucide style icons rendered via secure standalone inline SVGs for 100% crash-proof safety
const Icons = {
    Dashboard: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>,
    Bookings: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    Calendar: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
    Catalog: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M8 11h8"></path><path d="M8 15h5"></path></svg>,
    Departments: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>,
    Shield: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>,
    Teams: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    EditReview: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>,
    Logout: () => <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
    Search: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
    Plus: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    Phone: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6.09 6.09l1.45-1.28a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"></path></svg>,
    Mail: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"></path><path d="m22 6-10 7L2 6"></path></svg>,
    Contact: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M15 8h2"></path><path d="M15 12h2"></path><path d="M7 16c.8-1.5 2-2.2 3.3-2.2S12.8 14.5 13.6 16"></path></svg>,
    MapPin: () => <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>,
    Trash: () => <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
    Eye: () => <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
    Edit: () => <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>,
    Alert: () => <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
    ChevronLeft: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
    ChevronRight: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
    Clock: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path></svg>,
    Cash: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="3"></circle><path d="M6 9h.01"></path><path d="M18 15h.01"></path></svg>,
    Loading: () => <svg className="animate-spin" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
};

const DEPARTMENT_TAB_TARGETS = {
    operations: "dashboard",
    people: "teams",
    sales: "bookings",
    finance: "payroll",
    administration: "settings"
};

// Default static lists in case DB fetches are temporarily blank
const INITIAL_TEAMS = [
    { id: 'team-sparkle', name: 'Team Sparkle', color: 'sparkle', lead: 'Emma Vance', size: 3, members: 'Emma Vance, Alice Smith, John Doe', description: 'Deep Cleaning & Sanitization experts' },
    { id: 'team-deluxe', name: 'Team Deluxe', color: 'deluxe', lead: 'Robert Miller', size: 3, members: 'Robert Miller, Clara Oswald, Arthur Dent', description: 'Standard Residential & Sparkle cleans' },
    { id: 'team-ecoclean', name: 'Team EcoClean', color: 'ecoclean', lead: 'Sarah Green', size: 2, members: 'Sarah Green, Lily Evans', description: 'Green, pet-friendly biodegradable cleaning' }
];

function getInitials(value = "") {
    return (value || "FS").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "FS";
}

function updateAvailabilityDayShift(weekdays = [], dayIndex, shiftKey, enabled) {
    return weekdays.map((day, index) => {
        if (index !== dayIndex) return day;
        const nextShifts = {
            ...(day.shifts || {}),
            [shiftKey]: enabled
        };
        return {
            ...day,
            enabled: nextShifts.morning || nextShifts.afternoon || nextShifts.evening,
            shifts: nextShifts
        };
    });
}

function buildDocumentMeta(file, url) {
    return {
        name: file?.name || "document",
        url,
        uploadedAt: new Date().toISOString()
    };
}

function normalizeBlockedDateList(values = []) {
    return Array.from(new Set((values || []).map(value => String(value || "").trim()).filter(Boolean))).sort();
}

function formatDurationMinutes(totalMinutes = 0) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

// Convert a datetime-local string (local time, no TZ) to UTC ISO for API storage.
// The browser treats bare "YYYY-MM-DDTHH:MM" as local time, so new Date() gives the right UTC offset.
function localDtToIso(s) {
    if (!s) return s;
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString();
}

function formatRuntime(startedAt, now) {
    if (!startedAt) return "00:00:00";
    const diffSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    const hours = String(Math.floor(diffSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(diffSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
}

function getWeekRangeLabel(now = new Date()) {
    const current = new Date(now);
    const day = current.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(current);
    monday.setDate(current.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function getCurrentTorontoDateKey(now = new Date()) {
    return now.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

function getCleanerPayPeriodSummary(now = new Date()) {
    const anchorCutoff = new Date("2026-06-14T23:59:59-04:00");
    const periodDays = 14;
    const payDelayDays = 5;
    const msPerDay = 24 * 60 * 60 * 1000;
    let cutoff = new Date(anchorCutoff);

    while (cutoff.getTime() < now.getTime()) {
        cutoff = new Date(cutoff.getTime() + (periodDays * msPerDay));
    }

    const periodStart = new Date(cutoff.getTime() - ((periodDays - 1) * msPerDay));
    periodStart.setHours(0, 0, 0, 0);
    const payDate = new Date(cutoff.getTime() + (payDelayDays * msPerDay));
    payDate.setHours(0, 0, 0, 0);

    return {
        periodStart,
        cutoffDate: cutoff,
        payDate,
        label: `${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${cutoff.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        cutoffLabel: cutoff.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        payDateLabel: payDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    };
}

function getBookingDocumentLabel(status = "Pending") {
    return getBookingDocumentType({ status });
}

const SHIFTS = [
    { id: "morning",   label: "Morning",   icon: "🌅", hours: "7:00 AM – 12:00 PM", startTime: "07:00 AM" },
    { id: "afternoon", label: "Afternoon", icon: "☀️", hours: "12:00 PM – 6:00 PM",  startTime: "12:00 PM" },
    { id: "evening",   label: "Evening",   icon: "🌆", hours: "6:00 PM – 8:00 PM",   startTime: "06:00 PM" },
];

function shiftStartTime(shifts = []) {
    for (const s of SHIFTS) {
        if (shifts.includes(s.id)) return s.startTime;
    }
    return "07:00 AM";
}

function timeToShift(timeStr = "") {
    const parts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!parts) return null;
    let h = parseInt(parts[1]);
    const ampm = parts[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const min = h * 60 + parseInt(parts[2]);
    if (min >= 420  && min < 720)  return "morning";
    if (min >= 720  && min < 1080) return "afternoon";
    if (min >= 1080 && min < 1200) return "evening";
    return null;
}

// ── Recurring bookings ──
// Generate the follow-up occurrence dates (YYYY-MM-DD) for a recurring series,
// covering the next `months` months after startDateStr (start date excluded).
const RECURRING_FREQUENCIES = ["Weekly", "Bi-Weekly", "Monthly"];

function addMonthsClamped(date, n) {
    const d = new Date(date);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
}

function toLocalDateStr(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function generateRecurringDates(startDateStr, frequency, months = 3) {
    if (!startDateStr) return [];
    const start = new Date(`${startDateStr}T00:00:00`);
    if (Number.isNaN(start.getTime())) return [];
    const end = addMonthsClamped(start, months);
    const dates = [];
    if (frequency === "Monthly") {
        for (let i = 1; ; i++) {
            const d = addMonthsClamped(start, i);
            if (d > end) break;
            dates.push(toLocalDateStr(d));
        }
    } else {
        const step = frequency === "Bi-Weekly" ? 14 : 7;
        const d = new Date(start);
        for (;;) {
            d.setDate(d.getDate() + step);
            if (d > end) break;
            dates.push(toLocalDateStr(d));
        }
    }
    return dates;
}

function validateAdminCheckoutStep(step, form = {}) {
    if (step === 0) {
        return Boolean(
            form.firstName?.trim() &&
            form.lastName?.trim() &&
            form.phone?.trim() &&
            form.email?.trim() &&
            form.address1?.trim() &&
            form.city?.trim() &&
            form.postalCode?.trim()
        );
    }

    if (step === 1) {
        return Boolean(form.date && form.shifts?.length > 0 && form.bookingStatus && form.paymentStatus);
    }

    return true;
}

function getBookingLocationLabel(booking = {}) {
    return [booking.address1, booking.city].filter(Boolean).join(", ");
}

function getBookingCustomerFirstName(booking = {}) {
    return booking.firstName || String(booking.clientName || "Client").split(" ")[0] || "Client";
}

function getGoogleMapsDirectionsUrl(booking = {}) {
    const destination = [
        booking.address1,
        booking.address2,
        booking.city,
        booking.state,
        booking.postalCode,
        booking.country
    ].filter(Boolean).join(", ");

    if (!destination) return "https://www.google.com/maps";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

function buildCleanerTaskList(booking = {}, pricingRates = {}, v2Catalog = {}) {
    const serviceCategory = (v2Catalog.categories || []).find(cat =>
        cat.name === booking.service || cat.id === booking.serviceId
    );

    // Prefer service-type task list (new bookings); fall back to category tasks (old bookings)
    let baseTasks;
    if (booking.serviceTypeId && serviceCategory?.serviceTypes?.length > 0) {
        const svcType = serviceCategory.serviceTypes.find(st => st.id === booking.serviceTypeId);
        baseTasks = (svcType?.tasks || serviceCategory.tasks || []).map(t => ({
            id: t.id, label: t.label, requiresPhoto: !!t.requiresPhoto, completed: false
        }));
    } else if (serviceCategory?.tasks?.length > 0) {
        baseTasks = serviceCategory.tasks.map(t => ({
            id: t.id, label: t.label, requiresPhoto: !!t.requiresPhoto, completed: false
        }));
    } else {
        baseTasks = [
            { id: "main-service", label: booking.service || "Assigned service", requiresPhoto: true, completed: false },
            ...(booking.bathrooms ? [{ id: "bathrooms", label: booking.bathrooms, requiresPhoto: false, completed: false }] : [])
        ];
    }

    // Inject tasks from catalog addons that have their own task list
    (booking.addons || []).forEach(addon => {
        const qty = Number(addon.qty || 0);
        if (!qty) return;
        const catalogAddon = (serviceCategory?.addons || []).find(a => a.id === addon.id);
        if (catalogAddon?.tasks?.length > 0) {
            catalogAddon.tasks.forEach(t => {
                const label = qty > 1 ? `${t.label} (×${qty})` : t.label;
                baseTasks.push({ id: `adn-${addon.id}-${t.id}`, label, requiresPhoto: !!t.requiresPhoto, completed: false });
            });
        } else {
            // Fall back to old extras style
            const label = qty > 1 ? `${addon.name} ×${qty}` : addon.name;
            baseTasks.push({ id: `adn-${addon.id}`, label, requiresPhoto: false, completed: false });
        }
    });

    // Legacy extras (old bookings that use booking.extras instead of booking.addons)
    if (!booking.addons) {
        Object.entries(booking.extras || {}).forEach(([key, qty]) => {
            if (!qty) return;
            const extra = pricingRates.extras?.[key];
            if (!extra) return;
            const qtyVal = typeof qty === "boolean" ? 1 : Number(qty || 0);
            baseTasks.push({
                id: `extra-${key}`,
                label: qtyVal > 1 ? `${extra.name} x${qtyVal}` : extra.name,
                requiresPhoto: false,
                completed: false
            });
        });
    }

    return baseTasks;
}

function parseGooglePlaceDetails(place) {
    const components = place?.address_components || [];
    const getComponent = (type, useShort = false) => {
        const match = components.find(component => component.types?.includes(type));
        return match ? (useShort ? match.short_name : match.long_name) : "";
    };

    const streetNumber = getComponent("street_number");
    const route = getComponent("route");
    const city = getComponent("locality") || getComponent("postal_town") || getComponent("administrative_area_level_2");
    const province = getComponent("administrative_area_level_1", true) || "ON";
    const postalCode = getComponent("postal_code");
    const country = getComponent("country") || "Canada";
    const address1 = [streetNumber, route].filter(Boolean).join(" ").trim() || place?.formatted_address?.split(",")[0] || "";

    return {
        address1,
        city,
        state: province,
        postalCode,
        country,
        location: place?.geometry?.location ? {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
        } : null,
        formattedAddress: place?.formatted_address || address1
    };
}

const DEFAULT_PRICES = {
    services: {
        // House Cleaning — size-based tiers
        'Studio or 1 Bedroom': 87.50,
        '2 bedroom apartment': 101.50,
        '3 bedroom apartment or townhouse': 115.50,
        '3 or 4 bedroom house (or between 1700 to 1999 sqft)': 143.50,
        'between 2000 to 2499 sq ft': 150.50,
        'between 2500 to 2999 sq ft': 175.00,
        'between 3000 to 3499 sq ft': 208.60,
        'between 3500 to 3999 sq ft': 243.60,
        // Standalone specialty services
        'Window Cleaning': 150.00,
        'Gutter Cleaning': 100.00,
        'Power Washing': 200.00,
    },
    serviceDurations: {
        'Studio or 1 Bedroom': 2,
        '2 bedroom apartment': 2.5,
        '3 bedroom apartment or townhouse': 3,
        '3 or 4 bedroom house (or between 1700 to 1999 sqft)': 3.5,
        'between 2000 to 2499 sq ft': 4,
        'between 2500 to 2999 sq ft': 4.5,
        'between 3000 to 3499 sq ft': 5,
        'between 3500 to 3999 sq ft': 5.5,
        'Window Cleaning': 2,
        'Gutter Cleaning': 1.5,
        'Power Washing': 2.5,
    },
    bathrooms: {
        '1 Bathroom': 14.00,
        '2 Bathroom': 28.00,
        '3 Bathroom': 42.00,
        '4 Bathroom': 56.00,
        '5 Bathroom': 70.00,
        '6 Bathroom': 84.00,
        '7 Bathroom': 98.00
    },
    extras: {
        'downtownParking': { name: 'Downtown Street Parking Fee', price: 14.00, qtySelector: false },
        'firstTimeClean': { name: 'First Time Clean Upgrade', price: 87.50, qtySelector: false },
        'moveInOut': { name: 'Move In/Out Upgrade', price: 87.50, qtySelector: false },
        'havePets': { name: 'I Have Pets Premium', price: 17.50, qtySelector: false },
        'insideOven': { name: 'Inside the Oven', price: 31.50, qtySelector: true },
        'insideEmptyFridge': { name: 'Inside an Empty Fridge', price: 17.50, qtySelector: true },
        'insideFullFridge': { name: 'Inside a Full Fridge', price: 31.50, qtySelector: true },
        'secondKitchen': { name: 'Second Kitchen', price: 35.00, qtySelector: false },
        'walls': { name: 'Walls ($14 per room)', price: 14.00, qtySelector: true },
        'shedPoolHouse': { name: 'Shed/Pool House', price: 52.50, qtySelector: false },
        'insideCabinets': { name: 'Inside Cabinets (emptied)', price: 35.00, qtySelector: false },
        'interiorWindows': { name: 'Interior Windows ($7 per window)', price: 7.00, qtySelector: true },
        'slidingDoorWindow': { name: 'Sliding Door Interior Window', price: 14.00, qtySelector: true },
        'garageSweep': { name: 'Garage Sweep', price: 21.00, qtySelector: false },
        'balconySweep': { name: 'Balcony Sweep', price: 14.00, qtySelector: true },
        'homeConcierge': { name: 'Home Concierge ($35/hr, min 2 hrs)', price: 35.00, qtySelector: true, minQty: 2 },
        'organization': { name: 'Organization ($56/hr, min 3 hrs)', price: 56.00, qtySelector: true, minQty: 3 },
        'laundryWashFold': { name: 'Laundry - Wash & Fold (per load)', price: 17.50, qtySelector: true },
        'nextDayBooking': { name: 'Next Day Booking Fee', price: 52.50, qtySelector: false },
        'sameDayCancellation': { name: 'Same Day Cancellation Fee', price: 55.30, qtySelector: false }
    },
    frequencies: {
        'One-Time': { name: 'one time service', discount: 0 },
        'Weekly': { name: 'Weekly 20% off', discount: 0.20 },
        'Bi-Weekly': { name: 'Bi-Weekly 15% off', discount: 0.15 },
        'Tri-Weekly': { name: 'Tri weekly 12% off', discount: 0.12 },
        'Monthly': { name: 'Monthly 10% off', discount: 0.10 }
    }
};

// --- V1.02 DYNAMIC SERVICE CATALOG SCHEMA ---
// Universal model: serviceTypes + sizes on all services; property/bedroom/bathroom only for house cleaning.
const INITIAL_V2_CATALOG = {
    categories: [
        {
            id: 'house_cleaning',
            name: 'House Cleaning (Interior)',
            pricingModel: 'size_based',
            baseRate: 0,
            sizeLabel: 'Property & Bedrooms',
            hasPropertyType: true,
            hasBedrooms: true,
            hasBathrooms: true,
            serviceTypes: [
                {
                    id: 'standard', name: 'Standard Clean', multiplier: 1.0,
                    tasks: [
                        { id: 'st_t1', label: 'Walk-through — check access & note special instructions', requiresPhoto: true },
                        { id: 'st_t2', label: 'Dust all surfaces, furniture & baseboards', requiresPhoto: false },
                        { id: 'st_t3', label: 'Vacuum all carpets, rugs & upholstered furniture', requiresPhoto: false },
                        { id: 'st_t4', label: 'Mop all hard floors', requiresPhoto: false },
                        { id: 'st_t5', label: 'Clean kitchen — counters, stovetop, sink & faucet', requiresPhoto: false },
                        { id: 'st_t6', label: 'Clean all bathroom(s) — toilet, sink, shower/tub & mirror', requiresPhoto: false },
                        { id: 'st_t7', label: 'Empty & reline all trash bins', requiresPhoto: false },
                        { id: 'st_t8', label: 'Final walk-through & review', requiresPhoto: true },
                    ]
                },
                {
                    id: 'deep', name: 'Deep Clean', multiplier: 1.35,
                    tasks: [
                        { id: 'dc_t1', label: 'Walk-through — document condition & photograph all rooms', requiresPhoto: true },
                        { id: 'dc_t2', label: 'Dust & wipe all surfaces, furniture, baseboards & blinds', requiresPhoto: false },
                        { id: 'dc_t3', label: 'Scrub tile grout, shower tracks & bathtub edges', requiresPhoto: false },
                        { id: 'dc_t4', label: 'Vacuum all carpets, rugs, upholstered furniture & under cushions', requiresPhoto: false },
                        { id: 'dc_t5', label: 'Mop all hard floors including edges & corners', requiresPhoto: false },
                        { id: 'dc_t6', label: 'Clean inside all kitchen cabinets & drawers', requiresPhoto: false },
                        { id: 'dc_t7', label: 'Clean kitchen — counters, backsplash, stovetop, sink & faucet', requiresPhoto: false },
                        { id: 'dc_t8', label: 'Deep scrub all bathroom(s) — toilet, sink, shower/tub & mirror', requiresPhoto: false },
                        { id: 'dc_t9', label: 'Wipe all light switches, outlet covers & door handles', requiresPhoto: false },
                        { id: 'dc_t10', label: 'Empty & reline all trash bins', requiresPhoto: false },
                        { id: 'dc_t11', label: 'Final walk-through & review', requiresPhoto: true },
                    ]
                },
                {
                    id: 'move_in_out', name: 'Move In / Move Out', multiplier: 1.50,
                    tasks: [
                        { id: 'mo_t1', label: 'Walk-through — photograph all rooms & document condition', requiresPhoto: true },
                        { id: 'mo_t2', label: 'Wipe all walls, baseboards & light switches', requiresPhoto: false },
                        { id: 'mo_t3', label: 'Clean inside all cabinets, drawers & closet shelves', requiresPhoto: false },
                        { id: 'mo_t4', label: 'Deep clean oven, stovetop, range hood & microwave interior', requiresPhoto: false },
                        { id: 'mo_t5', label: 'Clean inside refrigerator & freezer', requiresPhoto: false },
                        { id: 'mo_t6', label: 'Scrub all bathrooms — toilet, sink, tub/shower, tiles & mirror', requiresPhoto: false },
                        { id: 'mo_t7', label: 'Vacuum & mop all floors including closets', requiresPhoto: false },
                        { id: 'mo_t8', label: 'Wipe all window sills, blinds & interior window frames', requiresPhoto: false },
                        { id: 'mo_t9', label: 'Empty & reline all trash bins', requiresPhoto: false },
                        { id: 'mo_t10', label: 'Final walk-through — photograph all rooms', requiresPhoto: true },
                    ]
                }
            ],
            propertyTypes: [
                { id: 'apartment', name: 'Apartment',    sizeIds: ['hc_studio', 'hc_apt_1b', 'hc_apt_2b', 'hc_apt_3b'] },
                { id: 'townhouse', name: 'Townhouse',    sizeIds: ['hc_th_2b', 'hc_th_3b', 'hc_th_4b'] },
                { id: 'house',     name: 'Single House', sizeIds: ['hc_h_3b', 'hc_h_4b', 'hc_h_5b', 'hc_h_2000', 'hc_h_2500', 'hc_h_3000', 'hc_h_3500'] },
            ],
            sizes: [
                { id: 'hc_studio',  name: 'Studio',                     propertyTypeId: 'apartment', price: 80.00,  durationHrs: 1.5 },
                { id: 'hc_apt_1b',  name: '1 Bedroom',                  propertyTypeId: 'apartment', price: 87.50,  durationHrs: 2 },
                { id: 'hc_apt_2b',  name: '2 Bedrooms',                 propertyTypeId: 'apartment', price: 101.50, durationHrs: 2.5 },
                { id: 'hc_apt_3b',  name: '3 Bedrooms',                 propertyTypeId: 'apartment', price: 115.50, durationHrs: 3 },
                { id: 'hc_th_2b',   name: '2 Bedrooms',                 propertyTypeId: 'townhouse', price: 115.50, durationHrs: 3 },
                { id: 'hc_th_3b',   name: '3 Bedrooms',                 propertyTypeId: 'townhouse', price: 130.00, durationHrs: 3.5 },
                { id: 'hc_th_4b',   name: '4 Bedrooms',                 propertyTypeId: 'townhouse', price: 143.50, durationHrs: 3.5 },
                { id: 'hc_h_3b',    name: '3 Bedrooms',                 propertyTypeId: 'house',     price: 143.50, durationHrs: 3.5 },
                { id: 'hc_h_4b',    name: '4 Bedrooms',                 propertyTypeId: 'house',     price: 157.50, durationHrs: 4 },
                { id: 'hc_h_5b',    name: '5 Bedrooms',                 propertyTypeId: 'house',     price: 175.00, durationHrs: 4.5 },
                { id: 'hc_h_2000',  name: '5+ Bed / 2000–2499 sqft',   propertyTypeId: 'house',     price: 208.60, durationHrs: 5 },
                { id: 'hc_h_2500',  name: '5+ Bed / 2500–2999 sqft',   propertyTypeId: 'house',     price: 243.60, durationHrs: 5.5 },
                { id: 'hc_h_3000',  name: '5+ Bed / 3000–3499 sqft',   propertyTypeId: 'house',     price: 280.00, durationHrs: 6 },
                { id: 'hc_h_3500',  name: '5+ Bed / 3500+ sqft',       propertyTypeId: 'house',     price: 315.00, durationHrs: 6.5 },
            ],
            tasks: [
                { id: 'hc_t1', label: 'Walk-through — check access & note special instructions', requiresPhoto: true },
                { id: 'hc_t2', label: 'Dust all surfaces, furniture & baseboards', requiresPhoto: false },
                { id: 'hc_t3', label: 'Vacuum all carpets, rugs & upholstered furniture', requiresPhoto: false },
                { id: 'hc_t4', label: 'Mop all hard floors', requiresPhoto: false },
                { id: 'hc_t5', label: 'Clean kitchen — counters, stovetop, sink & faucet', requiresPhoto: false },
                { id: 'hc_t6', label: 'Clean all bathroom(s) — toilet, sink, shower/tub & mirror', requiresPhoto: false },
                { id: 'hc_t7', label: 'Empty & reline all trash bins', requiresPhoto: false },
                { id: 'hc_t8', label: 'Final walk-through & review', requiresPhoto: true },
            ],
            addons: [
                { id: 'firstTimeClean',    name: 'First Time Clean Upgrade',             price: 87.50, qtySelector: false },
                { id: 'moveInOut',         name: 'Move In/Out Upgrade',                 price: 87.50, qtySelector: false },
                { id: 'havePets',          name: 'I Have Pets Premium',                 price: 17.50, qtySelector: false },
                { id: 'insideOven',        name: 'Inside the Oven',                     price: 31.50, qtySelector: true,  tasks: [
                    { id: 'adn_oven_1', label: 'Degrease & scrub oven interior, walls & floor', requiresPhoto: false },
                    { id: 'adn_oven_2', label: 'Clean oven racks, door seal & glass panel',     requiresPhoto: false },
                ]},
                { id: 'insideEmptyFridge', name: 'Inside an Empty Fridge',              price: 17.50, qtySelector: true,  tasks: [
                    { id: 'adn_fridge_e1', label: 'Wipe & sanitize all fridge shelves, drawers & door seals', requiresPhoto: false },
                ]},
                { id: 'insideFullFridge',  name: 'Inside a Full Fridge',                price: 31.50, qtySelector: true,  tasks: [
                    { id: 'adn_fridge_f1', label: 'Remove all items & wipe all shelves, drawers & walls', requiresPhoto: false },
                    { id: 'adn_fridge_f2', label: 'Clean door seals, return items & wipe exterior',       requiresPhoto: false },
                ]},
                { id: 'secondKitchen',     name: 'Second Kitchen',                      price: 35.00, qtySelector: false, tasks: [
                    { id: 'adn_k2_1', label: 'Clean second kitchen — counters, stovetop, sink & faucet', requiresPhoto: false },
                ]},
                { id: 'walls',             name: 'Walls ($14 per room)',                price: 14.00, qtySelector: true  },
                { id: 'shedPoolHouse',     name: 'Shed/Pool House',                    price: 52.50, qtySelector: false },
                { id: 'insideCabinets',    name: 'Inside Cabinets (emptied)',           price: 35.00, qtySelector: false, tasks: [
                    { id: 'adn_cab_1', label: 'Wipe inside all emptied cabinets & drawers', requiresPhoto: false },
                ]},
                { id: 'interiorWindows',   name: 'Interior Windows ($7 per window)',   price: 7.00,  qtySelector: true  },
                { id: 'slidingDoorWindow', name: 'Sliding Door Interior Window',       price: 14.00, qtySelector: true  },
                { id: 'garageSweep',       name: 'Garage Sweep',                       price: 21.00, qtySelector: false },
                { id: 'balconySweep',      name: 'Balcony Sweep',                      price: 14.00, qtySelector: true  },
                { id: 'homeConcierge',     name: 'Home Concierge ($35/hr, min 2 hrs)', price: 35.00, qtySelector: true,  minQty: 2 },
                { id: 'organization',      name: 'Organization ($56/hr, min 3 hrs)',   price: 56.00, qtySelector: true,  minQty: 3 },
                { id: 'laundryWashFold',   name: 'Laundry - Wash & Fold (per load)',   price: 17.50, qtySelector: true  }
            ]
        },
        {
            id: 'window_washing',
            name: 'Window Washing (Exterior)',
            pricingModel: 'size_based',
            baseRate: 0,
            sizeLabel: 'Number of Panels',
            hasPropertyType: false,
            hasBedrooms: false,
            hasBathrooms: false,
            serviceTypes: [
                {
                    id: 'standard', name: 'Standard Wash', multiplier: 1.0,
                    tasks: [
                        { id: 'ww_t1', label: 'Inspect windows — note damage or difficult areas',       requiresPhoto: true  },
                        { id: 'ww_t2', label: 'Remove & set aside screens',                             requiresPhoto: false },
                        { id: 'ww_t3', label: 'Clean all exterior panes — scrub & squeegee',            requiresPhoto: false },
                        { id: 'ww_t4', label: 'Wipe all window frames & sills',                         requiresPhoto: false },
                        { id: 'ww_t5', label: 'Reattach screens',                                       requiresPhoto: false },
                        { id: 'ww_t6', label: 'Final streak inspection from ground',                    requiresPhoto: true  },
                    ]
                },
                {
                    id: 'premium', name: 'Premium (frames + screens)', multiplier: 1.25,
                    tasks: [
                        { id: 'ww_p_t1', label: 'Inspect windows, frames & screens — note any damage', requiresPhoto: true  },
                        { id: 'ww_p_t2', label: 'Remove all screens — wash, rinse & dry',              requiresPhoto: false },
                        { id: 'ww_p_t3', label: 'Clean all exterior panes — scrub & squeegee',         requiresPhoto: false },
                        { id: 'ww_p_t4', label: 'Scrub & wipe all window frames & sills inside & out', requiresPhoto: false },
                        { id: 'ww_p_t5', label: 'Reattach all screens',                                requiresPhoto: false },
                        { id: 'ww_p_t6', label: 'Final streak & frame inspection',                     requiresPhoto: true  },
                    ]
                },
            ],
            sizes: [
                { id: 'ww_10',  name: 'Up to 10 panels', price: 120.00, durationHrs: 1.5 },
                { id: 'ww_20',  name: '11–20 panels',    price: 170.00, durationHrs: 2   },
                { id: 'ww_30',  name: '21–30 panels',    price: 220.00, durationHrs: 2.5 },
                { id: 'ww_40',  name: '31–40 panels',    price: 270.00, durationHrs: 3   },
                { id: 'ww_50p', name: '41+ panels',      price: 320.00, durationHrs: 3.5 },
            ],
            tasks: [
                { id: 'ww_t1', label: 'Inspect windows — note damage or difficult areas', requiresPhoto: true  },
                { id: 'ww_t2', label: 'Remove & set aside screens',                       requiresPhoto: false },
                { id: 'ww_t3', label: 'Clean all exterior panes — scrub & squeegee',      requiresPhoto: false },
                { id: 'ww_t4', label: 'Wipe all window frames & sills',                   requiresPhoto: false },
                { id: 'ww_t5', label: 'Reattach screens',                                 requiresPhoto: false },
                { id: 'ww_t6', label: 'Final streak inspection from ground',              requiresPhoto: true  },
            ],
            addons: [
                { id: 'screenCleaning',  name: 'Screen Cleaning',           price: 20.00, qtySelector: false },
                { id: 'hardWaterStain',  name: 'Hard Water Stain Removal',  price: 35.00, qtySelector: false }
            ]
        },
        {
            id: 'pressure_washing_siding',
            name: 'Pressure Washing (Siding)',
            pricingModel: 'size_based',
            baseRate: 0,
            sizeLabel: 'Siding Area (sq ft)',
            hasPropertyType: false,
            hasBedrooms: false,
            hasBathrooms: false,
            serviceTypes: [
                {
                    id: 'standard', name: 'Standard Wash', multiplier: 1.0,
                    tasks: [
                        { id: 'pws_t1', label: 'Protect plants, electrical outlets & nearby surfaces', requiresPhoto: true  },
                        { id: 'pws_t2', label: 'Pre-rinse entire siding with water',                   requiresPhoto: false },
                        { id: 'pws_t3', label: 'Apply cleaning solution to all siding surfaces',       requiresPhoto: false },
                        { id: 'pws_t4', label: 'Pressure wash all siding sections top to bottom',      requiresPhoto: false },
                        { id: 'pws_t5', label: 'Rinse clean & inspect for remaining stains',           requiresPhoto: true  },
                    ]
                },
                {
                    id: 'premium', name: 'Premium (chemical treatment)', multiplier: 1.30,
                    tasks: [
                        { id: 'pws_p_t1', label: 'Protect plants, electrical outlets & nearby surfaces',    requiresPhoto: true  },
                        { id: 'pws_p_t2', label: 'Pre-rinse entire siding with water',                      requiresPhoto: false },
                        { id: 'pws_p_t3', label: 'Apply premium chemical solution — let dwell 10 min',      requiresPhoto: false },
                        { id: 'pws_p_t4', label: 'Soft wash or pressure wash all sections top to bottom',   requiresPhoto: false },
                        { id: 'pws_p_t5', label: 'Apply mildewcide treatment to problem areas',             requiresPhoto: false },
                        { id: 'pws_p_t6', label: 'Final rinse & full siding inspection',                    requiresPhoto: true  },
                    ]
                }
            ],
            sizes: [
                { id: 'pws_1000',  name: 'Under 1,000 sqft',  price: 200.00, durationHrs: 2.5 },
                { id: 'pws_1500',  name: '1,000–1,500 sqft',  price: 260.00, durationHrs: 3   },
                { id: 'pws_2000',  name: '1,500–2,000 sqft',  price: 320.00, durationHrs: 3.5 },
                { id: 'pws_2500',  name: '2,000–2,500 sqft',  price: 380.00, durationHrs: 4   },
                { id: 'pws_3000p', name: '2,500+ sqft',       price: 450.00, durationHrs: 5   },
            ],
            tasks: [
                { id: 'pws_t1', label: 'Protect plants, electrical outlets & nearby surfaces', requiresPhoto: true  },
                { id: 'pws_t2', label: 'Pre-rinse entire siding with water',                   requiresPhoto: false },
                { id: 'pws_t3', label: 'Apply cleaning solution to all siding surfaces',       requiresPhoto: false },
                { id: 'pws_t4', label: 'Pressure wash all siding sections top to bottom',      requiresPhoto: false },
                { id: 'pws_t5', label: 'Rinse clean & inspect for remaining stains',           requiresPhoto: true  },
            ],
            addons: []
        },
        {
            id: 'pressure_washing_deck',
            name: 'Pressure Washing (Deck, Sidewalk, Concrete)',
            pricingModel: 'size_based',
            baseRate: 0,
            sizeLabel: 'Surface Area',
            hasPropertyType: false,
            hasBedrooms: false,
            hasBathrooms: false,
            serviceTypes: [
                {
                    id: 'standard', name: 'Standard Wash', multiplier: 1.0,
                    tasks: [
                        { id: 'pwd_t1', label: 'Clear furniture & obstacles from the area',    requiresPhoto: true  },
                        { id: 'pwd_t2', label: 'Apply pre-treatment cleaning solution',         requiresPhoto: false },
                        { id: 'pwd_t3', label: 'Pressure wash surface in sections',             requiresPhoto: false },
                        { id: 'pwd_t4', label: 'Rinse clean & check for stubborn stains',       requiresPhoto: false },
                        { id: 'pwd_t5', label: 'Return furniture & tidy area',                  requiresPhoto: true  },
                    ]
                },
                {
                    id: 'premium', name: 'Premium (stain treatment)', multiplier: 1.30,
                    tasks: [
                        { id: 'pwd_p_t1', label: 'Clear furniture & obstacles, photograph condition', requiresPhoto: true  },
                        { id: 'pwd_p_t2', label: 'Apply heavy-duty degreaser to stained areas',       requiresPhoto: false },
                        { id: 'pwd_p_t3', label: 'Let treatment dwell — scrub stubborn spots',        requiresPhoto: false },
                        { id: 'pwd_p_t4', label: 'Pressure wash entire surface in sections',          requiresPhoto: false },
                        { id: 'pwd_p_t5', label: 'Return furniture & final inspection',               requiresPhoto: true  },
                    ]
                }
            ],
            sizes: [
                { id: 'pwd_small',  name: 'Small (under 200 sqft)',    price: 150.00, durationHrs: 2   },
                { id: 'pwd_med',    name: 'Medium (200–500 sqft)',     price: 220.00, durationHrs: 2.5 },
                { id: 'pwd_large',  name: 'Large (500–1000 sqft)',     price: 300.00, durationHrs: 3.5 },
                { id: 'pwd_xlarge', name: 'Extra Large (1000+ sqft)', price: 400.00, durationHrs: 4.5 },
            ],
            tasks: [
                { id: 'pwd_t1', label: 'Clear furniture & obstacles from the area', requiresPhoto: true  },
                { id: 'pwd_t2', label: 'Apply pre-treatment cleaning solution',      requiresPhoto: false },
                { id: 'pwd_t3', label: 'Pressure wash surface in sections',          requiresPhoto: false },
                { id: 'pwd_t4', label: 'Rinse clean & check for stubborn stains',    requiresPhoto: false },
                { id: 'pwd_t5', label: 'Return furniture & tidy area',               requiresPhoto: true  },
            ],
            addons: []
        },
        {
            id: 'gutter_cleaning',
            name: 'Gutter & Downspout Cleaning',
            pricingModel: 'size_based',
            baseRate: 0,
            sizeLabel: 'Home Stories',
            hasPropertyType: false,
            hasBedrooms: false,
            hasBathrooms: false,
            serviceTypes: [
                {
                    id: 'standard', name: 'Standard Clean', multiplier: 1.0,
                    tasks: [
                        { id: 'gc_t1', label: 'Set up ladder safely & inspect gutters from ground', requiresPhoto: true  },
                        { id: 'gc_t2', label: 'Clear all debris from gutters section by section',   requiresPhoto: false },
                        { id: 'gc_t3', label: 'Flush gutters with water to confirm flow',           requiresPhoto: false },
                        { id: 'gc_t4', label: 'Clear all downspout blockages',                      requiresPhoto: false },
                        { id: 'gc_t5', label: 'Bag & remove all debris from ground',                requiresPhoto: true  },
                    ]
                },
                {
                    id: 'full_flush', name: 'Full Flush (downspout pressure)', multiplier: 1.25,
                    tasks: [
                        { id: 'gc_f_t1', label: 'Set up ladder safely & photograph gutter condition',    requiresPhoto: true  },
                        { id: 'gc_f_t2', label: 'Clear all debris from gutters section by section',      requiresPhoto: false },
                        { id: 'gc_f_t3', label: 'Flush gutters with water to confirm flow',              requiresPhoto: false },
                        { id: 'gc_f_t4', label: 'Pressure-flush all downspouts to clear blockages',      requiresPhoto: false },
                        { id: 'gc_f_t5', label: 'Check all joints, hangers & end caps for leaks',        requiresPhoto: false },
                        { id: 'gc_f_t6', label: 'Bag & remove all debris, photograph final result',      requiresPhoto: true  },
                    ]
                }
            ],
            sizes: [
                { id: 'gc_1story', name: '1-Story Home', price: 150.00, durationHrs: 1.5 },
                { id: 'gc_2story', name: '2-Story Home', price: 250.00, durationHrs: 2.5 }
            ],
            tasks: [
                { id: 'gc_t1', label: 'Set up ladder safely & inspect gutters from ground', requiresPhoto: true  },
                { id: 'gc_t2', label: 'Clear all debris from gutters section by section',   requiresPhoto: false },
                { id: 'gc_t3', label: 'Flush gutters with water to confirm flow',           requiresPhoto: false },
                { id: 'gc_t4', label: 'Clear all downspout blockages',                      requiresPhoto: false },
                { id: 'gc_t5', label: 'Bag & remove all debris from ground',                requiresPhoto: true  },
            ],
            addons: [
                { id: 'downspoutFlush', name: 'Downspout Flushing', price: 50.00, qtySelector: false }
            ]
        },
        {
            id: 'lawn_mowing',
            name: 'Lawn Mower Mowing',
            pricingModel: 'size_based',
            baseRate: 0,
            sizeLabel: 'Yard Size',
            hasPropertyType: false,
            hasBedrooms: false,
            hasBathrooms: false,
            serviceTypes: [
                {
                    id: 'standard', name: 'Mow Only', multiplier: 1.0,
                    tasks: [
                        { id: 'lm_t1', label: 'Walk the yard — remove obstacles & check for hazards', requiresPhoto: true  },
                        { id: 'lm_t2', label: 'Mow grass to required height',                          requiresPhoto: false },
                        { id: 'lm_t3', label: 'Edge-trim borders, walkways & obstacles',               requiresPhoto: false },
                        { id: 'lm_t4', label: 'Blow or rake clippings from paths & driveway',          requiresPhoto: false },
                        { id: 'lm_t5', label: 'Final walkthrough inspection',                          requiresPhoto: true  },
                    ]
                },
                {
                    id: 'full_service', name: 'Full Service (mow + trim + blow)', multiplier: 1.30,
                    tasks: [
                        { id: 'lm_f_t1', label: 'Walk the yard — remove obstacles & photograph condition', requiresPhoto: true  },
                        { id: 'lm_f_t2', label: 'Mow grass to required height',                            requiresPhoto: false },
                        { id: 'lm_f_t3', label: 'String trim all edges, borders & around obstacles',       requiresPhoto: false },
                        { id: 'lm_f_t4', label: 'Edge sidewalks & driveway borders',                       requiresPhoto: false },
                        { id: 'lm_f_t5', label: 'Blow all clippings from paths, driveway & patio',         requiresPhoto: false },
                        { id: 'lm_f_t6', label: 'Final walkthrough & photograph finished yard',             requiresPhoto: true  },
                    ]
                }
            ],
            sizes: [
                { id: 'lm_small', name: 'Small Yard (Under 1/4 acre)',   price: 60.00,  durationHrs: 1   },
                { id: 'lm_med',   name: 'Medium Yard (1/4 to 1/2 acre)', price: 90.00,  durationHrs: 1.5 },
                { id: 'lm_large', name: 'Large Yard (Over 1/2 acre)',    price: 140.00, durationHrs: 2   }
            ],
            tasks: [
                { id: 'lm_t1', label: 'Walk the yard — remove obstacles & check for hazards', requiresPhoto: true  },
                { id: 'lm_t2', label: 'Mow grass to required height',                          requiresPhoto: false },
                { id: 'lm_t3', label: 'Edge-trim borders, walkways & obstacles',               requiresPhoto: false },
                { id: 'lm_t4', label: 'Blow or rake clippings from paths & driveway',          requiresPhoto: false },
                { id: 'lm_t5', label: 'Final walkthrough inspection',                          requiresPhoto: true  },
            ],
            addons: [
                { id: 'edgeTrimming',     name: 'Edge Trimming',     price: 25.00, qtySelector: false },
                { id: 'clippingsRemoval', name: 'Clippings Removal', price: 30.00, qtySelector: false }
            ]
        }
    ],
    bathrooms: {
        '1 Bathroom': 14.00,
        '2 Bathroom': 28.00,
        '3 Bathroom': 42.00,
        '4 Bathroom': 56.00,
        '5 Bathroom': 70.00,
        '6 Bathroom': 84.00,
        '7 Bathroom': 98.00
    },
    frequencies: {
        'One-Time':   { name: 'one time service',      discount: 0    },
        'Weekly':     { name: 'Weekly 20% off',        discount: 0.20 },
        'Bi-Weekly':  { name: 'Bi-Weekly 15% off',     discount: 0.15 },
        'Tri-Weekly': { name: 'Tri weekly 12% off',    discount: 0.12 },
        'Monthly':    { name: 'Monthly 10% off',       discount: 0.10 }
    },
    globalAddons: [
        { id: 'downtownParking',      name: 'Downtown Street Parking Fee', price: 14.00, qtySelector: false },
        { id: 'nextDayBooking',       name: 'Next Day Booking Fee',        price: 52.50, qtySelector: false },
        { id: 'sameDayCancellation',  name: 'Same Day Cancellation Fee',   price: 55.30, qtySelector: false }
    ],
    promotions: DEFAULT_PROMOTIONS
};


const HOUSE_CLEANING_SERVICES = [
    'Studio or 1 Bedroom',
    '2 bedroom apartment',
    '3 bedroom apartment or townhouse',
    '3 or 4 bedroom house (or between 1700 to 1999 sqft)',
    'between 2000 to 2499 sq ft',
    'between 2500 to 2999 sq ft',
    'between 3000 to 3499 sq ft',
    'between 3500 to 3999 sq ft',
];

const STANDALONE_SERVICES = ['Window Cleaning', 'Gutter Cleaning', 'Power Washing'];

const DEFAULT_SERVICE_DURATIONS = {
    'Studio or 1 Bedroom': 2,
    '2 bedroom apartment': 2.5,
    '3 bedroom apartment or townhouse': 3,
    '3 or 4 bedroom house (or between 1700 to 1999 sqft)': 3.5,
    'between 2000 to 2499 sq ft': 4,
    'between 2500 to 2999 sq ft': 4.5,
    'between 3000 to 3499 sq ft': 5,
    'between 3500 to 3999 sq ft': 5.5,
    'Window Cleaning': 2,
    'Gutter Cleaning': 1.5,
    'Power Washing': 2.5,
};

export default function Home() {
    // ----------------------------------------------------
    // React State Variables
    // ----------------------------------------------------
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [hrHubOpen, setHrHubOpen] = useState(true);
    const [clockString, setClockString] = useState("");

    // Core Data collections loaded from Serverless APIs
    const [bookings, setBookings] = useState([]);
    const [timeEntries, setTimeEntries] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [financialRecords, setFinancialRecords] = useState([]);
    const [expenseForm, setExpenseForm] = useState({ amount: "", category: "Cleaning Supplies", description: "", date: new Date().toISOString().split("T")[0], receiptUrl: "", receiptName: "", paymentMethod: "Personal (Reimbursable)", isReimbursable: true });
    const [expenseReceiptUploading, setExpenseReceiptUploading] = useState(false);
    const [expenseSubmitting, setExpenseSubmitting] = useState(false);
    const [expenseFeedback, setExpenseFeedback] = useState("");
    const [expenseRejectReason, setExpenseRejectReason] = useState({});
    const [teams, setTeams] = useState([]);
    const [editRequests, setEditRequests] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [teamLeaders, setTeamLeaders] = useState([]);
    const [fieldStaff, setFieldStaff] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(DEFAULT_BRANCH_ID);

    // Auth Forms state
    const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
    const [name, setName] = useState("");
    const [authPhone, setAuthPhone] = useState("");
    const [authCode, setAuthCode] = useState("");
    const [authCodeSent, setAuthCodeSent] = useState(false);
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const roleDefinition = currentUser ? ROLE_DEFINITIONS[currentUser.role] || ROLE_DEFINITIONS["super-admin"] : null;
    const roleLabel = currentUser ? getRoleLabel(currentUser.role) : "";
    const canSelfManagePeopleProfile = currentUser ? STAFF_SELF_SERVICE_ROLES.includes(normalizeRole(currentUser.role)) : false;
    const isPendingCleanerOnboarding = currentUser ? canSelfManagePeopleProfile && currentUser.status === "pending_approval" : false;
    const canViewDepartment = useCallback((departmentId) => {
        if (!currentUser) return false;
        return roleHasDepartment(currentUser.role, departmentId);
    }, [currentUser]);
    const canViewPeople = isPendingCleanerOnboarding ? true : canViewDepartment("people") || canSelfManagePeopleProfile;
    const canViewOperations = isPendingCleanerOnboarding ? false : canViewDepartment("operations");
    const canViewAdministration = isPendingCleanerOnboarding ? false : canViewDepartment("administration");
    const canViewSales = isPendingCleanerOnboarding ? false : canViewDepartment("sales");
    const canViewCRM = canViewSales || canViewOperations || canViewAdministration;
    const canManagePermissions = canManageSystem(currentUser);
    const canManagePeopleProfiles = currentUser ? ["super-admin", "branch-admin"].includes(normalizeRole(currentUser.role)) : false;
    const isSuperAdmin = normalizeRole(currentUser?.role) === "super-admin";
    const canReviewExpenses = canManagePeopleProfiles;
    const isCleanerSelfServiceView = Boolean(canSelfManagePeopleProfile && !canManagePeopleProfiles && !isPendingCleanerOnboarding);
    const showBookingContactFields = !isCleanerSelfServiceView;
    const isCleanerBookingEditor = isCleanerSelfServiceView;
    const branchScope = currentUser ? getBranchScopeForUser({ ...currentUser, activeBranchId: selectedBranchId }) : null;
    const activeBranch = getBranchById(branchScope?.activeBranchId || selectedBranchId || DEFAULT_BRANCH_ID);

    // Address Autocomplete (Restricted to Ontario, Canada)
    const [addressQuery, setAddressQuery] = useState("");
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [adminAddressSuggestions, setAdminAddressSuggestions] = useState([]);
    const [showAdminAddressSuggestions, setShowAdminAddressSuggestions] = useState(false);
    const [googlePlacesReady, setGooglePlacesReady] = useState(false);
    const [staffAddressSuggestions, setStaffAddressSuggestions] = useState([]);
    const [showStaffAddressSuggestions, setShowStaffAddressSuggestions] = useState(false);
    const autocompleteRef = useRef(null);
    const adminAutocompleteRef = useRef(null);
    const staffAutocompleteRef = useRef(null);
    const serviceCatalogRef = useRef(null);

    // Bookings Filters
    const [searchVal, setSearchVal] = useState("");
    const [filterService, setFilterService] = useState("");
    const [filterTeam, setFilterTeam] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterPayment, setFilterPayment] = useState("");
    const [sortVal, setSortVal] = useState("date-asc");

    // Calendar state
    const [selectedCalDate, setSelectedCalDate] = useState(() => {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
    });
    const [currentCalMonth, setCurrentCalMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });

    // Pricing rates manager states
    // --- V1 Core Booking Engine State ---
    const [pricingRates, setPricingRates] = useState(DEFAULT_PRICES);

    // --- V2 Dynamic Catalog State ---
    const [v2Catalog, setV2Catalog] = useState(INITIAL_V2_CATALOG);
    const [promotionRules, setPromotionRules] = useState(DEFAULT_PROMOTIONS);
    const [customerRewards, setCustomerRewards] = useState(null);
    const [documentCopy, setDocumentCopy] = useState(DEFAULT_DOCUMENT_COPY);
    const [promotionSaving, setPromotionSaving] = useState(false);
    const [leadSources, setLeadSources] = useState(["bark.com", "EZi App", "internal.com", "Google", "Instagram", "Referral", "Other"]);

    // Form inputs for scheduling modal
    const [bookingForm, setBookingForm] = useState({
        id: "",
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        address1: "", // Street
        address2: "", // Apt #
        city: "",
        state: "Ontario",
        postalCode: "",
        country: "Canada",
        location: null,
        service: "Studio or 1 Bedroom",
        bathrooms: "1 Bathroom",
        extras: {},
        frequency: "One-Time",
        hasPets: false,
        accessMode: "Will be home",
        freeParking: true,
        firstClean30: false,
        specialNotes: "",
        accessDetails: "",
        customDiscountPercent: 0,
        customDiscountAmount: 0,
        price: 87.50,
        duration: 2,
        date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }),
        time: "07:00 AM",
        shifts: [],
        isRecurring: false,
        recurringSeriesId: "",
        team: "",
        assignedStaff: [],
        assignedStaffIds: [],
        status: "Pending",
        paymentStatus: "unpaid",
        paymentMethod: "",
        leadSource: "",
        serviceDescription: "",
        accessDescription: "",
        cartItems: [],
        subtotal: 87.50,
        tax: 11.38,
        promoCode: "",
        promoName: "",
        promoDiscount: 0,
        giftCardCode: ""
    });

    // Details and Editing modals
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [crmCustomerKey, setCrmCustomerKey] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [bookingModalOpen, setBookingModalOpen] = useState(false);
    const [adminServiceCart, setAdminServiceCart] = useState([]);
    const [bookingWizardOpen, setBookingWizardOpen] = useState(false);
    const [serviceConfigOpen, setServiceConfigOpen] = useState(false);
    const [serviceConfigTarget, setServiceConfigTarget] = useState("checkout");
    const [configCategory, setConfigCategory] = useState(null);
    const [configServiceTypeId, setConfigServiceTypeId] = useState("");
    const [configPropertyTypeId, setConfigPropertyTypeId] = useState("");
    const [configSizeId, setConfigSizeId] = useState("");
    const [configBathroomKey, setConfigBathroomKey] = useState("1 Bathroom");
    const [configAddons, setConfigAddons] = useState({});
    const [configEditingCartId, setConfigEditingCartId] = useState("");
    const [bookingServiceCartOpen, setBookingServiceCartOpen] = useState(false);
    const [bookingServiceDraft, setBookingServiceDraft] = useState([]);
    const [bookingServicesChanged, setBookingServicesChanged] = useState(false);
    const [bookingPriceOverrideOpen, setBookingPriceOverrideOpen] = useState(false);
    const [adminCheckoutOpen, setAdminCheckoutOpen] = useState(false);
    const [adminCheckoutStep, setAdminCheckoutStep] = useState(0);
    const [adminScheduleHint, setAdminScheduleHint] = useState("");
    const [adminCheckoutForm, setAdminCheckoutForm] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        address1: "",
        address2: "",
        city: "Ottawa",
        state: "Ontario",
        postalCode: "",
        country: "Canada",
        location: null,
        date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }),
        time: "07:00 AM",
        shifts: [],
        isRecurring: false,
        recurringFrequency: "Weekly",
        assignedStaffIds: [],
        bookingStatus: "Pending",
        paymentStatus: "unpaid",
        paymentMethod: "",
        leadSource: "",
        customerLoggedIn: false,
        promoCode: "",
        giftCardCode: "",
        discountAmount: 0,
        discountPercent: 0,
        notes: ""
    });

    // Admin team crew creation modal
    const [teamModalOpen, setTeamModalOpen] = useState(false);
    const [teamForm, setTeamForm] = useState({
        id: "",
        name: "",
        color: "sparkle",
        lead: "",
        size: 2,
        members: "",
        description: "",
        employmentType: "in_house", // 'in_house' or 'subcontractor'
        availability: {} // Map of dates/days to availability status
    });

    // Profile and Security settings states
    const [profileName, setProfileName] = useState("");
    const [profileLoading, setProfileLoading] = useState(false);
    const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
    const [profilePhotoStatus, setProfilePhotoStatus] = useState("");
    const [staffDocumentUploading, setStaffDocumentUploading] = useState(false);
    const [blockedDateInput, setBlockedDateInput] = useState("");
    const [securityForm, setSecurityForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [securityLoading, setSecurityLoading] = useState(false);
    const [selectedStaffUid, setSelectedStaffUid] = useState("");
    const [staffProfileDraft, setStaffProfileDraft] = useState(null);
    const [staffProfileDraftOwnerUid, setStaffProfileDraftOwnerUid] = useState("");
    const [staffProfileSaving, setStaffProfileSaving] = useState(false);
    const [staffProfileFeedback, setStaffProfileFeedback] = useState("");
    const [staffProfileRejectReason, setStaffProfileRejectReason] = useState("");
    const [staffProfileEditOpen, setStaffProfileEditOpen] = useState(false);
    const [staffProfileMobileTab, setStaffProfileMobileTab] = useState("identity");
    const [timeEntrySaving, setTimeEntrySaving] = useState(false);
    const [jobsFeedback, setJobsFeedback] = useState("");
    const [jobsNow, setJobsNow] = useState(0);
    const [cleanerJobTab, setCleanerJobTab] = useState("overview");
    const [cleanerJobDrafts, setCleanerJobDrafts] = useState({});
    const [pendingAfterPhotos, setPendingAfterPhotos] = useState({});
    const [cleanerExtraTaskOpen, setCleanerExtraTaskOpen] = useState(false);
    const [cleanerExtraTaskInput, setCleanerExtraTaskInput] = useState("");
    const [adminClockForm, setAdminClockForm] = useState({ cleanerUid: "", bookingId: "", startedAt: "" });
    const [editRequestResolutions, setEditRequestResolutions] = useState({});
    const [timeEntryEditDrafts, setTimeEntryEditDrafts] = useState({});
    const [manualTimeEntryForm, setManualTimeEntryForm] = useState({
        cleanerUid: "",
        bookingId: "",
        startedAt: "",
        endedAt: "",
        unpaidBreakMinutes: 0
    });

    // Shared Secure JWT Authorization Request Fetcher
    const getAuthHeaders = useCallback(async () => {
        if (!auth.currentUser) return {};
        const token = await auth.currentUser.getIdToken();
        return {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };
    }, []);

    useEffect(() => {
        if (currentUser) {
            const timer = setTimeout(() => {
                setProfileName(currentUser.name || "");
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [currentUser]);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        if (window.google?.maps?.places) {
            const readyTimer = setTimeout(() => setGooglePlacesReady(true), 0);
            return () => clearTimeout(readyTimer);
        }

        const markReady = () => {
            setTimeout(() => setGooglePlacesReady(true), 0);
            return undefined;
        };

        const existing = document.querySelector('script[data-google-places="true"]');
        if (existing) {
            existing.addEventListener("load", markReady, { once: true });
            return undefined;
        }

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.dataset.googlePlaces = "true";
        script.onload = markReady;
        document.body.appendChild(script);
        return undefined;
    }, []);

    useEffect(() => {
        if (!currentUser) return;
        if (!STAFF_SELF_SERVICE_ROLES.includes(normalizeRole(currentUser.role))) return;
        const timer = setTimeout(() => {
            setActiveTab(currentUser.status === "pending_approval" ? "teams" : "jobs");
            setSelectedStaffUid(currentUser.uid);
            setStaffProfileDraftOwnerUid(currentUser.uid);
            setStaffProfileDraft(normalizeStaffProfile(currentUser.staffProfileRequest?.requestedProfile || currentUser.staffProfile));
            if (currentUser.status === "pending_approval") {
                setStaffProfileEditOpen(true);
                setStaffProfileMobileTab("identity");
                setStaffProfileFeedback("Complete your cleaner profile and submit it for branch admin approval.");
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [currentUser]);

    const peopleRoster = useMemo(() => {
        if (!currentUser) return [];
        if (canManagePeopleProfiles) {
            return fieldStaff.map(member => normalizeStaffMember(member));
        }
        return [normalizeStaffMember(currentUser)];
    }, [currentUser, fieldStaff, canManagePeopleProfiles]);

    const activeSelectedStaffUid = selectedStaffUid || peopleRoster[0]?.uid || "";

    const selectedStaffMember = useMemo(() => {
        if (!peopleRoster.length) return null;
        return peopleRoster.find(member => member.uid === activeSelectedStaffUid) || peopleRoster[0];
    }, [peopleRoster, activeSelectedStaffUid]);

    const canEditSelectedStaffProfile = Boolean(currentUser && selectedStaffMember && currentUser.uid === selectedStaffMember.uid);
    const canAdminDirectEditSelectedStaffProfile = Boolean(currentUser && selectedStaffMember && canManagePeopleProfiles);
    const isViewingOwnCleanerProfile = Boolean(
        currentUser &&
        selectedStaffMember &&
        currentUser.uid === selectedStaffMember.uid &&
        STAFF_SELF_SERVICE_ROLES.includes(normalizeRole(selectedStaffMember.role))
    );

    const activeStaffProfileDraft = useMemo(() => {
        if (!selectedStaffMember) return null;
        if (staffProfileDraftOwnerUid === selectedStaffMember.uid && staffProfileDraft) {
            return staffProfileDraft;
        }
        return normalizeStaffProfile(selectedStaffMember.staffProfileRequest?.requestedProfile || selectedStaffMember.staffProfile);
    }, [selectedStaffMember, staffProfileDraftOwnerUid, staffProfileDraft]);

    const selectedStaffAssignedJobs = useMemo(() => {
        if (!selectedStaffMember) return [];
        return bookings.filter(b => b.assignedStaffIds?.includes(selectedStaffMember.uid) && b.status !== "Cancelled");
    }, [bookings, selectedStaffMember]);

    const selectedStaffCompletedJobs = useMemo(() => {
        return selectedStaffAssignedJobs.filter(b => b.status === "Completed");
    }, [selectedStaffAssignedJobs]);

    const cleanerAssignedJobs = useMemo(() => {
        if (!currentUser || !canSelfManagePeopleProfile) return [];
        return bookings
            .filter(b => b.assignedStaffIds?.includes(currentUser.uid) && b.status !== "Cancelled")
            .sort((a, b) => {
                const aTime = new Date(`${a.date}T00:00:00`).getTime();
                const bTime = new Date(`${b.date}T00:00:00`).getTime();
                return aTime - bTime;
            });
    }, [bookings, canSelfManagePeopleProfile, currentUser]);

    const cleanerTodayConfirmedJobs = useMemo(() => {
        const todayKey = getCurrentTorontoDateKey(jobsNow ? new Date(jobsNow) : new Date());
        return cleanerAssignedJobs.filter(job => job.date === todayKey && job.status === "Confirmed");
    }, [cleanerAssignedJobs, jobsNow]);

    const todayAllConfirmedJobs = useMemo(() => {
        const todayKey = getCurrentTorontoDateKey(jobsNow ? new Date(jobsNow) : new Date());
        return bookings.filter(b => b.date === todayKey && b.status === "Confirmed");
    }, [bookings, jobsNow]);

    const activeTimeEntries = useMemo(() => {
        return timeEntries.filter(e => e.status === "active");
    }, [timeEntries]);

    const ownTimeEntries = useMemo(() => {
        if (!currentUser) return [];
        return timeEntries.filter(entry => entry.cleanerUid === currentUser.uid);
    }, [currentUser, timeEntries]);

    const activeTimeEntry = useMemo(() => {
        return ownTimeEntries.find(entry => entry.status === "active") || null;
    }, [ownTimeEntries]);

    const activeJobForCleaner = useMemo(() => {
        if (!activeTimeEntry) return null;
        return cleanerAssignedJobs.find(job => job.id === activeTimeEntry.bookingId) || null;
    }, [activeTimeEntry, cleanerAssignedJobs]);

    const cleanerPayPeriod = useMemo(() => getCleanerPayPeriodSummary(jobsNow ? new Date(jobsNow) : new Date()), [jobsNow]);

    const recentOwnTimeEntries = useMemo(() => {
        return ownTimeEntries.filter(entry => entry.status !== "active" && entry.status !== "rejected").slice(0, 6);
    }, [ownTimeEntries]);

    const weeklyTimeSummary = useMemo(() => {
        const entries = ownTimeEntries.filter(entry => {
            const started = new Date(entry.startedAt || entry.createdAt || 0).getTime();
            return started >= cleanerPayPeriod.periodStart.getTime()
                && started <= cleanerPayPeriod.cutoffDate.getTime()
                && entry.status !== "rejected";
        });
        const totalMinutes = entries.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0);
        const grossPay = entries.reduce((sum, entry) => sum + Number(entry.grossPayEstimate || 0), 0);
        return {
            totalMinutes,
            grossPay
        };
    }, [cleanerPayPeriod, ownTimeEntries]);

    const payrollSummary = useMemo(() => {
        const pending = timeEntries.filter(entry => entry.status === "pending_approval");
        const approved = timeEntries.filter(entry => entry.status === "approved");
        const currentPeriodEntries = timeEntries.filter(entry => {
            const started = new Date(entry.startedAt || entry.createdAt || 0).getTime();
            return started >= cleanerPayPeriod.periodStart.getTime() && started <= cleanerPayPeriod.cutoffDate.getTime();
        });
        return {
            totalPayroll: approved.reduce((sum, entry) => sum + Number(entry.grossPayEstimate || 0), 0),
            trackedMinutes: currentPeriodEntries.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0),
            pendingCount: pending.length,
            nextPayDate: cleanerPayPeriod.payDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            pendingEntries: pending
        };
    }, [cleanerPayPeriod, timeEntries]);

    const payrollApprovedRows = useMemo(() => {
        return timeEntries
            .filter(entry => entry.status === "approved")
            .map(entry => ({
                ...entry,
                payrollBreakdown: entry.payrollBreakdown || calculatePayrollBreakdown(entry.durationMinutes || 0, {
                    hourlyRate: entry.payRate,
                    overtimeRate: entry.overtimeRate,
                    overtimeAfterHours: entry.overtimeAfterHours
                })
            }));
    }, [timeEntries]);

    const payrollRejectedRows = useMemo(() => {
        return timeEntries
            .filter(entry => entry.status === "rejected")
            .map(entry => ({
                ...entry,
                payrollBreakdown: entry.payrollBreakdown || calculatePayrollBreakdown(entry.durationMinutes || 0, {
                    hourlyRate: entry.payRate,
                    overtimeRate: entry.overtimeRate,
                    overtimeAfterHours: entry.overtimeAfterHours
                })
            }));
    }, [timeEntries]);

    const employeePayrollRoster = useMemo(() => {
        return fieldStaff.filter(member => {
            const workerType = String(member.staffProfile?.employment?.workerType || "").toLowerCase();
            return workerType !== "subcontractor";
        });
    }, [fieldStaff]);

    const activeCleanerJobDraft = useMemo(() => {
        if (!bookingForm?.id) return null;
        return cleanerJobDrafts[bookingForm.id] || {
            bookingId: bookingForm.id,
            tasks: buildCleanerTaskList(bookingForm, pricingRates, v2Catalog).map(task => ({
                ...task,
                beforePhotos: [],
                afterPhotos: []
            }))
        };
    }, [bookingForm, cleanerJobDrafts, pricingRates, v2Catalog]);

    const cleanerWizardPhase = useMemo(() => {
        if (!bookingForm?.id || !isCleanerSelfServiceView) return "read_only";
        const hasSubmitted = editRequests.some(req =>
            req.bookingId === bookingForm.id &&
            req.status === "Pending" &&
            req.requestedData?.cleanerChecklist?.tasks?.length > 0
        );
        if (hasSubmitted) return "submitted";
        if (activeTimeEntry?.bookingId === bookingForm.id) return "in_progress";
        if (pendingAfterPhotos[bookingForm.id]) return "after_photos";
        const hasCompletedEntry = ownTimeEntries.some(e =>
            e.bookingId === bookingForm.id && e.status !== "active" && e.status !== "deleted"
        );
        if (hasCompletedEntry) return "after_photos";
        const isToday = bookingForm.date === getCurrentTorontoDateKey(jobsNow ? new Date(jobsNow) : new Date());
        if (isToday) return "before_start";
        return "read_only";
    }, [bookingForm, editRequests, activeTimeEntry, pendingAfterPhotos, ownTimeEntries, isCleanerSelfServiceView, jobsNow]);

    const selectedStaffAvailability = useMemo(() => {
        return buildAvailabilitySnapshot(activeStaffProfileDraft?.availability);
    }, [activeStaffProfileDraft]);

    const selectedStaffBlockedDates = useMemo(() => {
        return (selectedStaffAvailability.blockedDates || []).slice(0, 6);
    }, [selectedStaffAvailability]);

    const selectedStaffIdentityCards = useMemo(() => ([
        {
            key: "phone",
            label: "Phone Number",
            value: activeStaffProfileDraft?.personal?.phone || "Not submitted",
            icon: Icons.Phone()
        },
        {
            key: "email",
            label: "Email Address",
            value: activeStaffProfileDraft?.personal?.email || selectedStaffMember?.email || "Not submitted",
            icon: Icons.Mail()
        }
    ]), [activeStaffProfileDraft, selectedStaffMember]);

    const selectedStaffEmploymentCards = useMemo(() => ([
        {
            key: "worker-type",
            label: "Worker Type",
            value: activeStaffProfileDraft?.employment?.workerType || getRoleLabel(selectedStaffMember?.role)
        },
        {
            key: "hourly-rate",
            label: "Hourly Rate",
            value: `$${Number(activeStaffProfileDraft?.employment?.hourlyRate || 20).toFixed(2)}`
        },
        {
            key: "start-date",
            label: "Start Date",
            value: selectedStaffMember?.createdAt ? selectedStaffMember.createdAt.split("T")[0] : "Pending"
        },
        {
            key: "work-status",
            label: "Work Permit Document",
            value: activeStaffProfileDraft?.eligibility?.documentUpload?.name || "No document uploaded"
        },
        {
            key: "photo-id",
            label: "Photo ID Upload",
            value: activeStaffProfileDraft?.eligibility?.photoIdUpload?.name || "No photo ID uploaded"
        },
        {
            key: "background-check",
            label: "Police Clearance",
            value: activeStaffProfileDraft?.compliance?.backgroundCheckStatus || "Pending"
        }
    ]), [activeStaffProfileDraft, selectedStaffMember]);

    // Live pricing rates loader from Serverless API settings/pricing
    useEffect(() => {
        const loadPricingRates = async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch("/api/settings", { headers });
                if (res.ok) {
                    const data = await res.json();
                    if (data && Object.keys(data).length > 0) {
                        if (data.v2_catalog) {
                            setV2Catalog(data.v2_catalog);
                        }
                        if (data.promotions) {
                            setPromotionRules(ensurePromotionList(data.promotions));
                        }
                        if (data.documentCopy) {
                            setDocumentCopy(normalizeDocumentCopy(data.documentCopy));
                        }
                        if (data.leadSources && Array.isArray(data.leadSources) && data.leadSources.length > 0) {
                            setLeadSources(data.leadSources);
                        }
                        setPricingRates(prev => {
                            const mergedServices = { ...DEFAULT_PRICES.services, ...data.services };
                            const mergedBathrooms = { ...DEFAULT_PRICES.bathrooms, ...data.bathrooms };
                            const mergedExtras = { ...DEFAULT_PRICES.extras, ...data.extras };

                            // Merge and sanitize frequencies discount to decimal
                            const mergedFrequencies = { ...DEFAULT_PRICES.frequencies };
                            if (data.frequencies) {
                                Object.entries(data.frequencies).forEach(([key, freq]) => {
                                    if (freq) {
                                        const rawDiscount = freq.discount !== undefined ? freq.discount : (DEFAULT_PRICES.frequencies[key]?.discount || 0);
                                        const discountDecimal = rawDiscount > 1 ? rawDiscount / 100 : rawDiscount;
                                        mergedFrequencies[key] = {
                                            ...DEFAULT_PRICES.frequencies[key],
                                            ...freq,
                                            discount: discountDecimal
                                        };
                                    }
                                });
                            }

                            const mergedServiceDurations = { ...DEFAULT_PRICES.serviceDurations, ...(data.serviceDurations || {}) };

                            return {
                                services: mergedServices,
                                serviceDurations: mergedServiceDurations,
                                bathrooms: mergedBathrooms,
                                extras: mergedExtras,
                                frequencies: mergedFrequencies
                            };
                        });
                    }
                }
            } catch (err) {
                console.warn("Failed to load custom pricing from API, using defaults.", err);
            }
        };
        if (currentUser) {
            loadPricingRates();
        }
    }, [currentUser, getAuthHeaders]);

    // Customer rewards wallet — real referral code, earned credit, and eligible promos.
    useEffect(() => {
        const loadCustomerRewards = async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch("/api/promotions", { headers });
                if (res.ok) {
                    setCustomerRewards(await res.json());
                }
            } catch (err) {
                console.warn("Failed to load customer rewards.", err);
            }
        };
        if (currentUser && normalizeRole(currentUser.role) === "customer") {
            loadCustomerRewards();
        }
    }, [currentUser, getAuthHeaders]);

    // Dynamic price calculator combining Base Service, Bathrooms, Extras, Frequencies, and Custom Discounts
    const calculateBookingTotal = (formState) => {
        const baseServicePrice = pricingRates.services[formState.service] || 0;
        const bathroomsPrice = pricingRates.bathrooms[formState.bathrooms] || 0;
        let extrasTotal = 0;
        Object.entries(formState.extras || {}).forEach(([key, qty]) => {
            const extraConfig = pricingRates.extras[key];
            if (extraConfig && qty) {
                const qtyVal = typeof qty === 'boolean' ? 1 : parseFloat(qty || 0);
                extrasTotal += extraConfig.price * qtyVal;
            }
        });
        const subtotal = baseServicePrice + bathroomsPrice + extrasTotal;

        const freqConfig = pricingRates.frequencies[formState.frequency || 'One-Time'];
        const rawDiscount = freqConfig ? (freqConfig.discount ?? 0) : 0;
        // Sanitize: if stored as integer percent (e.g. 20) convert to decimal (0.20)
        const freqDiscountPercent = rawDiscount > 1 ? rawDiscount / 100 : rawDiscount;
        // Apply discount to full subtotal (base + bathrooms + extras)
        const freqDiscountDeduction = subtotal * freqDiscountPercent;

        // Flat dollar custom discount
        const customDiscountAmount = parseFloat(formState.customDiscountAmount || 0);

        const preTaxTotal = Math.max(0, subtotal - freqDiscountDeduction - customDiscountAmount);
        const hst = preTaxTotal * 0.13;
        const total = preTaxTotal + hst;

        return {
            baseServicePrice,
            bathroomsPrice,
            extrasTotal,
            subtotal,
            freqDiscountPercent,
            freqDiscountDeduction,
            customDiscountDeduction: customDiscountAmount,
            preTaxTotal,
            hst,
            total
        };
    };




    // Live clock utility
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            setClockString(now.toLocaleDateString('en-US', options));
        };
        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => setJobsNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // ----------------------------------------------------
    // User Profile Poller & Sync Hook
    // ----------------------------------------------------
    const syncDatabaseData = useCallback(async (user) => {
        try {
            const headers = await getAuthHeaders();
            const role = normalizeRole(user?.role);
            const isBranchManager = canManageSystem(user) || role === "super-admin" || role === "branch-admin";

            // 1. Fetch scoped bookings
            const branchQuery = selectedBranchId && !isBranchManager ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
            const bookingsRes = await fetch(`/api/bookings${branchQuery}`, { headers });
            if (bookingsRes.ok) {
                const data = await bookingsRes.json();
                setBookings(data);
            } else {
                console.error("Bookings sync failed", bookingsRes.status, await bookingsRes.text());
            }

            const timeEntriesRes = await fetch("/api/time-entries", { headers });
            if (timeEntriesRes.ok) {
                const data = await timeEntriesRes.json();
                setTimeEntries(data);
            } else {
                console.error("Time entries sync failed", timeEntriesRes.status, await timeEntriesRes.text());
            }

            // 2. Fetch approved field staff for person-based job assignment
            if (isBranchManager) {
                const fieldStaffRes = await fetch(`/api/users?type=field-staff${canManagePeopleProfiles ? "&includePending=1" : ""}`, { headers });
                if (fieldStaffRes.ok) {
                    const data = await fieldStaffRes.json();
                    setFieldStaff(data);
                    setTeamLeaders(data.filter(member => ["cleaner", "supervisor"].includes(member.role)));
                } else {
                    console.error("Field staff sync failed", fieldStaffRes.status, await fieldStaffRes.text());
                }
            }

            // 3. Fetch edit requests scoped by role
            const editsRes = await fetch("/api/edit-requests", { headers });
            if (editsRes.ok) {
                const data = await editsRes.json();
                setEditRequests(data);
            } else {
                console.error("Edit requests sync failed", editsRes.status, await editsRes.text());
            }

            const expensesRes = await fetch("/api/expenses", { headers });
            if (expensesRes.ok) {
                const data = await expensesRes.json();
                setExpenses(data);
            } else {
                console.error("Expenses sync failed", expensesRes.status, await expensesRes.text());
            }

            if (isBranchManager) {
                const financialRecordsRes = await fetch("/api/financial-records", { headers });
                if (financialRecordsRes.ok) {
                    const data = await financialRecordsRes.json();
                    setFinancialRecords(data);
                } else {
                    console.error("Financial records sync failed", financialRecordsRes.status, await financialRecordsRes.text());
                }
            }

            // 4. Fetch pending user accounts & registered approved team leaders (permissioned admin only)
            if (canManageSystem(user)) {
                const pendingRes = await fetch("/api/users", { headers });
                if (pendingRes.ok) {
                    const data = await pendingRes.json();
                    setPendingUsers(data);
                }
                const leadersRes = await fetch("/api/users?type=leaders", { headers });
                if (leadersRes.ok) {
                    const data = await leadersRes.json();
                    setTeamLeaders(data);
                }
            }
        } catch (e) {
            console.error("Data syncing failed", e);
        }
    }, [canManagePeopleProfiles, getAuthHeaders, selectedBranchId]);

    // Keep data fresh by syncing when user changes or tab switches
    useEffect(() => {
        if (currentUser && currentUser.status === "approved") {
            const timer = setTimeout(() => {
                syncDatabaseData(currentUser);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [currentUser, activeTab, syncDatabaseData]);

    // Handle authentication state changes & read server-side user document securely
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const token = await firebaseUser.getIdToken();

                    // Fetch profile using secure API route
                    let userData = null;
                    let retries = 0;

                    while (!userData && retries < 5) {
                        try {
                            const res = await fetch("/api/users?type=me", {
                                headers: { "Authorization": `Bearer ${token}` }
                            });
                            if (res.ok) {
                                userData = await res.json();
                                break;
                            }
                        } catch (e) {
                            console.warn("Retrying profile fetch...", e);
                        }
                        await new Promise(r => setTimeout(r, 600));
                        retries++;
                    }

                    if (userData) {
                        setCurrentUser(userData);
                        setSelectedBranchId(userData.branchId || userData.branchIds?.[0] || DEFAULT_BRANCH_ID);
                        if (STAFF_SELF_SERVICE_ROLES.includes(normalizeRole(userData.role))) {
                            setActiveTab(userData.status === "pending_approval" ? "teams" : "jobs");
                            setSelectedStaffUid(userData.uid);
                        }
                        if (userData.status === "approved") {
                            syncDatabaseData(userData);
                        }
                    } else {
                        await signOut(auth);
                        setCurrentUser(null);
                    }
                } catch (err) {
                    console.error("Failed to load user profile securely", err);
                    alert("Authentication Error: Failed to fetch user role.\n\nDetails: " + (err.message || err));
                    signOut(auth);
                }
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [syncDatabaseData]);


    // ----------------------------------------------------
    // Client Side Authentication Actions
    // ----------------------------------------------------
    const handleSendPhoneCode = async (e) => {
        e.preventDefault();
        if (!authPhone) return alert("Please enter your phone number.");
        if (authMode === "signup" && !name.trim()) return alert("Please enter your full name.");
        setAuthSubmitting(true);
        try {
            const res = await fetch("/api/auth/phone/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: authPhone,
                    mode: authMode,
                    name
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to send code.");
            setAuthCodeSent(true);
        } catch (err) {
            alert(`Verification Failed: ${err.message}`);
        } finally {
            setAuthSubmitting(false);
        }
    };

    const handlePhoneVerify = async (e) => {
        e.preventDefault();
        if (!authPhone || !authCode) return alert("Please enter your phone number and verification code.");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/phone/verify-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: authPhone,
                    code: authCode,
                    mode: authMode,
                    name
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Phone verification failed.");
            await signInWithCustomToken(auth, data.customToken);
        } catch (err) {
            console.error("Phone auth failed", err);
            alert(`Authentication Failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSignout = async () => {
        setLoading(true);
        await signOut(auth);
        setActiveTab("dashboard");
        setAuthPhone("");
        setAuthCode("");
        setAuthCodeSent(false);
        setName("");
    };

    const loadGooglePredictions = (input, setter) => {
        if (!googlePlacesReady || !window.google?.maps?.places || input.trim().length < 3) {
            setter([]);
            return;
        }
        const service = new window.google.maps.places.AutocompleteService();
        service.getPlacePredictions({
            input,
            componentRestrictions: { country: "ca" },
            types: ["address"]
        }, (predictions, status) => {
            if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
                setter([]);
                return;
            }
            setter(predictions);
        });
    };

    const handleAddressChange = async (e) => {
        const value = e.target.value;
        setAddressQuery(value);
        setBookingForm(prev => ({ ...prev, address1: value, location: null }));
        setShowSuggestions(true);
        loadGooglePredictions(value, setAddressSuggestions);
    };

    const applyPlaceSelection = (placeId, onApply) => {
        if (!googlePlacesReady || !window.google?.maps?.places) return;
        const service = new window.google.maps.places.PlacesService(document.createElement("div"));
        service.getDetails({
            placeId,
            fields: ["address_components", "formatted_address", "geometry"]
        }, (place, status) => {
            if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) return;
            onApply(parseGooglePlaceDetails(place));
        });
    };

    const selectSuggestion = (prediction) => {
        applyPlaceSelection(prediction.place_id, (parsed) => {
            setBookingForm(prev => ({
                ...prev,
                address1: parsed.address1,
                city: parsed.city,
                state: parsed.state || "ON",
                postalCode: parsed.postalCode,
                country: parsed.country || "Canada",
                location: parsed.location || null
            }));
            setAddressQuery(parsed.address1);
            setAddressSuggestions([]);
            setShowSuggestions(false);
        });
    };

    const handleAdminAddressChange = (value) => {
        setAdminCheckoutForm(prev => ({ ...prev, address1: value, location: null }));
        setShowAdminAddressSuggestions(true);
        loadGooglePredictions(value, setAdminAddressSuggestions);
    };

    const selectAdminAddressSuggestion = (prediction) => {
        applyPlaceSelection(prediction.place_id, (parsed) => {
            setAdminCheckoutForm(prev => ({
                ...prev,
                address1: parsed.address1,
                city: parsed.city,
                state: parsed.state || "ON",
                postalCode: parsed.postalCode,
                country: parsed.country || "Canada",
                location: parsed.location || null
            }));
            setAdminAddressSuggestions([]);
            setShowAdminAddressSuggestions(false);
        });
    };

    const handleStaffAddressChange = (value) => {
        updateStaffDraftField("personal", "address", value);
        setShowStaffAddressSuggestions(true);
        loadGooglePredictions(value, setStaffAddressSuggestions);
    };

    const selectStaffAddressSuggestion = (prediction) => {
        applyPlaceSelection(prediction.place_id, (parsed) => {
            setStaffProfileDraftOwnerUid(selectedStaffMember?.uid || "");
            setStaffProfileDraft(prev => {
                const base = prev || normalizeStaffProfile(selectedStaffMember?.staffProfileRequest?.requestedProfile || selectedStaffMember?.staffProfile);
                return {
                    ...base,
                    personal: {
                        ...base.personal,
                        address: parsed.address1,
                        city: parsed.city,
                        province: parsed.state || "ON",
                        postalCode: parsed.postalCode
                    }
                };
            });
            setStaffAddressSuggestions([]);
            setShowStaffAddressSuggestions(false);
        });
    };

    // Close autocomplete when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
            if (adminAutocompleteRef.current && !adminAutocompleteRef.current.contains(e.target)) {
                setShowAdminAddressSuggestions(false);
            }
            if (staffAutocompleteRef.current && !staffAutocompleteRef.current.contains(e.target)) {
                setShowStaffAddressSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ----------------------------------------------------
    // Price and Duration suggestion triggers
    // ----------------------------------------------------
    const handleServiceChange = (e) => {
        const serv = e.target.value;
        const dur = DEFAULT_SERVICE_DURATIONS[serv] || 2;
        setBookingForm(prev => ({
            ...prev,
            service: serv,
            price: pricingRates.services[serv] || 87.50,
            duration: dur
        }));
    };

    // ----------------------------------------------------
    // Slot Overlapping Collision Engine
    // ----------------------------------------------------
    const timeStrToMinutes = (timeStr) => {
        const match = timeStr.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return 0;
        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && hours < 12) hours += 12;
        if (ampm === "AM" && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const minutesToTimeStr = (min) => {
        let hour = Math.floor(min / 60);
        const m = min % 60;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        if (hour > 12) hour -= 12;
        if (hour === 0) hour = 12;
        return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
    };

    const formatTimeWindow = (timeStr, duration) => {
        const startMin = timeStrToMinutes(timeStr);
        const endMin = startMin + parseFloat(duration || 2) * 60;
        return `${timeStr} - ${minutesToTimeStr(endMin)}`;
    };

    const getWeekdayIndexForSchedule = (dateStr) => {
        if (!dateStr) return 0;
        const date = new Date(`${dateStr}T00:00:00`);
        const day = date.getDay();
        return day === 0 ? 6 : day - 1;
    };

    const isShiftEnabledForMinutes = (shifts = {}, minute = 0) => {
        if (minute < 12 * 60) return Boolean(shifts.morning);
        if (minute < 17 * 60) return Boolean(shifts.afternoon);
        return Boolean(shifts.evening);
    };

    const getCleanerAvailabilityStatus = useCallback((member, bookingDate, bookingTime, bookingDuration = 2, excludeBookingId = null) => {
        if (!member) {
            return { available: false, reason: "No cleaner selected", tone: "blocked" };
        }

        if (!bookingDate) {
            return { available: false, reason: "Pick a date first", tone: "pending" };
        }

        const profile = normalizeStaffProfile(member.staffProfileRequest?.requestedProfile || member.staffProfile);
        const availability = profile.availability || {};
        const blockedDates = new Set(availability.blockedDates || []);
        if (blockedDates.has(bookingDate)) {
            return { available: false, reason: "Blocked date", tone: "blocked" };
        }

        const weekday = availability.weekdays?.[getWeekdayIndexForSchedule(bookingDate)];
        if (!weekday?.enabled) {
            return { available: false, reason: "Off day", tone: "blocked" };
        }

        const assignedThatDay = bookings.filter((booking) =>
            booking.id !== excludeBookingId &&
            booking.status !== "Cancelled" &&
            booking.date === bookingDate &&
            booking.assignedStaffIds?.includes(member.uid)
        );

        const maxJobsPerDay = parseInt(availability.maxJobsPerDay || 0, 10);
        if (maxJobsPerDay > 0 && assignedThatDay.length >= maxJobsPerDay) {
            return { available: false, reason: "Max jobs reached", tone: "busy" };
        }

        if (!bookingTime) {
            return { available: true, reason: assignedThatDay.length ? `${assignedThatDay.length} job(s) already booked` : "Available", tone: assignedThatDay.length ? "busy" : "available" };
        }

        const startMin = timeStrToMinutes(bookingTime);
        const endMin = startMin + Math.round(parseFloat(bookingDuration || 2) * 60);

        if (startMin < 7 * 60 || endMin > 19 * 60) {
            return { available: false, reason: "Outside booking hours", tone: "blocked" };
        }

        for (let probe = startMin; probe < endMin; probe += 30) {
            if (!isShiftEnabledForMinutes(weekday.shifts || {}, probe)) {
                return { available: false, reason: "Outside shift availability", tone: "blocked" };
            }
        }

        const overlapBufferMinutes = 30;
        const overlapping = assignedThatDay.find((booking) => {
            const targetStart = timeStrToMinutes(booking.time);
            const targetEnd = targetStart + Math.round(parseFloat(booking.duration || 2) * 60);
            return (startMin < targetEnd + overlapBufferMinutes) && (endMin + overlapBufferMinutes > targetStart);
        });

        if (overlapping) {
            return {
                available: false,
                reason: `Busy with ${overlapping.service || "another job"} at ${overlapping.time} for ${overlapping.duration || 0}h`,
                tone: "busy"
            };
        }

        return { available: true, reason: "Open", tone: "available" };
    }, [bookings]);

    // Overlap Checker: checks if team has another clean on selected date/time window
    const checkScheduleCollisions = (bookingDate, bookingTime, bookingDuration, bookingTeam, excludeId = null) => {
        const startMin = timeStrToMinutes(bookingTime);
        const endMin = startMin + parseFloat(bookingDuration || 2) * 60;

        return bookings.some(b => {
            if (b.id === excludeId) return false;
            if (b.status === "Cancelled") return false;
            if (b.date !== bookingDate) return false;
            if (b.team !== bookingTeam) return false;

            const targetStart = timeStrToMinutes(b.time);
            const targetEnd = targetStart + parseFloat(b.duration || 2) * 60;

            // Overlaps if max(start1, start2) < min(end1, end2)
            return Math.max(startMin, targetStart) < Math.min(endMin, targetEnd);
        });
    };

    // Checks if the team is actively busy AT a given start time (for slot display only)
    // Uses a 30-min probe window so only slots during an existing booking's run are greyed out
    const isSlotDuringExistingBooking = (bookingDate, slotTime, bookingTeam, excludeId = null) => {
        const slotMin = timeStrToMinutes(slotTime);
        return bookings.some(b => {
            if (b.id === excludeId) return false;
            if (b.status === "Cancelled") return false;
            if (b.date !== bookingDate) return false;
            if (b.team !== bookingTeam) return false;

            const existingStart = timeStrToMinutes(b.time);
            const existingEnd = existingStart + parseFloat(b.duration || 2) * 60;

            // The slot is unavailable if it falls within an existing booking's window
            return slotMin >= existingStart && slotMin < existingEnd;
        });
    };

    // ----------------------------------------------------
    // Booking Form Submit Actions
    // ----------------------------------------------------

    const openNewBookingCommand = () => {
        setAdminCheckoutOpen(false);
        setServiceConfigOpen(false);
        setBookingWizardOpen(true);
    };

    const openEditBookingModal = (b) => {
        const nameParts = (b.clientName || "").split(" ");
        const fName = b.firstName || nameParts[0] || "";
        const lName = b.lastName || nameParts.slice(1).join(" ") || "";
        const editableCartItems = normalizeEditableBookingCartItems(b.cartItems, b.service || "Cleaning Service", b.duration || 2, b.subtotal || b.price || 0);
        setBookingForm({
            id: b.id,
            firstName: fName,
            lastName: lName,
            phone: b.phone || "",
            email: b.email || "",
            address1: b.address1 || "",
            address2: b.address2 || "",
            city: b.city || "",
            state: b.state || "Ontario",
            postalCode: b.postalCode || "",
            country: b.country || "Canada",
            location: b.location || null,
            service: b.service || "Studio or 1 Bedroom",
            bathrooms: b.bathrooms || "1 Bathroom",
            extras: b.extras || {},
            frequency: b.frequency || "One-Time",
            hasPets: b.hasPets !== undefined ? b.hasPets : false,
            accessMode: b.accessMode || "Will be home",
            freeParking: b.freeParking !== undefined ? b.freeParking : true,
            firstClean30: b.firstClean30 !== undefined ? b.firstClean30 : false,
            specialNotes: b.specialNotes || "",
            accessDetails: b.accessDetails || "",
            customDiscountPercent: b.customDiscountPercent || 0,
            customDiscountAmount: b.customDiscountAmount || 0,
            price: b.price || 87.50,
            duration: b.duration || editableCartItems.reduce((sum, item) => sum + Number(item.durationHrs || 0), 0) || 2,
            date: b.date,
            time: b.time || "07:00 AM",
            shifts: b.shifts || (b.time ? [timeToShift(b.time)].filter(Boolean) : []),
            isRecurring: Boolean(b.isRecurring),
            recurringSeriesId: b.recurringSeriesId || "",
            recurringIndex: b.recurringIndex || 0,
            team: "",
            assignedStaff: b.assignedStaff || [],
            assignedStaffIds: b.assignedStaffIds || [],
            status: b.status,
            paymentStatus: b.paymentStatus || "unpaid",
            paymentMethod: b.paymentMethod || "",
            leadSource: b.leadSource || "",
            serviceDescription: b.serviceDescription || "",
            accessDescription: b.accessDescription || "",
            cartItems: editableCartItems,
            subtotal: Number(b.subtotal || editableCartItems.reduce((sum, item) => sum + Number(item.price || 0), 0)),
            tax: Number(b.tax || 0),
            promoCode: b.promoCode || "",
            promoName: b.promoName || "",
            promoDiscount: Number(b.promoDiscount || 0),
            giftCardCode: b.giftCardCode || ""
        });
        setBookingServicesChanged(false);
        setBookingPriceOverrideOpen(false);
        setBookingServiceCartOpen(false);
        setAddressQuery(b.address1 || "");
        setBookingModalOpen(true);
    };

    const handleFormKeyDown = (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    };

    // Delegates to the single canonical formula (lib/pricing.js) so the edit
    // modal's live preview always matches what gets saved and what the PDF
    // shows. promoDiscount defaults to 0 for a fresh cart calc, but callers
    // editing an existing booking should pass its already-applied promo so
    // saving the edit doesn't silently drop it.
    const calculateBookingCartTotals = useCallback((cartItems = [], taxRate = 0, discountAmount = 0, discountPercent = 0, promoDiscount = 0) => {
        const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
        const duration = cartItems.reduce((sum, item) => sum + Number(item.durationHrs || 0), 0);
        const pricing = computeBookingPricing({
            subtotal,
            customDiscountAmount: discountAmount,
            customDiscountPercent: discountPercent,
            promoDiscount,
            taxRate
        });
        return { subtotal, tax: pricing.taxAmount, total: pricing.total, duration };
    }, []);

    const syncBookingFormCartTotals = useCallback((draft) => {
        const totals = calculateBookingCartTotals(
            draft.cartItems || [],
            activeBranch.taxRate,
            draft.customDiscountAmount || 0,
            draft.customDiscountPercent || 0,
            draft.promoDiscount || 0
        );
        return {
            ...draft,
            subtotal: totals.subtotal,
            tax: totals.tax,
            price: totals.total,
            duration: totals.duration || draft.duration || 0
        };
    }, [activeBranch.taxRate, calculateBookingCartTotals]);

    const updateBookingCartItem = useCallback((cartId, field, value) => {
        setBookingForm(prev => syncBookingFormCartTotals({
            ...prev,
            cartItems: (prev.cartItems || []).map(item => item.cartId === cartId ? { ...item, [field]: value } : item)
        }));
    }, [syncBookingFormCartTotals]);

    const addBookingServiceLine = useCallback(() => {
        setBookingForm(prev => syncBookingFormCartTotals({
            ...prev,
            cartItems: [
                ...(prev.cartItems || []),
                {
                    cartId: `line-${Date.now()}`,
                    name: "New Service",
                    optionName: "Configured Service",
                    bathroomKey: "",
                    durationHrs: 1,
                    price: 0,
                    addons: []
                }
            ]
        }));
    }, [syncBookingFormCartTotals]);

    const removeBookingServiceLine = useCallback((cartId) => {
        setBookingForm(prev => syncBookingFormCartTotals({
            ...prev,
            cartItems: (prev.cartItems || []).filter(item => item.cartId !== cartId)
        }));
    }, [syncBookingFormCartTotals]);

    const handleBookingSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        const durationNum = parseFloat(bookingForm.duration || 2);
        try {
            const headers = await getAuthHeaders();
            const bookingCartTotals = calculateBookingCartTotals(
                bookingForm.cartItems || [],
                activeBranch.taxRate,
                bookingForm.customDiscountAmount || 0,
                bookingForm.customDiscountPercent || 0,
                bookingForm.promoDiscount || 0
            );
            const payload = isCleanerBookingEditor
                ? {
                    id: bookingForm.id,
                    status: bookingForm.status,
                    cleanerChecklist: {
                        tasks: (activeCleanerJobDraft?.tasks || []).map(task => ({
                            id: task.id,
                            label: task.label,
                            completed: task.completed || false,
                            beforePhotos: (task.beforePhotos || []).filter(p => p.url).map(p => ({ id: p.id, name: p.name, url: p.url })),
                            afterPhotos: (task.afterPhotos || []).filter(p => p.url).map(p => ({ id: p.id, name: p.name, url: p.url }))
                        }))
                    }
                }
                : {
                    ...bookingForm,
                    clientName: `${bookingForm.firstName} ${bookingForm.lastName}`.trim(),
                    cartItems: bookingForm.cartItems || [],
                    servicesChanged: bookingServicesChanged,
                    priceOverride: isSuperAdmin && bookingPriceOverrideOpen,
                    subtotal: bookingCartTotals.subtotal,
                    tax: bookingCartTotals.tax,
                    price: bookingCartTotals.total,
                    duration: bookingCartTotals.duration || durationNum
                };

            // Recurring turned on for a booking that isn't in a series yet:
            // stamp a series id now so the children link back to this booking.
            const startsNewSeries = !isCleanerBookingEditor && payload.isRecurring && !payload.recurringSeriesId;
            if (startsNewSeries) {
                payload.recurringSeriesId = `rec-${Date.now()}`;
                payload.recurringIndex = 0;
            }

            const res = await fetch("/api/bookings", {
                method: "PUT",
                headers,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                let recurringMessage = "";
                if (startsNewSeries) {
                    const frequency = RECURRING_FREQUENCIES.includes(payload.frequency) ? payload.frequency : "Weekly";
                    const dates = generateRecurringDates(payload.date, frequency, 3);
                    const created = await createRecurringChildren(payload, dates, 1);
                    recurringMessage = ` ${created} ${frequency.toLowerCase()} occurrence(s) booked for the next 3 months.`;
                } else if (!isCleanerBookingEditor && payload.status === "Completed") {
                    await maybeExtendRecurringSeries(payload);
                }
                alert(`${data.message || "Booking updated."}${recurringMessage}`);
                setBookingModalOpen(false);
                syncDatabaseData(currentUser);
            } else {
                const err = await res.json();
                alert(`Operation Failed: ${err.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleDeleteBooking = async (id) => {
        if (!confirm("Are you sure you want to cancel this scheduled cleaning booking?")) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/bookings?id=${id}`, {
                method: "DELETE",
                headers
            });

            if (res.ok) {
                alert("Booking soft-cancelled successfully.");
                syncDatabaseData(currentUser);
            } else {
                const err = await res.json();
                alert(`Cancellation Failed: ${err.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const openBookingDocumentWindow = useCallback((booking) => {
        if (typeof window === "undefined" || !booking) return null;
        const popup = window.open("", "_blank", "width=1024,height=900");
        if (!popup) {
            alert("Please allow popups to open the document preview.");
            return null;
        }
        const companySnapshot = {
            ...(booking.companySnapshot || {}),
            logoUrl: `${window.location.origin}/logo-full.png`,
            promotions: promotionRules,
            documentCopy
        };
        popup.document.open();
        const customerPortalUrl = `${window.location.origin}/customer-access?phone=${encodeURIComponent(String(booking.customerPortalPhone || booking.phone || "").replace(/\D+/g, ""))}&document=${encodeURIComponent(booking.invoiceNumber || booking.estimateNumber || booking.orderNumber || "")}&bookingId=${encodeURIComponent(booking.id || "")}`;
        popup.document.write(buildBookingDocumentHtml({ ...booking, companySnapshot, customerPortalUrl }));
        popup.document.close();
        return popup;
    }, [documentCopy, promotionRules]);

    const handleDownloadBookingDocument = useCallback(async (booking) => {
        if (!booking?.id) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/bookings/document?bookingId=${encodeURIComponent(booking.id)}&disposition=attachment`, {
                method: "GET",
                headers
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to generate PDF.");
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${getBookingDocumentNumber(booking)}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert(`PDF download failed: ${error.message}`);
        }
    }, [getAuthHeaders]);

    const handleGenerateInvoice = useCallback(async (booking) => {
        if (!booking?.id) return;
        try {
            const headers = await getAuthHeaders();
            const payload = {
                ...booking,
                id: booking.id,
                status: booking.status || "Completed",
                paymentStatus: booking.paymentStatus || "unpaid",
                documentStage: "invoice",
                invoiceNumber: booking.invoiceNumber || booking.orderNumber || "",
                estimateNumber: booking.estimateNumber || booking.orderNumber || ""
            };
            const res = await fetch("/api/bookings", {
                method: "PUT",
                headers,
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to generate invoice.");
            alert("Invoice generated successfully.");
            syncDatabaseData(currentUser);
        } catch (error) {
            alert(`Invoice generation failed: ${error.message}`);
        }
    }, [currentUser, getAuthHeaders, syncDatabaseData]);

    const handleSendBookingDocument = useCallback(async (booking) => {
        if (!booking?.id) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/bookings/document", {
                method: "POST",
                headers,
                body: JSON.stringify({ bookingId: booking.id })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to send document.");
            alert(data.message || "Document sent to client.");
        } catch (error) {
            alert(`Document send failed: ${error.message}`);
        }
    }, [getAuthHeaders]);

    const handleApproveBooking = useCallback(async (booking) => {
        if (!booking?.id) return;
        if (!window.confirm(`Approve and confirm job for ${booking.clientName}? Status will move to Confirmed.`)) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/bookings/approve", {
                method: "POST",
                headers,
                body: JSON.stringify({ bookingId: booking.id })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to approve booking.");
            alert(data.message || "Booking approved and client notified.");
            setDetailsModalOpen(false);
            syncDatabaseData(currentUser);
        } catch (error) {
            alert(`Approval failed: ${error.message}`);
        }
    }, [currentUser, getAuthHeaders, syncDatabaseData]);

    const handleSendReceipt = useCallback(async (booking) => {
        if (!booking?.id) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/bookings/receipt", {
                method: "POST",
                headers,
                body: JSON.stringify({ bookingId: booking.id })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to send receipt.");
            alert(data.message || "Receipt sent to client.");
        } catch (error) {
            alert(`Receipt send failed: ${error.message}`);
        }
    }, [getAuthHeaders]);

    // Create the future occurrences of a recurring series by cloning a source
    // booking. Per-occurrence fields (numbers, promos, checklists, audit) are
    // stripped so the server issues fresh ones. Runs sequentially so booking
    // order numbers are generated without racing.
    const createRecurringChildren = useCallback(async (source, dates = [], startIndex = 1) => {
        const {
            id: _id, orderNumber: _orderNumber, estimateNumber: _estimateNumber, invoiceNumber: _invoiceNumber,
            auditLog: _auditLog, cleanerChecklist: _cleanerChecklist, createdAt: _createdAt, createdBy: _createdBy,
            documentLastSentAt: _sentAt, documentLastSentBy: _sentBy, customerConfirmed: _confirmed,
            promoCode: _promoCode, promoName: _promoName, promoType: _promoType, promoDiscount: _promoDiscount,
            referredByCode: _referredByCode, documentStage: _documentStage,
            ...base
        } = source;
        const headers = await getAuthHeaders();
        let created = 0;
        for (let i = 0; i < dates.length; i++) {
            const res = await fetch("/api/bookings", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    ...base,
                    id: `bk-${Date.now()}-r${startIndex + i}`,
                    date: dates[i],
                    isRecurring: true,
                    recurringIndex: startIndex + i,
                    paymentStatus: "unpaid",
                    promoCode: "",
                    giftCardCode: ""
                })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Failed to create occurrence for ${dates[i]} (${created} of ${dates.length} created).`);
            }
            created++;
        }
        return created;
    }, [getAuthHeaders]);

    // When the LAST occurrence of a recurring series closes out, book the next
    // 3 months automatically so recurring clients never fall off the schedule.
    const maybeExtendRecurringSeries = useCallback(async (booking) => {
        try {
            if (!booking?.isRecurring || !booking.recurringSeriesId || !booking.date) return;
            const frequency = RECURRING_FREQUENCIES.includes(booking.frequency) ? booking.frequency : "Weekly";
            const hasLaterOccurrence = bookings.some(b =>
                b.recurringSeriesId === booking.recurringSeriesId &&
                b.id !== booking.id &&
                b.status !== "Cancelled" &&
                (b.date || "") > booking.date
            );
            if (hasLaterOccurrence) return;
            const dates = generateRecurringDates(booking.date, frequency, 3);
            if (!dates.length) return;
            const nextIndex = (Number(booking.recurringIndex) || 0) + 1;
            const created = await createRecurringChildren({ ...booking, status: "Confirmed" }, dates, nextIndex);
            syncDatabaseData(currentUser);
            alert(`Recurring series extended: ${created} new ${frequency.toLowerCase()} booking(s) added for the next 3 months.`);
        } catch (err) {
            alert(`Could not auto-extend the recurring series: ${err.message}`);
        }
    }, [bookings, createRecurringChildren, currentUser, syncDatabaseData]);

    const handleQuickBookingUpdate = useCallback(async (bookingId, fields) => {
        try {
            const headers = await getAuthHeaders();
            const existing = bookings.find(b => b.id === bookingId) || {};
            const res = await fetch("/api/bookings", {
                method: "PUT",
                headers,
                body: JSON.stringify({ ...existing, id: bookingId, ...fields })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Update failed");
            setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...fields } : b));
            if (fields.status === "Completed") {
                await maybeExtendRecurringSeries({ ...existing, ...fields, id: bookingId });
            }
        } catch (err) {
            alert(`Quick update failed: ${err.message}`);
        }
    }, [bookings, getAuthHeaders, maybeExtendRecurringSeries]);

    const openCustomerProfile = useCallback((booking) => {
        const key = customerKeyForBooking(booking);
        if (key) setCrmCustomerKey(key);
    }, []);

    // ----------------------------------------------------
    // Admin Crew Creation Actions
    // ----------------------------------------------------
    const handleTeamSubmit = async (e) => {
        e.preventDefault();
        if (!teamForm.id || !teamForm.name) return alert("Please fill required crew parameters.");
        try {
            const headers = await getAuthHeaders();
            const isEdit = teams.some(t => t.id === teamForm.id);
            const res = await fetch("/api/teams", {
                method: isEdit ? "PUT" : "POST",
                headers,
                body: JSON.stringify(teamForm)
            });

            if (res.ok) {
                alert(isEdit ? "Cleaning crew updated successfully!" : "Cleaning crew dispatched successfully!");
                setTeamModalOpen(false);
                syncDatabaseData(currentUser);
            } else {
                const err = await res.json();
                alert(`Failed to save crew: ${err.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleDeleteTeam = async (teamId) => {
        if (!window.confirm("Are you sure you want to delete this cleaning crew?")) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/teams?id=${teamId}`, {
                method: "DELETE",
                headers
            });

            if (res.ok) {
                alert("Cleaning crew deleted successfully!");
                syncDatabaseData(currentUser);
            } else {
                const err = await res.json();
                alert(`Failed to delete crew: ${err.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    // ----------------------------------------------------
    // User Profile & Security Settings Handlers
    // ----------------------------------------------------
    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        if (!profileName.trim()) return alert("Name cannot be empty.");
        setProfileLoading(true);
        try {
            const user = auth.currentUser;
            if (user) {
                await updateProfile(user, { displayName: profileName });
            }

            const headers = await getAuthHeaders();
            const res = await fetch("/api/users", {
                method: "PUT",
                headers,
                body: JSON.stringify({ updateSelf: true, name: profileName })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update profile name.");
            }

            const data = await res.json();
            setCurrentUser(data.user);
            alert("Profile name updated successfully!");
        } catch (err) {
            console.error("Profile update failed", err);
            alert(`Error updating profile: ${err.message}`);
        } finally {
            setProfileLoading(false);
        }
    };

    const handleProfilePhotoCapture = async (file) => {
        if (!file || !currentUser) return;
        setProfilePhotoUploading(true);
        setProfilePhotoStatus("");
        setStaffProfileFeedback("");
        try {
            const headers = await getAuthHeaders();
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch("/api/uploads/profile-photo", {
                method: "POST",
                headers: {
                    Authorization: headers.Authorization
                },
                body: formData
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadData.error || "Failed to upload profile photo.");
            const photoURL = uploadData.photoURL;

            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { photoURL });
            }

            const optimisticUser = normalizeStaffMember({
                ...currentUser,
                photoURL
            });
            setCurrentUser(optimisticUser);
            if (selectedStaffUid === currentUser.uid) {
                setStaffProfileDraftOwnerUid(currentUser.uid);
            }

            const res = await fetch("/api/users", {
                method: "PUT",
                headers,
                body: JSON.stringify({ updateSelf: true, photoURL })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save profile photo.");
            setCurrentUser(data.user);
            setSelectedStaffUid(data.user.uid);
            syncDatabaseData(data.user);
            setProfilePhotoStatus("Profile photo uploaded successfully.");
            setStaffProfileFeedback("Profile photo updated successfully.");
        } catch (err) {
            setProfilePhotoStatus(err.message || "Failed to upload profile photo.");
            setStaffProfileFeedback(err.message || "Failed to upload profile photo.");
        } finally {
            setProfilePhotoUploading(false);
        }
    };

    const handleStaffDocumentUpload = async (file, fieldKey = "documentUpload", successLabel = "Document") => {
        if (!file || !activeStaffProfileDraft || !selectedStaffMember) return;
        setStaffDocumentUploading(true);
        setStaffProfileFeedback("");
        try {
            const headers = await getAuthHeaders();
            const formData = new FormData();
            formData.append("file", file);
            formData.append("kind", fieldKey);
            const res = await fetch("/api/uploads/staff-document", {
                method: "POST",
                headers: {
                    Authorization: headers.Authorization
                },
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to upload document.");
            updateStaffDraftField("eligibility", fieldKey, buildDocumentMeta(file, data.url));
            setStaffProfileFeedback(`${successLabel} uploaded and attached to this profile.`);
        } catch (err) {
            setStaffProfileFeedback(err.message || "Failed to upload document.");
        } finally {
            setStaffDocumentUploading(false);
        }
    };

    const addBlockedDateToDraft = () => {
        if (!blockedDateInput || !activeStaffProfileDraft) return;
        const nextDates = normalizeBlockedDateList([
            ...(activeStaffProfileDraft.availability.blockedDates || []),
            blockedDateInput
        ]);
        updateStaffDraftField("availability", "blockedDates", nextDates);
        setBlockedDateInput("");
    };

    const removeBlockedDateFromDraft = (value) => {
        if (!activeStaffProfileDraft) return;
        const nextDates = (activeStaffProfileDraft.availability.blockedDates || []).filter(date => date !== value);
        updateStaffDraftField("availability", "blockedDates", nextDates);
    };


    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (securityForm.newPassword !== securityForm.confirmPassword) {
            return alert("New passwords do not match.");
        }
        if (securityForm.newPassword.length < 6) {
            return alert("Password must be at least 6 characters long.");
        }

        setSecurityLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No authenticated user found.");
            // 1. Reauthenticate
            const credential = EmailAuthProvider.credential(user.email, securityForm.currentPassword);
            await reauthenticateWithCredential(user, credential);

            // 2. Update password
            await updatePassword(user, securityForm.newPassword);
            alert("Password updated successfully!");
            setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (err) {
            console.error("Password change failed", err);
            alert(`Error updating password: ${err.message}`);
        } finally {
            setSecurityLoading(false);
        }
    };

    const handleSaveV2Catalog = async (updatedCatalog) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/settings", {
                method: "POST",
                headers,
                body: JSON.stringify({ v2_catalog: updatedCatalog })
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to update V2 settings");
            }
            alert("V2 Dynamic Catalog saved successfully in database!");
        } catch (err) {
            alert("Failed to save V2 catalog: " + err.message);
        }
    };

    const handleSavePromotions = async () => {
        setPromotionSaving(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/settings", {
                method: "POST",
                headers,
                body: JSON.stringify({ v2_catalog: v2Catalog, promotions: promotionRules, documentCopy })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Failed to save promotions.");
            }
            alert("Promotions saved successfully.");
        } catch (error) {
            alert(`Promotion save failed: ${error.message}`);
        } finally {
            setPromotionSaving(false);
        }
    };

    const handleSaveLeadSources = async (sources) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/settings", {
                method: "POST",
                headers,
                body: JSON.stringify({ leadSources: sources })
            });
            if (!res.ok) throw new Error("Failed to save lead sources.");
            setLeadSources(sources);
        } catch (err) {
            alert(`Save failed: ${err.message}`);
        }
    };

    const updateDocumentCopyField = (field, value) => {
        setDocumentCopy(prev => ({ ...prev, [field]: value }));
    };

    const updateStaffDraftField = useCallback((section, field, value) => {
        setStaffProfileDraft(prev => {
            const base = prev || normalizeStaffProfile(selectedStaffMember?.staffProfileRequest?.requestedProfile || selectedStaffMember?.staffProfile);
            if (!base) return prev;
            if (section === "notes") {
                return { ...base, notes: value };
            }
            return {
                ...base,
                [section]: {
                    ...(base[section] || {}),
                    [field]: value
                }
            };
        });
        setStaffProfileDraftOwnerUid(selectedStaffMember?.uid || "");
    }, [selectedStaffMember]);

    const handleSubmitStaffProfile = async () => {
        if (!selectedStaffMember || !activeStaffProfileDraft) return;
        setStaffProfileSaving(true);
        setStaffProfileFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/users", {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    updateSelfStaffProfile: true,
                    staffProfile: activeStaffProfileDraft
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to submit staff profile.");
            setCurrentUser(data.user);
            setStaffProfileDraftOwnerUid(data.user.uid);
            setStaffProfileDraft(normalizeStaffProfile(data.user.staffProfileRequest?.requestedProfile || data.user.staffProfile));
            setStaffProfileFeedback(data.message || "Profile saved.");
            syncDatabaseData(data.user);
        } catch (err) {
            setStaffProfileFeedback(err.message || "Failed to submit staff profile.");
        } finally {
            setStaffProfileSaving(false);
        }
    };

    const handleReviewStaffProfileRequest = async (action) => {
        if (!selectedStaffMember?.uid) return;
        setStaffProfileSaving(true);
        setStaffProfileFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/users", {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    reviewStaffProfileRequest: true,
                    targetUid: selectedStaffMember.uid,
                    action,
                    rejectionReason: staffProfileRejectReason
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to review staff profile request.");
            setStaffProfileFeedback(data.message || "Staff profile updated.");
            syncDatabaseData(currentUser);
        } catch (err) {
            setStaffProfileFeedback(err.message || "Failed to review staff profile request.");
        } finally {
            setStaffProfileSaving(false);
        }
    };

    const handleSaveStaffProfileDirect = async () => {
        if (!selectedStaffMember || !activeStaffProfileDraft) return;
        setStaffProfileSaving(true);
        setStaffProfileFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/users", {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    updateStaffProfileDirect: true,
                    targetUid: selectedStaffMember.uid,
                    staffProfile: activeStaffProfileDraft
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save staff profile.");
            setStaffProfileFeedback(data.message || "Staff profile updated.");
            setStaffProfileEditOpen(false);
            syncDatabaseData(currentUser);
        } catch (err) {
            setStaffProfileFeedback(err.message || "Failed to save staff profile.");
        } finally {
            setStaffProfileSaving(false);
        }
    };

    const handleUpdateEmploymentStatus = async (targetUid, employmentStatus) => {
        if (!targetUid) return;
        setStaffProfileSaving(true);
        setStaffProfileFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/users", {
                method: "PUT",
                headers,
                body: JSON.stringify({ targetUid, employmentStatus })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update employment status.");
            setStaffProfileFeedback(`Employment status set to ${employmentStatus}.`);
            syncDatabaseData(currentUser);
        } catch (err) {
            setStaffProfileFeedback(err.message || "Failed to update employment status.");
        } finally {
            setStaffProfileSaving(false);
        }
    };

    const handleExpenseReceiptCapture = async (file) => {
        if (!file) return;
        setExpenseReceiptUploading(true);
        setExpenseFeedback("");
        try {
            const headers = await getAuthHeaders();
            delete headers["Content-Type"];
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/uploads/expense-receipt", {
                method: "POST",
                headers,
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to upload receipt.");
            setExpenseForm(prev => ({ ...prev, receiptUrl: data.url, receiptName: data.name }));
        } catch (err) {
            setExpenseFeedback(err.message || "Failed to upload receipt.");
        } finally {
            setExpenseReceiptUploading(false);
        }
    };

    const handleSubmitExpense = async () => {
        if (!expenseForm.amount || !expenseForm.receiptUrl) {
            setExpenseFeedback("A receipt photo and amount are required.");
            return;
        }
        setExpenseSubmitting(true);
        setExpenseFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/expenses", {
                method: "POST",
                headers,
                body: JSON.stringify(expenseForm)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to submit expense.");
            setExpenseFeedback(data.message || "Expense submitted for approval.");
            setExpenseForm({ amount: "", category: "Cleaning Supplies", description: "", date: new Date().toISOString().split("T")[0], receiptUrl: "", receiptName: "", paymentMethod: "Personal (Reimbursable)", isReimbursable: true });
            syncDatabaseData(currentUser);
        } catch (err) {
            setExpenseFeedback(err.message || "Failed to submit expense.");
        } finally {
            setExpenseSubmitting(false);
        }
    };

    const handleReviewExpense = async (expenseId, action) => {
        setExpenseSubmitting(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/expenses", {
                method: "PUT",
                headers,
                body: JSON.stringify({ action, expenseId, rejectionReason: expenseRejectReason[expenseId] || "" })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to review expense.");
            setExpenseFeedback(data.message || `Expense ${action}d.`);
            syncDatabaseData(currentUser);
        } catch (err) {
            setExpenseFeedback(err.message || "Failed to review expense.");
        } finally {
            setExpenseSubmitting(false);
        }
    };

    const ensureCleanerJobDraft = useCallback((booking) => {
        if (!booking?.id) return null;
        const tasks = buildCleanerTaskList(booking, pricingRates, v2Catalog);
        const nextDraft = {
            bookingId: booking.id,
            tasks: tasks.map(task => ({
                ...task,
                completed: false,
                beforePhotos: [],
                afterPhotos: []
            }))
        };

        setCleanerJobDrafts(prev => {
            if (prev[booking.id]) return prev;
            return {
                ...prev,
                [booking.id]: nextDraft
            };
        });

        return cleanerJobDrafts[booking.id] || nextDraft;
    }, [cleanerJobDrafts, pricingRates, v2Catalog]);

    const updateCleanerJobPhotos = useCallback(async (bookingId, taskId, phase, files) => {
        const fileArray = Array.from(files || []);
        if (!fileArray.length) return;
        const placeholders = fileArray.map((file, i) => ({
            id: `uploading-${taskId}-${Date.now()}-${i}`,
            name: file.name || "photo",
            url: null,
            uploading: true
        }));
        setCleanerJobDrafts(prev => {
            const bookingDraft = prev[bookingId];
            if (!bookingDraft) return prev;
            return {
                ...prev,
                [bookingId]: {
                    ...bookingDraft,
                    tasks: bookingDraft.tasks.map(task => {
                        if (task.id !== taskId) return task;
                        return { ...task, [phase]: [...task[phase], ...placeholders] };
                    })
                }
            };
        });
        const headers = await getAuthHeaders();
        const results = await Promise.all(fileArray.map(async (file, i) => {
            try {
                const form = new FormData();
                form.append("file", file);
                form.append("bookingId", bookingId);
                form.append("taskId", taskId);
                form.append("phase", phase);
                const res = await fetch("/api/uploads/job-photo", {
                    method: "POST",
                    headers: { "Authorization": headers["Authorization"] },
                    body: form
                });
                const data = await res.json();
                return { id: placeholders[i].id, name: file.name || "photo", url: data.url || null, uploading: false };
            } catch {
                return { id: placeholders[i].id, name: file.name || "photo", url: null, uploading: false };
            }
        }));
        setCleanerJobDrafts(prev => {
            const bookingDraft = prev[bookingId];
            if (!bookingDraft) return prev;
            const placeholderIds = new Set(placeholders.map(p => p.id));
            return {
                ...prev,
                [bookingId]: {
                    ...bookingDraft,
                    tasks: bookingDraft.tasks.map(task => {
                        if (task.id !== taskId) return task;
                        const existing = task[phase].filter(p => !placeholderIds.has(p.id));
                        return { ...task, [phase]: [...existing, ...results] };
                    })
                }
            };
        });
    }, [getAuthHeaders]);

    const removeCleanerJobPhoto = useCallback((bookingId, taskId, phase, photoId) => {
        setCleanerJobDrafts(prev => {
            const bookingDraft = prev[bookingId];
            if (!bookingDraft) return prev;
            return {
                ...prev,
                [bookingId]: {
                    ...bookingDraft,
                    tasks: bookingDraft.tasks.map(task => {
                        if (task.id !== taskId) return task;
                        return {
                            ...task,
                            [phase]: task[phase].filter(photo => photo.id !== photoId)
                        };
                    })
                }
            };
        });
    }, []);

    const toggleCleanerTaskComplete = useCallback((bookingId, taskId) => {
        setCleanerJobDrafts(prev => {
            const bookingDraft = prev[bookingId];
            if (!bookingDraft) return prev;
            return {
                ...prev,
                [bookingId]: {
                    ...bookingDraft,
                    tasks: bookingDraft.tasks.map(task => {
                        if (task.id !== taskId) return task;
                        return { ...task, completed: !task.completed };
                    })
                }
            };
        });
    }, []);

    const getCurrentLocation = useCallback(() => new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported on this device."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            }),
            (error) => reject(new Error(error.message || "Unable to access your location.")),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }), []);

    const geocodeBookingLocation = useCallback((booking) => new Promise((resolve) => {
        if (booking?.location?.lat && booking?.location?.lng) {
            resolve(booking.location);
            return;
        }
        if (!googlePlacesReady || !window.google?.maps?.Geocoder) {
            resolve(null);
            return;
        }
        const geocoder = new window.google.maps.Geocoder();
        const address = [booking?.address1, booking?.city, booking?.state, booking?.postalCode, booking?.country].filter(Boolean).join(", ");
        geocoder.geocode({ address }, (results, status) => {
            if (status !== "OK" || !results?.[0]?.geometry?.location) {
                resolve(null);
                return;
            }
            resolve({
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng()
            });
        });
    }), [googlePlacesReady]);

    const handleClockIntoJob = useCallback(async (booking) => {
        if (!booking) return;
        setTimeEntrySaving(true);
        setJobsFeedback("");
        try {
            const headers = await getAuthHeaders();
            const currentLocation = await getCurrentLocation();
            const jobLocation = await geocodeBookingLocation(booking);
            const res = await fetch("/api/time-entries", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    bookingId: booking.id,
                    currentLocation,
                    jobLocation
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to check into job.");
            setJobsFeedback(data.message || "Checked in successfully.");
            syncDatabaseData(currentUser);
        } catch (error) {
            setJobsFeedback(error.message || "Failed to check into job.");
        } finally {
            setTimeEntrySaving(false);
        }
    }, [currentUser, geocodeBookingLocation, getAuthHeaders, getCurrentLocation, syncDatabaseData]);

    const handleClockOutOfJob = useCallback(async () => {
        if (!activeTimeEntry) return;
        setTimeEntrySaving(true);
        setJobsFeedback("");
        try {
            const headers = await getAuthHeaders();
            const currentLocation = await getCurrentLocation();
            const res = await fetch("/api/time-entries", {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    action: "checkout",
                    entryId: activeTimeEntry.id,
                    currentLocation
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to check out of job.");
            setJobsFeedback(data.message || "Checked out successfully.");
            syncDatabaseData(currentUser);
        } catch (error) {
            setJobsFeedback(error.message || "Failed to check out of job.");
        } finally {
            setTimeEntrySaving(false);
        }
    }, [activeTimeEntry, currentUser, getAuthHeaders, getCurrentLocation, syncDatabaseData]);

    const handleOpenCleanerJob = (booking, nextTab = "overview") => {
        if (!booking) return;
        ensureCleanerJobDraft(booking);
        setCleanerJobTab(nextTab);
        openEditBookingModal(booking);
    };

    const handleStartCleanerJob = useCallback(async (booking) => {
        if (!booking) return;
        ensureCleanerJobDraft(booking);
        await handleClockIntoJob(booking);
    }, [ensureCleanerJobDraft, handleClockIntoJob]);

    const handleEndCleanerJob = useCallback(async (booking) => {
        if (!booking || !activeTimeEntry || activeTimeEntry.bookingId !== booking.id) return;
        await handleClockOutOfJob();
        setPendingAfterPhotos(prev => ({ ...prev, [booking.id]: true }));
    }, [activeTimeEntry, handleClockOutOfJob]);

    const handleSubmitJobForReview = useCallback(async (booking) => {
        if (!booking?.id) return;
        setTimeEntrySaving(true);
        setJobsFeedback("");
        try {
            const headers = await getAuthHeaders();
            const draft = cleanerJobDrafts[booking.id];
            const cleanerChecklist = {
                submittedAt: new Date().toISOString(),
                tasks: (draft?.tasks || []).map(task => ({
                    id: task.id,
                    label: task.label,
                    completed: task.completed || false,
                    beforePhotos: (task.beforePhotos || []).filter(p => p.url).map(p => ({ id: p.id, name: p.name, url: p.url })),
                    afterPhotos: (task.afterPhotos || []).filter(p => p.url).map(p => ({ id: p.id, name: p.name, url: p.url }))
                }))
            };
            const res = await fetch("/api/bookings", {
                method: "PUT",
                headers,
                body: JSON.stringify({ id: booking.id, status: booking.status, cleanerChecklist })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to submit job for review.");
            }
            setPendingAfterPhotos(prev => { const next = { ...prev }; delete next[booking.id]; return next; });
            setBookingModalOpen(false);
            syncDatabaseData(currentUser);
        } catch (err) {
            setJobsFeedback(err.message || "Failed to submit job.");
        } finally {
            setTimeEntrySaving(false);
        }
    }, [cleanerJobDrafts, currentUser, getAuthHeaders, syncDatabaseData]);

    const addCleanerExtraTask = useCallback((bookingId, label) => {
        if (!label?.trim()) return;
        setCleanerJobDrafts(prev => {
            const draft = prev[bookingId];
            if (!draft) return prev;
            return {
                ...prev,
                [bookingId]: {
                    ...draft,
                    tasks: [...draft.tasks, {
                        id: `extra-${Date.now()}`,
                        label: label.trim(),
                        requiresPhoto: false,
                        completed: false,
                        beforePhotos: [],
                        afterPhotos: []
                    }]
                }
            };
        });
    }, []);

    const handleAdminClockInFor = useCallback(async ({ cleanerUid, bookingId, startedAt }) => {
        setTimeEntrySaving(true);
        setJobsFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/time-entries", {
                method: "POST",
                headers,
                body: JSON.stringify({ action: "admin_checkin", cleanerUid, bookingId, startedAt: localDtToIso(startedAt) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to clock in for staff member.");
            setJobsFeedback(data.message || "Clocked in successfully.");
            syncDatabaseData(currentUser);
        } catch (err) {
            setJobsFeedback(err.message || "Failed to clock in for staff.");
        } finally {
            setTimeEntrySaving(false);
        }
    }, [currentUser, getAuthHeaders, syncDatabaseData]);

    const handleAdminClockOutFor = useCallback(async ({ entryId, endedAt }) => {
        setTimeEntrySaving(true);
        setJobsFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/time-entries", {
                method: "PUT",
                headers,
                body: JSON.stringify({ action: "admin_checkout", entryId, endedAt: localDtToIso(endedAt) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to clock out for staff member.");
            setJobsFeedback(data.message || "Clocked out successfully.");
            syncDatabaseData(currentUser);
        } catch (err) {
            setJobsFeedback(err.message || "Failed to clock out for staff.");
        } finally {
            setTimeEntrySaving(false);
        }
    }, [currentUser, getAuthHeaders, syncDatabaseData]);

    const handleReviewTimeEntry = useCallback(async (entryId, action) => {
        setTimeEntrySaving(true);
        try {
            const headers = await getAuthHeaders();
            const editDraft = timeEntryEditDrafts[entryId];
            const res = await fetch("/api/time-entries", {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    entryId,
                    action,
                    startedAt: localDtToIso(editDraft?.startedAt),
                    endedAt: localDtToIso(editDraft?.endedAt),
                    unpaidBreakMinutes: editDraft?.unpaidBreakMinutes
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to review time entry.");
            setTimeEntryEditDrafts(prev => {
                const next = { ...prev };
                delete next[entryId];
                return next;
            });
            syncDatabaseData(currentUser);
        } catch (error) {
            alert(error.message || "Failed to review time entry.");
        } finally {
            setTimeEntrySaving(false);
        }
    }, [currentUser, getAuthHeaders, syncDatabaseData, timeEntryEditDrafts]);

    const handleCreateManualTimeEntry = useCallback(async () => {
        if (!manualTimeEntryForm.cleanerUid || !manualTimeEntryForm.startedAt || !manualTimeEntryForm.endedAt) {
            alert("Cleaner, start time, and finish time are required.");
            return;
        }
        setTimeEntrySaving(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/time-entries", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    action: "admin_create_manual",
                    cleanerUid: manualTimeEntryForm.cleanerUid,
                    bookingId: manualTimeEntryForm.bookingId || "",
                    startedAt: localDtToIso(manualTimeEntryForm.startedAt),
                    endedAt: localDtToIso(manualTimeEntryForm.endedAt),
                    unpaidBreakMinutes: manualTimeEntryForm.unpaidBreakMinutes || 0
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create manual time card.");
            setManualTimeEntryForm({
                cleanerUid: "",
                bookingId: "",
                startedAt: "",
                endedAt: "",
                unpaidBreakMinutes: 0
            });
            syncDatabaseData(currentUser);
        } catch (error) {
            alert(error.message || "Failed to create manual time card.");
        } finally {
            setTimeEntrySaving(false);
        }
    }, [currentUser, getAuthHeaders, manualTimeEntryForm, syncDatabaseData]);

    const handleEditTimeEntry = useCallback(async (entryId, { startedAt, endedAt, unpaidBreakMinutes }) => {
        setTimeEntrySaving(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/time-entries", {
                method: "PUT",
                headers,
                body: JSON.stringify({ action: "admin_edit", entryId, startedAt: localDtToIso(startedAt), endedAt: localDtToIso(endedAt), unpaidBreakMinutes })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Edit failed.");
            setTimeEntryEditDrafts(prev => { const next = { ...prev }; delete next[entryId]; return next; });
            setJobsFeedback("Time entry updated.");
            syncDatabaseData(currentUser);
        } catch (err) {
            setJobsFeedback(`Error: ${err.message}`);
        } finally {
            setTimeEntrySaving(false);
        }
    }, [currentUser, getAuthHeaders, syncDatabaseData]);

    const handleDeleteTimeEntry = useCallback(async (entryId) => {
        if (!confirm("Soft-delete this time entry? It will be hidden from all views.")) return;
        setTimeEntrySaving(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/time-entries?id=${encodeURIComponent(entryId)}`, { method: "DELETE", headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Delete failed.");
            setJobsFeedback("Time entry deleted.");
            syncDatabaseData(currentUser);
        } catch (err) {
            setJobsFeedback(`Error: ${err.message}`);
        } finally {
            setTimeEntrySaving(false);
        }
    }, [currentUser, getAuthHeaders, syncDatabaseData]);

    // ----------------------------------------------------
    // Admin Review Merges (Approvals / Rejections)
    // ----------------------------------------------------
    const handleResolveEdit = async (requestId, action) => {
        try {
            const headers = await getAuthHeaders();
            const resolution = editRequestResolutions[requestId] || {};
            const res = await fetch("/api/edit-requests", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    requestId,
                    action,
                    finalStatus: resolution.finalStatus,
                    paymentStatus: resolution.paymentStatus
                })
            });

            if (res.ok) {
                alert(`Edit request ${action === "approve" ? "approved & merged" : "rejected"} successfully!`);
                setEditRequestResolutions(prev => {
                    const next = { ...prev };
                    delete next[requestId];
                    return next;
                });
                syncDatabaseData(currentUser);
            } else {
                const err = await res.json();
                alert(`Failed: ${err.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleResolveJobCompletion = async (requestId, action) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/edit-requests", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    requestId,
                    action,
                    finalStatus: action === "approve" ? "Completed" : undefined
                })
            });
            if (res.ok) {
                syncDatabaseData(currentUser);
            } else {
                const err = await res.json();
                alert(`Failed: ${err.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleResolveUserApproval = async (targetUid, action) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/users", {
                method: "POST",
                headers,
                body: JSON.stringify({ targetUid, action })
            });

            if (res.ok) {
                alert(`User cleaner account resolved successfully!`);
                syncDatabaseData(currentUser);
            } else {
                const err = await res.json();
                alert(`Failed to resolve cleaner account: ${err.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const getCategoryBasePrice = useCallback((category) => {
        if (!category) return 0;
        if (category.sizes?.length) return parseFloat(category.sizes[0].price || 0);
        return parseFloat(category.baseRate || 0);
    }, []);

    const getCategoryDuration = useCallback((category) => {
        if (!category) return 0;
        if (category.sizes?.length) return parseFloat(category.sizes[0].durationHrs || 0);
        return parseFloat(category.durationHrs || 0);
    }, []);

    const openServiceConfigurator = useCallback((category, target = "checkout") => {
        const firstServiceType = category.serviceTypes?.[0]?.id || "";
        const firstPropertyType = category.propertyTypes?.[0]?.id || "";
        const firstSizeForPropType = firstPropertyType
            ? (category.sizes || []).find(s => s.propertyTypeId === firstPropertyType)?.id
            : category.sizes?.[0]?.id;
        setServiceConfigTarget(target);
        setConfigCategory(category);
        setConfigServiceTypeId(firstServiceType);
        setConfigPropertyTypeId(firstPropertyType);
        setConfigSizeId(firstSizeForPropType || category.sizes?.[0]?.id || "base");
        setConfigBathroomKey("1 Bathroom");
        setConfigAddons({});
        setConfigEditingCartId("");
        setServiceConfigOpen(true);
    }, []);

    const editAdminCartItem = useCallback((item, target = "checkout") => {
        const category = (v2Catalog.categories || []).find(candidate => candidate.id === item.categoryId || candidate.name === item.name) || {
            id: item.categoryId,
            name: item.name,
            pricingModel: item.pricingModel,
            baseRate: item.basePrice,
            durationHrs: item.durationHrs,
            sizes: item.optionId && item.optionId !== "base"
                ? [{ id: item.optionId, name: item.optionName, price: item.basePrice, durationHrs: item.durationHrs }]
                : [],
            addons: item.addons || []
        };
        const addonMap = {};
        (item.addons || []).forEach(addon => {
            addonMap[addon.id] = Number(addon.qty || 1);
        });
        const restoredServiceTypeId = item.serviceTypeId || category.serviceTypes?.[0]?.id || "";
        const restoredPropertyTypeId = item.propertyTypeId || category.propertyTypes?.[0]?.id || "";
        setServiceConfigTarget(target);
        setConfigCategory(category);
        setConfigServiceTypeId(restoredServiceTypeId);
        setConfigPropertyTypeId(restoredPropertyTypeId);
        setConfigSizeId(item.optionId || category.sizes?.[0]?.id || "base");
        setConfigBathroomKey(item.bathroomKey || "1 Bathroom");
        setConfigAddons(addonMap);
        setConfigEditingCartId(item.cartId);
        setServiceConfigOpen(true);
    }, [v2Catalog.categories]);

    const setConfigAddonQty = useCallback((addonId, qty) => {
        setConfigAddons(prev => {
            const next = { ...prev };
            const cleanQty = Math.max(0, Number(qty) || 0);
            if (cleanQty <= 0) {
                delete next[addonId];
            } else {
                next[addonId] = cleanQty;
            }
            return next;
        });
    }, []);

    const addConfiguredServiceToCart = useCallback(() => {
        if (!configCategory) return;
        const selectedSize = configCategory.sizes?.find(size => size.id === configSizeId);
        const rawBasePrice = selectedSize ? parseFloat(selectedSize.price || 0) : getCategoryBasePrice(configCategory);
        const baseDuration = selectedSize ? parseFloat(selectedSize.durationHrs || 0) : getCategoryDuration(configCategory);

        // Service type multiplier
        const selectedServiceType = (configCategory.serviceTypes || []).find(st => st.id === configServiceTypeId);
        const serviceTypeMultiplier = parseFloat(selectedServiceType?.multiplier || 1.0);
        const basePrice = rawBasePrice * serviceTypeMultiplier;

        const isHouseCleaning = configCategory.hasBathrooms === true;
        const bathroomPrice = isHouseCleaning ? parseFloat(v2Catalog.bathrooms?.[configBathroomKey] || 0) : 0;

        // Property type name for display
        const selectedPropertyType = (configCategory.propertyTypes || []).find(pt => pt.id === configPropertyTypeId);

        const selectedAddons = (configCategory.addons || [])
            .map(addon => {
                const qty = Number(configAddons[addon.id] || 0);
                if (qty <= 0) return null;
                return {
                    id: addon.id,
                    name: addon.name,
                    price: parseFloat(addon.price || 0),
                    qty,
                    total: parseFloat(addon.price || 0) * qty
                };
            })
            .filter(Boolean);
        const addonTotal = selectedAddons.reduce((total, addon) => total + addon.total, 0);
        const configuredExtras = isHouseCleaning ? [{
            id: "bathrooms",
            name: configBathroomKey,
            price: bathroomPrice,
            qty: 1,
            total: bathroomPrice
        }] : [];

        const nextItem = {
            cartId: configEditingCartId || `${configCategory.id}-${Date.now()}`,
            categoryId: configCategory.id,
            name: configCategory.name,
            pricingModel: configCategory.pricingModel,
            serviceTypeId: selectedServiceType?.id || "",
            serviceTypeName: selectedServiceType?.name || "",
            serviceTypeMultiplier,
            propertyTypeId: selectedPropertyType?.id || "",
            propertyTypeName: selectedPropertyType?.name || "",
            optionId: selectedSize?.id || "base",
            optionName: selectedSize?.name || "Base service",
            basePrice,
            bathroomKey: isHouseCleaning ? configBathroomKey : "",
            bathroomPrice,
            price: basePrice + bathroomPrice + addonTotal,
            durationHrs: baseDuration,
            configuredExtras,
            addons: selectedAddons
        };
        const updateCart = (items) => configEditingCartId
            ? items.map(item => item.cartId === configEditingCartId ? nextItem : item)
            : [...items, nextItem];
        if (serviceConfigTarget === "booking") {
            setBookingServiceDraft(updateCart);
        } else {
            setAdminServiceCart(updateCart);
        }
        setConfigEditingCartId("");
        setServiceConfigOpen(false);
    }, [configAddons, configBathroomKey, configCategory, configEditingCartId, configPropertyTypeId, configServiceTypeId, configSizeId, getCategoryBasePrice, getCategoryDuration, serviceConfigTarget, v2Catalog.bathrooms]);

    const removeAdminCartItem = useCallback((cartId) => {
        setAdminServiceCart(prev => prev.filter(item => item.cartId !== cartId));
    }, []);

    const normalizeEditableBookingCartItems = useCallback((items = [], fallbackService = "Cleaning Service", fallbackDuration = 2, fallbackPrice = 0) => {
        if (!Array.isArray(items) || items.length === 0) {
            return [{
                cartId: `line-${Date.now()}`,
                name: fallbackService,
                optionName: "Standard Service",
                bathroomKey: "",
                durationHrs: Number(fallbackDuration || 0),
                price: Number(fallbackPrice || 0),
                addons: []
            }];
        }

        return items.map((item, index) => ({
            cartId: item.cartId || item.id || `line-${Date.now()}-${index}`,
            categoryId: item.categoryId || "",
            pricingModel: item.pricingModel || "",
            name: item.name || fallbackService,
            optionId: item.optionId || "",
            optionName: item.optionName || "Configured Service",
            serviceTypeId: item.serviceTypeId || "",
            serviceTypeName: item.serviceTypeName || "",
            serviceTypeMultiplier: item.serviceTypeMultiplier || 1,
            propertyTypeId: item.propertyTypeId || "",
            propertyTypeName: item.propertyTypeName || "",
            bathroomKey: item.bathroomKey || "",
            durationHrs: Number(item.durationHrs || item.duration || 0),
            price: Number(item.price || 0),
            addons: Array.isArray(item.addons) ? item.addons.map((addon, addonIndex) => ({
                id: addon.id || `addon-${index}-${addonIndex}`,
                name: addon.name || "Add-on",
                qty: Number(addon.qty || 1),
                price: Number(addon.price || 0)
            })) : []
        }));
    }, []);

    const openBookingServiceEditor = () => {
        setBookingServiceDraft(normalizeEditableBookingCartItems(
            bookingForm.cartItems,
            bookingForm.service || "Cleaning Service",
            bookingForm.duration || 2,
            bookingForm.subtotal || bookingForm.price || 0
        ));
        setBookingServiceCartOpen(true);
    };

    const bookingServiceDraftTotals = useMemo(() => {
        const subtotal = bookingServiceDraft.reduce((sum, item) => sum + Number(item.price || 0), 0);
        const duration = bookingServiceDraft.reduce((sum, item) => sum + Number(item.durationHrs || 0), 0);
        const tax = subtotal * Number(activeBranch.taxRate || 0);
        return { subtotal, duration, tax, total: subtotal + tax };
    }, [activeBranch.taxRate, bookingServiceDraft]);

    const applyBookingServiceDraft = () => {
        if (bookingServiceDraft.length === 0) {
            alert("Add at least one configured service before saving.");
            return;
        }
        setBookingForm(prev => syncBookingFormCartTotals({
            ...prev,
            service: bookingServiceDraft.map(item => item.name).join(" + "),
            cartItems: bookingServiceDraft
        }));
        setBookingServicesChanged(true);
        setBookingPriceOverrideOpen(false);
        setBookingServiceCartOpen(false);
    };

    const adminCartTotals = useMemo(() => {
        const subtotal = adminServiceCart.reduce((total, item) => total + parseFloat(item.price || 0), 0);
        const duration = adminServiceCart.reduce((total, item) => total + parseFloat(item.durationHrs || 0), 0);
        const taxRate = activeBranch.taxRate || 0;
        const tax = subtotal * taxRate;
        return {
            subtotal,
            tax,
            total: subtotal + tax,
            duration
        };
    }, [activeBranch.taxRate, adminServiceCart]);

    const checkoutAdminCart = useCallback(() => {
        const isCustomerUser = normalizeRole(currentUser?.role) === "customer";
        setAdminCheckoutForm(prev => ({
            ...prev,
            firstName: isCustomerUser ? (currentUser?.name?.split(" ")[0] || prev.firstName) : prev.firstName,
            lastName: isCustomerUser ? (currentUser?.name?.split(" ").slice(1).join(" ") || prev.lastName) : prev.lastName,
            phone: isCustomerUser ? (currentUser?.phone || prev.phone) : prev.phone,
            email: isCustomerUser ? (currentUser?.email || prev.email) : prev.email,
            customerLoggedIn: isCustomerUser
        }));
        setAdminCheckoutStep(isCustomerUser ? 1 : 0);
        setAdminCheckoutOpen(true);
    }, [currentUser]);

    const saveAdminCartBooking = useCallback(async (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (adminServiceCart.length === 0) {
            alert("Add at least one configured service before checkout.");
            return;
        }
        try {
            const discountAmount = parseFloat(adminCheckoutForm.discountAmount || 0);
            const discountPercent = parseFloat(adminCheckoutForm.discountPercent || 0);
            // Same canonical formula everywhere (lib/pricing.js) — promo isn't
            // known yet (the server validates it), so this preview excludes it;
            // the server will fold it in and it'll show as its own line item.
            const checkoutPricing = computeBookingPricing({
                subtotal: adminCartTotals.subtotal,
                customDiscountAmount: discountAmount,
                customDiscountPercent: discountPercent,
                promoDiscount: 0,
                taxRate: activeBranch.taxRate
            });
            const finalTotal = checkoutPricing.total;
            const matchedBranch = findBranchForAddress({
                city: adminCheckoutForm.city,
                country: adminCheckoutForm.country,
                postalCode: adminCheckoutForm.postalCode
            }) || activeBranch;
            const assignedStaff = fieldStaff
                .filter(member => adminCheckoutForm.assignedStaffIds.includes(member.uid))
                .map(member => ({
                    uid: member.uid,
                    name: member.name,
                    email: member.email,
                    role: member.role,
                    branchId: member.branchId || matchedBranch.id
                }));
            const recurringOn = Boolean(adminCheckoutForm.isRecurring);
            const recurringFrequency = RECURRING_FREQUENCIES.includes(adminCheckoutForm.recurringFrequency)
                ? adminCheckoutForm.recurringFrequency
                : "Weekly";
            const payload = {
                id: `bk-${Date.now()}`,
                isV2Booking: true,
                source: "admin_service_cart",
                branchId: matchedBranch.id,
                branchName: matchedBranch.name,
                timezone: matchedBranch.timezone,
                currency: matchedBranch.currency,
                taxLabel: matchedBranch.taxLabel,
                taxRate: matchedBranch.taxRate,
                clientName: `${adminCheckoutForm.firstName} ${adminCheckoutForm.lastName}`.trim(),
                firstName: adminCheckoutForm.firstName,
                lastName: adminCheckoutForm.lastName,
                phone: adminCheckoutForm.phone,
                email: adminCheckoutForm.email,
                address1: adminCheckoutForm.address1,
                address2: adminCheckoutForm.address2,
                city: adminCheckoutForm.city,
                state: adminCheckoutForm.state,
                postalCode: adminCheckoutForm.postalCode,
                country: adminCheckoutForm.country,
                location: adminCheckoutForm.location || null,
                date: adminCheckoutForm.date,
                shifts: adminCheckoutForm.shifts || [],
                time: shiftStartTime(adminCheckoutForm.shifts),
                team: "",
                assignedStaff,
                assignedStaffIds: assignedStaff.map(member => member.uid),
                status: adminCheckoutForm.bookingStatus || "Pending",
                paymentStatus: adminCheckoutForm.paymentStatus || "unpaid",
                paymentMethod: adminCheckoutForm.paymentMethod || "",
                leadSource: adminCheckoutForm.leadSource || "",
                service: adminServiceCart.map(item => item.name).join(" + "),
                bathrooms: "N/A",
                frequency: recurringOn ? recurringFrequency : "One-Time",
                isRecurring: recurringOn,
                recurringSeriesId: recurringOn ? `rec-${Date.now()}` : "",
                recurringIndex: 0,
                duration: adminCartTotals.duration,
                price: finalTotal,
                subtotal: adminCartTotals.subtotal,
                tax: checkoutPricing.taxAmount,
                // Store the RAW admin-entered discount inputs only — never the
                // already-combined total. Re-editing recombines these two
                // fields, so if this ever stores a combined value the percent
                // gets re-applied on top of itself on every subsequent save.
                customDiscountAmount: discountAmount,
                customDiscountPercent: discountPercent,
                promoCode: adminCheckoutForm.promoCode,
                giftCardCode: adminCheckoutForm.giftCardCode,
                customerPortalPhone: adminCheckoutForm.phone,
                specialNotes: adminCheckoutForm.notes,
                cartItems: adminServiceCart,
                customerType: adminCheckoutForm.customerLoggedIn ? "customer-account" : "guest",
                companySnapshot: {
                    logoUrl: "/logo-full.png",
                    companyName: "SmarTouch Clean",
                    branchName: matchedBranch.name,
                    branchPhone: matchedBranch.phone,
                    branchEmail: matchedBranch.email,
                    taxLabel: matchedBranch.taxLabel,
                    taxRate: matchedBranch.taxRate,
                    promotions: promotionRules,
                    documentCopy
                }
            };
            const res = await fetch("/api/bookings", {
                method: "POST",
                headers: await getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to create cart booking.");
            }
            let recurringMessage = "";
            if (recurringOn) {
                const dates = generateRecurringDates(payload.date, recurringFrequency, 3);
                const created = await createRecurringChildren(payload, dates, 1);
                recurringMessage = ` ${created} ${recurringFrequency.toLowerCase()} occurrence(s) booked for the next 3 months.`;
            }
            setAdminCheckoutOpen(false);
            setAdminCheckoutStep(0);
            setAdminServiceCart([]);
            syncDatabaseData(currentUser);
            alert(`${getBookingDocumentLabel(adminCheckoutForm.bookingStatus)} created successfully.${recurringMessage}`);
        } catch (err) {
            alert(`Checkout failed: ${err.message}`);
        }
    }, [activeBranch, adminCartTotals, adminCheckoutForm, adminServiceCart, createRecurringChildren, currentUser, documentCopy, fieldStaff, getAuthHeaders, promotionRules, syncDatabaseData]);

    const handleAdminCheckoutNext = useCallback(() => {
        if (!validateAdminCheckoutStep(adminCheckoutStep, adminCheckoutForm)) {
            alert(adminCheckoutStep === 0
                ? "Complete the customer contact and address details first."
                : "Complete the schedule and status details first.");
            return;
        }
        setAdminCheckoutStep(prev => Math.min(2, prev + 1));
    }, [adminCheckoutForm, adminCheckoutStep]);

    // ----------------------------------------------------
    // Filtered & Sorted Booking Data computations
    // ----------------------------------------------------
    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            const client = (b.clientName || "").toLowerCase();
            const addr = `${b.address1 || ""} ${b.city || ""} ${b.postalCode || ""}`.toLowerCase();
            const phone = b.phone || "";
            const email = b.email || "";

            const matchSearch = client.includes(searchVal.toLowerCase()) ||
                addr.includes(searchVal.toLowerCase()) ||
                phone.includes(searchVal) ||
                email.toLowerCase().includes(searchVal.toLowerCase());

            const matchService = !filterService || (b.service || "").toLowerCase().includes(filterService.toLowerCase());
            const matchTeam = !filterTeam || b.team === filterTeam;
            const matchStatus = !filterStatus ||
                (filterStatus === "awaiting_approval" ? (b.customerConfirmed === true && b.status === "Pending") : b.status === filterStatus);

            const matchPayment = !filterPayment || (b.paymentStatus || "unpaid") === filterPayment;

            const matchRoleAccess = currentUser?.role === "customer" ? b.email === currentUser?.email : true;

            return matchSearch && matchService && matchTeam && matchStatus && matchPayment && matchRoleAccess;
        }).sort((a, b) => {
            if (sortVal === "date-asc") {
                return new Date(`${a.date} ${a.time}`) - new Date(`${b.date} ${b.time}`);
            } else if (sortVal === "date-desc") {
                return new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`);
            } else if (sortVal === "name-asc") {
                return a.clientName.localeCompare(b.clientName);
            } else if (sortVal === "price-desc") {
                return b.price - a.price;
            }
            return 0;
        });
    }, [bookings, searchVal, filterService, filterTeam, filterStatus, filterPayment, sortVal, currentUser]);

    // Stat metric computations
    const dashboardMetrics = useMemo(() => {
        let revenue = 0;
        let completed = 0;
        let pending = 0;

        bookings.forEach(b => {
            if (b.status === "Completed") {
                revenue += parseFloat(b.price || 0);
            }
            if (b.status === "Completed") completed++;
            if (b.status === "Pending") pending++;
        });

        return { revenue, total: bookings.length, completed, pending };
    }, [bookings]);

    const coreServiceNames = useMemo(() => {
        return (v2Catalog.categories || []).map(category => category.name);
    }, [v2Catalog]);

    const adminCommandMetrics = useMemo(() => {
        const activeBookings = bookings.filter(b => b.status !== "Cancelled");
        const paidBookings = activeBookings.filter(b => b.paymentStatus === "paid" || b.paymentStatus === "Paid");
        // Collected revenue counts partial payments' collected portion too —
        // matches "Payments Collected" (amount received), not "Sales Invoiced".
        const paidRevenue = activeBookings.reduce((sum, b) => {
            if (b.paymentStatus === "paid" || b.paymentStatus === "Paid") return sum + parseFloat(b.price || b.totalAmount || 0);
            if (b.paymentStatus === "partial") return sum + parseFloat(b.amountReceived || 0);
            return sum;
        }, 0);
        const completedCount = activeBookings.filter(b => b.status === "Completed").length;
        const confirmed = activeBookings.filter(b => b.status === "Confirmed").length;
        const pipeline = activeBookings.filter(b => ["Pending", "Lead", "Follow Up"].includes(b.status)).length;
        const awaitingApproval = activeBookings.filter(b => b.customerConfirmed === true && b.status === "Pending").length;
        const pendingPaymentJobs = activeBookings.filter(b => b.status === "Completed" && b.paymentStatus !== "paid" && b.paymentStatus !== "Paid");
        const pendingPaymentAmount = pendingPaymentJobs.reduce((sum, b) => {
            const balance = parseFloat(b.price || b.totalAmount || 0) - parseFloat(b.amountReceived || 0);
            return sum + Math.max(0, balance);
        }, 0);

        const METHOD_LABELS = { cash: "Cash", "e-transfer": "E-Transfer", "credit-card": "Card", "direct-deposit": "Direct Deposit", cheque: "Cheque" };
        const paidByMethod = {};
        paidBookings.forEach(b => {
            const m = b.paymentMethod || "unspecified";
            paidByMethod[m] = (paidByMethod[m] || 0) + parseFloat(b.price || b.totalAmount || 0);
        });
        const paidByMethodLabeled = Object.entries(paidByMethod).map(([key, amt]) => ({
            key, label: METHOD_LABELS[key] || key, amount: amt,
        })).sort((a, b) => b.amount - a.amount);

        // ── Business-health metrics (Dashboard summary only — no operational data) ──
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
        const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
        const jobsTodayList = activeBookings.filter(b => b.date === todayStr);
        const jobsTomorrowList = activeBookings.filter(b => b.date === tomorrowStr && b.status === "Confirmed");
        const todayRevenue = jobsTodayList.reduce((sum, b) => sum + parseFloat(b.price || b.totalAmount || 0), 0);
        const newLeads = activeBookings.filter(b => b.status === "Lead").length;
        const newQuotes = activeBookings.filter(b => b.status === "Quote").length;
        const jobsNeedingAttention = activeBookings.filter(b =>
            (b.date === todayStr && b.status === "Confirmed" && (!b.assignedStaffIds || b.assignedStaffIds.length === 0)) ||
            (b.status === "Completed" && b.paymentStatus !== "paid")
        ).length;
        const recurringActive = activeBookings.filter(b => b.isRecurring && b.status !== "Completed").length;
        const uniqueRecurringCustomers = new Set(
            activeBookings.filter(b => b.isRecurring).map(b => b.email || b.phone || b.clientName)
        ).size;
        const tomorrowUnassigned = jobsTomorrowList.filter(b => !b.assignedStaffIds || b.assignedStaffIds.length === 0).length;

        const pendingExpenseCount = expenses.filter(e => e.status === "pending_approval").length;
        const approvedExpenseTotal = expenses
            .filter(e => e.status === "approved")
            .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        const todayFinancialRecords = financialRecords.filter(r => r.date === todayStr);
        const dailyPnl = todayFinancialRecords.reduce((acc, r) => ({
            revenue: acc.revenue + Number(r.revenue || 0),
            laborCost: acc.laborCost + Number(r.laborCost || 0),
            materialCost: acc.materialCost + Number(r.materialCost || 0),
            profit: acc.profit + Number(r.profit || 0),
        }), { revenue: 0, laborCost: 0, materialCost: 0, profit: 0 });

        return {
            activeBookings: activeBookings.length,
            paidRevenue,
            paidByMethodLabeled,
            completedCount,
            confirmed,
            pipeline,
            awaitingApproval,
            pendingPaymentAmount,
            pendingPaymentCount: pendingPaymentJobs.length,
            jobsToday: jobsTodayList.length,
            todayRevenue,
            newLeads,
            newQuotes,
            jobsNeedingAttention,
            recurringActive,
            uniqueRecurringCustomers,
            jobsTomorrow: jobsTomorrowList.length,
            tomorrowUnassigned,
            tomorrowReady: jobsTomorrowList.length > 0 && tomorrowUnassigned === 0,
            pendingExpenseCount,
            approvedExpenseTotal,
            dailyPnl,
            jobsCompletedTodayWithFinancials: todayFinancialRecords.length,
        };
    }, [bookings, expenses, financialRecords]);

    const catalogServiceCards = useMemo(() => {
        const serviceImages = [
            "service-visual-home",
            "service-visual-window",
            "service-visual-pressure",
            "service-visual-deck",
            "service-visual-gutter",
            "service-visual-lawn"
        ];

        return (v2Catalog.categories || []).map((category, index) => {
            const count = bookings.filter(booking => {
                if (booking.status === "Cancelled") return false;
                const name = String(booking.service || "").toLowerCase();
                const categoryName = String(category.name || "").toLowerCase();
                const categoryId = String(category.id || "").toLowerCase();
                const inCart = Array.isArray(booking.cartItems) && booking.cartItems.some(item =>
                    String(item.categoryId || item.serviceId || item.name || "").toLowerCase().includes(categoryId) ||
                    String(item.name || "").toLowerCase().includes(categoryName)
                );
                return name.includes(categoryName) || name.includes(categoryId) || inCart;
            }).length;

            return {
                ...category,
                count,
                visualClass: serviceImages[index % serviceImages.length],
                basePrice: getCategoryBasePrice(category),
                durationHrs: getCategoryDuration(category)
            };
        });
    }, [bookings, getCategoryBasePrice, getCategoryDuration, v2Catalog]);

    const serviceCounts = useMemo(() => {
        const counts = {};
        const categoryLookup = new Map();

        (v2Catalog.categories || []).forEach(category => {
            counts[category.name] = 0;
            categoryLookup.set(category.name.toLowerCase(), category.name);
            categoryLookup.set(category.id.toLowerCase(), category.name);
            (category.sizes || []).forEach(size => {
                categoryLookup.set(size.name.toLowerCase(), category.name);
            });
        });

        let validJobs = 0;

        bookings.forEach(b => {
            if (b.status !== "Cancelled") {
                const coreService = categoryLookup.get(String(b.service || "").toLowerCase());
                if (coreService) {
                    counts[coreService]++;
                    validJobs++;
                }
            }
        });

        return { counts, total: validJobs };
    }, [bookings, v2Catalog]);

    // Today's appointments (Toronto timezone)
    const todayBookings = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); // yields YYYY-MM-DD
        return bookings.filter(b => b.date === todayStr).sort((a, b) => a.time.localeCompare(b.time));
    }, [bookings]);


    // ----------------------------------------------------
    // Calendar Navigation helpers
    // ----------------------------------------------------
    const calendarDays = useMemo(() => {
        const year = currentCalMonth.getFullYear();
        const month = currentCalMonth.getMonth();
        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();

        const cells = [];
        // Empty cells for first week offset
        for (let i = 0; i < firstDayIndex; i++) {
            cells.push({ day: null, dateStr: null });
        }
        // Active days
        for (let d = 1; d <= totalDays; d++) {
            const mStr = String(month + 1).padStart(2, "0");
            const dStr = String(d).padStart(2, "0");
            cells.push({ day: d, dateStr: `${year}-${mStr}-${dStr}` });
        }
        return cells;
    }, [currentCalMonth]);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const changeMonth = (offset) => {
        setCurrentCalMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const agendaBookings = useMemo(() => {
        // Admin calendar agenda only shows Confirmed bookings, matching the day-grid dots.
        // Cleaners still see all their own jobs regardless of status (their own history/schedule).
        return bookings
            .filter(b => b.date === selectedCalDate && (isCleanerSelfServiceView ? true : b.status === "Confirmed"))
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [bookings, selectedCalDate, isCleanerSelfServiceView]);

    // Time slots population helper (7:00 AM to 7:00 PM every 30 mins)
    const timeSlots = useMemo(() => {
        const slots = [];
        for (let hour = 7; hour <= 19; hour++) {
            for (let min = 0; min < 60; min += 30) {
                if (hour === 19 && min > 0) break;
                const h12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                slots.push(`${String(h12).padStart(2, "0")}:${String(min).padStart(2, "0")} ${ampm}`);
            }
        }
        return slots;
    }, []);

    const buildCombinedSlotStatus = useCallback((selectedIds = [], bookingDate, bookingDuration = 2, excludeBookingId = null) => {
        return timeSlots.map((slotTime) => {
            if (!bookingDate) {
                return { time: slotTime, available: false, reason: "Pick a date first", tone: "pending" };
            }

            if (!selectedIds.length) {
                return { time: slotTime, available: false, reason: "Select cleaner first", tone: "pending" };
            }

            const statuses = selectedIds.map((uid) => {
                const member = fieldStaff.find((candidate) => candidate.uid === uid);
                return getCleanerAvailabilityStatus(member, bookingDate, slotTime, bookingDuration, excludeBookingId);
            });

            const blocked = statuses.find((entry) => !entry.available);
            return blocked
                ? { time: slotTime, available: false, reason: blocked.reason, tone: blocked.tone }
                : { time: slotTime, available: true, reason: "Open", tone: "available" };
        });
    }, [fieldStaff, getCleanerAvailabilityStatus, timeSlots]);

    const getCleanerDayAvailability = useCallback((member, bookingDate, bookingDuration = 2, excludeBookingId = null) => {
        if (!bookingDate) {
            return { available: false, reason: "Pick a date first", tone: "pending" };
        }
        const firstOpenSlot = timeSlots.find((slotTime) =>
            getCleanerAvailabilityStatus(member, bookingDate, slotTime, bookingDuration, excludeBookingId).available
        );
        if (firstOpenSlot) {
            return { available: true, reason: `Open from ${firstOpenSlot}`, tone: "available" };
        }
        return getCleanerAvailabilityStatus(member, bookingDate, "09:00 AM", bookingDuration, excludeBookingId);
    }, [getCleanerAvailabilityStatus, timeSlots]);

    const adminCheckoutDuration = useMemo(() => adminCartTotals.duration || 2, [adminCartTotals.duration]);

    const getCleanerShiftConflict = useCallback((member, bookingDate, selectedShifts = [], excludeBookingId = null) => {
        if (!member) return { available: false, reason: "No cleaner selected" };
        if (!bookingDate) return { available: false, reason: "Pick a date first" };
        if (!selectedShifts.length) return { available: false, reason: "Select a shift first" };

        const profile = normalizeStaffProfile(member.staffProfileRequest?.requestedProfile || member.staffProfile);
        const availability = profile.availability || {};
        const blockedDates = new Set(availability.blockedDates || []);
        if (blockedDates.has(bookingDate)) return { available: false, reason: "Blocked date" };

        const weekday = availability.weekdays?.[getWeekdayIndexForSchedule(bookingDate)];
        if (weekday && weekday.enabled === false) return { available: false, reason: "Off day" };

        const assignedThatDay = bookings.filter(b =>
            b.id !== excludeBookingId &&
            b.status !== "Cancelled" &&
            b.date === bookingDate &&
            b.assignedStaffIds?.includes(member.uid)
        );

        for (const b of assignedThatDay) {
            const bShifts = b.shifts?.length > 0 ? b.shifts : [timeToShift(b.time)].filter(Boolean);
            const conflict = selectedShifts.find(s => bShifts.includes(s));
            if (conflict) {
                const shiftLabel = SHIFTS.find(s => s.id === conflict)?.label || conflict;
                return { available: false, reason: `${shiftLabel} shift taken` };
            }
        }

        return { available: true, reason: assignedThatDay.length ? `${assignedThatDay.length} job(s) that day` : "Available" };
    }, [bookings, getWeekdayIndexForSchedule, normalizeStaffProfile]);

    // HR: only fully-approved, Active employees can be assigned to jobs.
    // (status !== "approved" covers applicants; employmentStatus covers
    // approved staff who are Inactive/Suspended/On Leave — undefined defaults
    // to Active so existing staff aren't silently unassignable.)
    const myExpenses = useMemo(() => {
        return expenses.filter(expense => expense.submittedByUid === currentUser?.uid);
    }, [expenses, currentUser]);

    const pendingExpenseApprovals = useMemo(() => {
        return expenses.filter(expense => expense.status === "pending_approval");
    }, [expenses]);

    const reviewedExpenses = useMemo(() => {
        return expenses;
    }, [expenses]);

    const assignableFieldStaff = useMemo(() => {
        return fieldStaff.filter((member) =>
            member.status === "approved" &&
            !["Inactive", "Suspended", "On Leave"].includes(member.employmentStatus)
        );
    }, [fieldStaff]);

    const adminStaffAvailabilityCards = useMemo(() => {
        return assignableFieldStaff.map((member) => ({
            member,
            status: getCleanerShiftConflict(
                member,
                adminCheckoutForm.date,
                adminCheckoutForm.shifts || [],
            )
        }));
    }, [adminCheckoutForm.date, adminCheckoutForm.shifts, assignableFieldStaff, getCleanerShiftConflict]);

    const adminSlotStates = useMemo(() => {
        return buildCombinedSlotStatus(
            adminCheckoutForm.assignedStaffIds || [],
            adminCheckoutForm.date,
            adminCheckoutDuration
        );
    }, [adminCheckoutDuration, adminCheckoutForm.assignedStaffIds, adminCheckoutForm.date, buildCombinedSlotStatus]);

    const adminCheckoutPricing = useMemo(() => {
        const serviceLines = adminServiceCart.map((item) => {
            const addons = Array.isArray(item.addons) ? item.addons : [];
            const addonTotal = addons.reduce((sum, addon) => sum + (Number(addon.price || 0) * Number(addon.qty || 1)), 0);
            const basePortion = Math.max(0, Number(item.price || 0) - addonTotal);
            return {
                ...item,
                addonTotal,
                basePortion,
                addons
            };
        });

        const pricing = computeBookingPricing({
            subtotal: adminCartTotals.subtotal,
            customDiscountAmount: adminCheckoutForm.discountAmount,
            customDiscountPercent: adminCheckoutForm.discountPercent,
            promoDiscount: 0,
            taxRate: activeBranch.taxRate
        });

        return {
            serviceLines,
            fixedDiscount: pricing.fixedDiscount,
            percentDiscountValue: pricing.percentDiscountValue,
            combinedDiscount: pricing.manualDiscount,
            subtotalAfterDiscounts: pricing.subtotalAfterDiscounts,
            taxAmount: pricing.taxAmount,
            finalTotal: pricing.total
        };
    }, [activeBranch.taxRate, adminCartTotals.subtotal, adminCheckoutForm.discountAmount, adminCheckoutForm.discountPercent, adminServiceCart]);

    const bookingStaffAvailabilityCards = useMemo(() => {
        return assignableFieldStaff.map((member) => ({
            member,
            status: getCleanerShiftConflict(
                member,
                bookingForm.date,
                bookingForm.shifts || [],
                bookingForm.id || null
            )
        }));
    }, [bookingForm.date, bookingForm.shifts, bookingForm.id, assignableFieldStaff, getCleanerShiftConflict]);

    const bookingSlotStates = useMemo(() => {
        return buildCombinedSlotStatus(
            bookingForm.assignedStaffIds || [],
            bookingForm.date,
            bookingForm.duration,
            bookingForm.id || null
        );
    }, [bookingForm.assignedStaffIds, bookingForm.date, bookingForm.duration, bookingForm.id, buildCombinedSlotStatus]);

    // Full address formatter
    const formatAddress = (b) => {
        if (!b) return "";
        let parts = [];
        if (b.address1) parts.push(b.address1);
        if (b.address2) parts.push(b.address2);
        let loc = [];
        if (b.city) loc.push(b.city);
        if (b.state) loc.push(b.state);
        if (b.postalCode) loc.push(b.postalCode);
        if (loc.length > 0) parts.push(loc.join(", "));
        if (b.country) parts.push(b.country);
        return parts.join(" • ");
    };

    const statusClassName = (status) => {
        const normalized = String(status || "Pending").toLowerCase();
        if (["pending", "confirmed", "completed", "cancelled"].includes(normalized)) {
            return `status-pill-${normalized}`;
        }
        return "status-pill-pending";
    };

    // ----------------------------------------------------
    // Loading Screen
    // ----------------------------------------------------
    if (loading) {
        return (
            <div className="auth-fullscreen flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <div className="text-sky-600 mb-4">{Icons.Loading()}</div>
                <p className="text-slate-500 font-semibold antialiased text-sm">Authenticating SmarTouch Session...</p>
            </div>
        );
    }

    // ----------------------------------------------------
    // Auth Portal view (Login vs Signup screen)
    // ----------------------------------------------------
    if (!currentUser) {
        return (
            <div className="auth-fullscreen">
                {/* LEFT: Hero branding panel */}

                {/* RIGHT: Form panel */}
                <div className="auth-panel">
                    <div className="auth-card-inner">
                        <img src="/logo-full.png" alt="SmarTouch Clean" className="auth-card-logo-mobile" />

                        {authMode === "login" ? (
                            <>
                                <h2 className="auth-card-heading">Welcome back</h2>
                                <p className="auth-card-sub">Sign in with your phone number and SMS verification code.</p>
                                <form onSubmit={authCodeSent ? handlePhoneVerify : handleSendPhoneCode}>
                                    <div className="auth-field">
                                        <label>Phone Number</label>
                                        <input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)} required placeholder="+1 613 555 0100" />
                                    </div>
                                    {authCodeSent && (
                                        <div className="auth-field">
                                            <label>Verification Code</label>
                                            <input type="text" value={authCode} onChange={e => setAuthCode(e.target.value)} required placeholder="6-digit code" />
                                        </div>
                                    )}
                                    <button type="submit" className="auth-submit-btn" disabled={authSubmitting}>
                                        {authCodeSent ? "Verify And Sign In" : "Send Verification Code"}
                                    </button>
                                </form>
                                <p className="auth-switch-text">
                                    New cleaner? <span onClick={() => { setAuthMode("signup"); setAuthCodeSent(false); setAuthCode(""); }} className="auth-switch-link">Create an account</span>
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="auth-card-heading">Join the crew</h2>
                                <p className="auth-card-sub">Register with your phone number. After verification you will go straight to your cleaner profile.</p>
                                <form onSubmit={authCodeSent ? handlePhoneVerify : handleSendPhoneCode}>
                                    <div className="auth-field">
                                        <label>Full Name</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Jenkins" />
                                    </div>
                                    <div className="auth-field">
                                        <label>Phone Number</label>
                                        <input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)} required placeholder="+1 613 555 0100" />
                                    </div>
                                    {authCodeSent && (
                                        <div className="auth-field">
                                            <label>Verification Code</label>
                                            <input type="text" value={authCode} onChange={e => setAuthCode(e.target.value)} required placeholder="6-digit code" />
                                        </div>
                                    )}
                                    <button type="submit" className="auth-submit-btn" disabled={authSubmitting}>
                                        {authCodeSent ? "Verify And Continue" : "Send Verification Code"}
                                    </button>
                                </form>
                                <p className="auth-switch-text">
                                    Already registered? <span onClick={() => { setAuthMode("login"); setAuthCodeSent(false); setAuthCode(""); }} className="auth-switch-link">Sign In</span>
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ----------------------------------------------------
    // "Awaiting Activation" Pending approval blocked screen
    // ----------------------------------------------------
    // ----------------------------------------------------
    // Authorized approved Application dashboard
    // ----------------------------------------------------
    return (
        <div className={`app-container${sidebarCollapsed ? " sidebar-is-collapsed" : ""}`}>
            {/* Sidebar Navigation */}
            <aside className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`}>
                <div className="brand-logo">
                    {!sidebarCollapsed && <img src="/logo-full.png" alt="SmarTouch Clean" className="brand-logo-img" />}
                    <button onClick={() => setSidebarCollapsed(v => !v)} className="sidebar-toggle-btn" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {sidebarCollapsed
                                ? <><polyline points="9 18 15 12 9 6"/></>
                                : <><polyline points="15 18 9 12 15 6"/></>
                            }
                        </svg>
                    </button>
                </div>

                <nav className="nav-links">
                    {!isPendingCleanerOnboarding && !isCleanerSelfServiceView && (
                        <button onClick={() => setActiveTab("dashboard")} className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`} title="Dashboard">
                            {Icons.Dashboard()}
                            <span className="nav-label">Dashboard</span>
                        </button>
                    )}
                    {!isPendingCleanerOnboarding && !isCleanerSelfServiceView && (
                        <button onClick={() => setActiveTab("bookings")} className={`nav-item ${activeTab === "bookings" ? "active" : ""}`} title="Bookings">
                            {Icons.Bookings()}
                            <span className="nav-label">Bookings</span>
                        </button>
                    )}
                    {canViewCRM && !isCleanerSelfServiceView && (
                        <button onClick={() => setActiveTab("customers")} className={`nav-item ${activeTab === "customers" ? "active" : ""}`} title="Customers">
                            {Icons.Teams()}
                            <span className="nav-label">Customers</span>
                        </button>
                    )}
                    {canViewCRM && !isCleanerSelfServiceView && (
                        <button onClick={() => setActiveTab("messages")} className={`nav-item ${activeTab === "messages" ? "active" : ""}`} title="Messages">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            <span className="nav-label">Messages</span>
                        </button>
                    )}
                    {canViewAdministration && (
                        <button onClick={() => setActiveTab("finance")} className={`nav-item ${activeTab === "finance" ? "active" : ""}`} title="Finance">
                            {Icons.Cash()}
                            <span className="nav-label">Finance</span>
                        </button>
                    )}
                    {!isPendingCleanerOnboarding && !isCleanerSelfServiceView && (
                        <button onClick={() => setActiveTab("recurring")} className={`nav-item ${activeTab === "recurring" ? "active" : ""}`} title="Recurring">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="17 1 21 5 17 9"/>
                                <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                                <polyline points="7 23 3 19 7 15"/>
                                <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                            </svg>
                            <span className="nav-label">Recurring</span>
                        </button>
                    )}
                    {canViewOperations && (
                        <button onClick={() => setActiveTab("calendar")} className={`nav-item ${activeTab === "calendar" ? "active" : ""}`} title={isCleanerSelfServiceView ? "Schedule" : "Calendar"}>
                            {Icons.Calendar()}
                            <span className="nav-label">{isCleanerSelfServiceView ? "Schedule" : "Calendar"}</span>
                        </button>
                    )}
                    {/* HR Hub group */}
                    {(canViewOperations || canViewPeople || canViewAdministration) && !isCleanerSelfServiceView && (
                        <div className={`nav-group${hrHubOpen ? " open" : ""}`}>
                            <button
                                className={`nav-group-header${["jobs","teams","payroll","expenses"].includes(activeTab) ? " has-active" : ""}`}
                                onClick={() => setHrHubOpen(v => !v)}
                                title="HR Hub"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                                <span className="nav-label">HR Hub</span>
                                <svg className="nav-group-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9"/>
                                </svg>
                            </button>
                            <div className="nav-group-items">
                                {canViewOperations && (
                                    <button onClick={() => setActiveTab("jobs")} className={`nav-item nav-sub-item ${activeTab === "jobs" ? "active" : ""}`} title="Time Cards">
                                        {Icons.Clock()}
                                        <span className="nav-label">Time Cards</span>
                                    </button>
                                )}
                                {canViewPeople && (
                                    <button onClick={() => setActiveTab("teams")} className={`nav-item nav-sub-item ${activeTab === "teams" ? "active" : ""}`} title="Staff">
                                        {Icons.Teams()}
                                        <span className="nav-label">Staff</span>
                                    </button>
                                )}
                                {canViewAdministration && (
                                    <button onClick={() => setActiveTab("payroll")} className={`nav-item nav-sub-item ${activeTab === "payroll" ? "active" : ""}`} title="Payroll">
                                        {Icons.Cash()}
                                        <span className="nav-label">Payroll</span>
                                    </button>
                                )}
                                {canViewOperations && (
                                    <button onClick={() => setActiveTab("expenses")} className={`nav-item nav-sub-item ${activeTab === "expenses" ? "active" : ""}`} title="Expenses">
                                        {Icons.Cash()}
                                        <span className="nav-label">Expenses</span>
                                        {canReviewExpenses && pendingExpenseApprovals.length > 0 && (
                                            <span className="badge">{pendingExpenseApprovals.length}</span>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {/* Cleaner self-service: show Jobs, Expenses & Profile outside group */}
                    {isCleanerSelfServiceView && canViewOperations && (
                        <button onClick={() => setActiveTab("jobs")} className={`nav-item ${activeTab === "jobs" ? "active" : ""}`} title="Jobs">
                            {Icons.Clock()}
                            <span className="nav-label">Jobs</span>
                        </button>
                    )}
                    {isCleanerSelfServiceView && canViewOperations && (
                        <button onClick={() => setActiveTab("expenses")} className={`nav-item ${activeTab === "expenses" ? "active" : ""}`} title="Expenses">
                            {Icons.Cash()}
                            <span className="nav-label">Expenses</span>
                        </button>
                    )}
                    {isCleanerSelfServiceView && canViewOperations && (
                        <button onClick={() => setActiveTab("messages")} className={`nav-item ${activeTab === "messages" ? "active" : ""}`} title="Support">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            <span className="nav-label">Support</span>
                        </button>
                    )}
                    {isCleanerSelfServiceView && canViewPeople && (
                        <button onClick={() => setActiveTab("teams")} className={`nav-item ${activeTab === "teams" ? "active" : ""}`} title="Profile">
                            {Icons.Teams()}
                            <span className="nav-label">Profile</span>
                        </button>
                    )}
                    {canViewAdministration && (
                        <button onClick={() => setActiveTab("edit-requests")} className={`nav-item ${activeTab === "edit-requests" ? "active" : ""}`} title="Edit Review">
                            {Icons.EditReview()}
                            <span className="nav-label">Edit Review</span>
                            {editRequests.filter(r => r.status === "Pending").length > 0 && (
                                <span className="badge">{editRequests.filter(r => r.status === "Pending").length}</span>
                            )}
                        </button>
                    )}
                    {/* Departments, Catalog Studio, Promotions, and Permissions are
                        grouped under Settings → Configuration instead of standalone
                        sidebar entries — keeps the nav to one responsibility each. */}
                    {!isPendingCleanerOnboarding && (
                        <button onClick={() => setActiveTab("settings")} className={`nav-item ${activeTab === "settings" ? "active" : ""}`} title="Settings">
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                            <span className="nav-label">Settings</span>
                        </button>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className={`user-profile ${sidebarCollapsed ? "justify-center" : "flex justify-between items-center w-full"}`}>
                        {!sidebarCollapsed && (
                            <div className="flex items-center gap-2.5">
                                <div className={`user-avatar text-white font-bold ${currentUser.photoURL ? "user-avatar-photo" : ""}`}>
                                    {currentUser.photoURL ? (
                                        <img src={currentUser.photoURL} alt={currentUser.name} className="avatar-image" />
                                    ) : getInitials(currentUser.name)}
                                </div>
                                <div className="user-details flex flex-col">
                                    <span className="user-name text-slate-800 text-xs font-bold leading-tight">{currentUser.name}</span>
                                    <span className="user-role text-[10px] text-slate-400 mt-0.5">{roleLabel}</span>
                                </div>
                            </div>
                        )}
                        {sidebarCollapsed ? (
                            <div className={`user-avatar text-white font-bold ${currentUser.photoURL ? "user-avatar-photo" : ""}`} title={currentUser.name}>
                                {currentUser.photoURL ? (
                                    <img src={currentUser.photoURL} alt={currentUser.name} className="avatar-image" />
                                ) : getInitials(currentUser.name)}
                            </div>
                        ) : (
                            <button onClick={handleSignout} className="action-btn" title="Log Out">{Icons.Logout()}</button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main view body content */}
            <main className="main-content">
                <header className="top-header">
                    <div className="header-left">
                        <h2 className="view-title text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                            {activeTab === "dashboard" ? "Dashboard Overview" :
                                activeTab === "bookings" ? "Client Booking Manager" :
                                    activeTab === "recurring" ? "Recurring Bookings" :
                                    activeTab === "calendar" ? (isCleanerSelfServiceView ? "Schedule" : "Scheduling Calendar") :
                                        activeTab === "jobs" ? (isCleanerSelfServiceView ? "Jobs" : "Time Cards") :
                                            activeTab === "payroll" ? "Payroll & Time Hub" :
                                                activeTab === "expenses" ? "Expense Management" :
                                                activeTab === "customers" ? "Customer Directory" :
                                                activeTab === "messages" ? (isCleanerSelfServiceView ? "Support" : "Messages") :
                                                activeTab === "finance" ? "Finance" :
                                        activeTab === "teams" ? (isCleanerSelfServiceView ? "Profile" : "Field Staff Assignments") :
                                            activeTab === "departments" ? "Departments" :
                                            activeTab === "edit-requests" ? "Modification Requests Inbox" :
                                                activeTab === "catalog" ? "Catalog Studio" :
                                                    activeTab === "promotions" ? "Promotions Manager" :
                                                        activeTab === "permissions" ? "Permissions & Roles" : "Account Settings"}
                        </h2>
                    </div>
                    <div className="header-right">
                        <div className="branch-context-control">
                            <span>Branch</span>
                            {branchScope?.canSwitchBranches ? (
                                <select value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
                                    {BRANCHES.map(branch => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name} · {branch.currency}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <strong>{activeBranch.name} · {activeBranch.currency}</strong>
                            )}
                        </div>
                        <div className="datetime-indicator text-xs font-bold text-slate-500 bg-white p-2.5 rounded-full border border-slate-200">{clockString}</div>
                    </div>
                </header>

                {/* TAB 1: DASHBOARD VIEW */}
                {activeTab === "dashboard" && (
                    <DashboardTab
                        currentUser={currentUser}
                        bookings={bookings}
                        timeEntries={timeEntries}
                        customerRewards={customerRewards}
                        promotionRules={promotionRules}
                        adminCommandMetrics={adminCommandMetrics}
                        activeBranch={activeBranch}
                        todayBookings={todayBookings}
                        pendingUsers={pendingUsers}
                        fieldStaff={fieldStaff}
                        activeTimeEntries={activeTimeEntries}
                        canManagePermissions={canManagePermissions}
                        Icons={Icons}
                        getPersonalReferralCode={getPersonalReferralCode}
                        getCustomerEligiblePromotions={getCustomerEligiblePromotions}
                        setSelectedBooking={setSelectedBooking}
                        setDetailsModalOpen={setDetailsModalOpen}
                        setActiveTab={setActiveTab}
                        setFilterStatus={setFilterStatus}
                        handleResolveUserApproval={handleResolveUserApproval}
                        getRoleLabel={getRoleLabel}
                    />
                )}

                {/* TAB 2: BOOKINGS LIST VIEWS */}
                {activeTab === "bookings" && (
                    <BookingsTab
                        searchVal={searchVal}
                        setSearchVal={setSearchVal}
                        filterService={filterService}
                        setFilterService={setFilterService}
                        filterStatus={filterStatus}
                        setFilterStatus={setFilterStatus}
                        sortVal={sortVal}
                        setSortVal={setSortVal}
                        pricingRates={pricingRates}
                        filteredBookings={filteredBookings}
                        editRequests={editRequests}
                        canManagePermissions={canManagePermissions}
                        Icons={Icons}
                        formatAddress={formatAddress}
                        formatTimeWindow={formatTimeWindow}
                        setSelectedBooking={setSelectedBooking}
                        setDetailsModalOpen={setDetailsModalOpen}
                        openEditBookingModal={openEditBookingModal}
                        handleDeleteBooking={handleDeleteBooking}
                        fieldStaff={fieldStaff}
                        handleQuickBookingUpdate={handleQuickBookingUpdate}
                        filterTeam={filterTeam}
                        setFilterTeam={setFilterTeam}
                        filterPayment={filterPayment}
                        setFilterPayment={setFilterPayment}
                        branchTimezone={activeBranch?.timezone || "America/Toronto"}
                        leadSources={leadSources}
                        openNewBookingCommand={openNewBookingCommand}
                        teams={teams}
                        openCustomerProfile={openCustomerProfile}
                    />
                )}

                {/* RECURRING BOOKINGS: Outlook-style day/week/month calendar */}
                {activeTab === "recurring" && !isCleanerSelfServiceView && (
                    <RecurringTab
                        bookings={bookings}
                        Icons={Icons}
                        setSelectedBooking={setSelectedBooking}
                        setDetailsModalOpen={setDetailsModalOpen}
                        openEditBookingModal={openEditBookingModal}
                        branchTimezone={activeBranch?.timezone || "America/Toronto"}
                    />
                )}

                {/* TAB 3: CALENDAR & DAY AGENDA PANEL */}
                {activeTab === "calendar" && (
                    <CalendarTab
                        monthNames={monthNames}
                        currentCalMonth={currentCalMonth}
                        calendarDays={calendarDays}
                        bookings={bookings}
                        selectedCalDate={selectedCalDate}
                        isCleanerSelfServiceView={isCleanerSelfServiceView}
                        teams={teams}
                        agendaBookings={agendaBookings}
                        Icons={Icons}
                        changeMonth={changeMonth}
                        setSelectedCalDate={setSelectedCalDate}
                        getBookingCustomerFirstName={getBookingCustomerFirstName}
                        setSelectedBooking={setSelectedBooking}
                        setDetailsModalOpen={setDetailsModalOpen}
                        openEditBookingModal={openEditBookingModal}
                    />
                )}

                {/* Cleaner self-service: Jobs tab */}
                {activeTab === "jobs" && isCleanerSelfServiceView && (
                    <JobsPayrollTab
                        isCleanerSelfServiceView={true}
                        cleanerPayPeriod={cleanerPayPeriod}
                        weeklyTimeSummary={weeklyTimeSummary}
                        Icons={Icons}
                        activeTimeEntry={activeTimeEntry}
                        timeEntrySaving={timeEntrySaving}
                        cleanerTodayConfirmedJobs={cleanerTodayConfirmedJobs}
                        activeJobForCleaner={activeJobForCleaner}
                        jobsNow={jobsNow}
                        jobsFeedback={jobsFeedback}
                        recentOwnTimeEntries={recentOwnTimeEntries}
                        currentUser={currentUser}
                        formatDurationMinutes={formatDurationMinutes}
                        formatRuntime={formatRuntime}
                        getBookingCustomerFirstName={getBookingCustomerFirstName}
                        getBookingLocationLabel={getBookingLocationLabel}
                        handleOpenCleanerJob={handleOpenCleanerJob}
                        syncDatabaseData={syncDatabaseData}
                    />
                )}

                {/* Admin: Time Cards tab */}
                {activeTab === "jobs" && !isCleanerSelfServiceView && (
                    <TimeCardsTab
                        isSuperAdmin={isSuperAdmin}
                        timeEntries={timeEntries}
                        timeEntrySaving={timeEntrySaving}
                        allFieldStaff={fieldStaff}
                        todayAllConfirmedJobs={todayAllConfirmedJobs}
                        adminClockForm={adminClockForm}
                        setAdminClockForm={setAdminClockForm}
                        activeTimeEntries={activeTimeEntries}
                        handleAdminClockInFor={handleAdminClockInFor}
                        handleAdminClockOutFor={handleAdminClockOutFor}
                        handleReviewTimeEntry={handleReviewTimeEntry}
                        handleEditTimeEntry={handleEditTimeEntry}
                        handleDeleteTimeEntry={handleDeleteTimeEntry}
                        handleCreateManualTimeEntry={handleCreateManualTimeEntry}
                        manualTimeEntryForm={manualTimeEntryForm}
                        setManualTimeEntryForm={setManualTimeEntryForm}
                        timeEntryEditDrafts={timeEntryEditDrafts}
                        setTimeEntryEditDrafts={setTimeEntryEditDrafts}
                        currentUser={currentUser}
                        syncDatabaseData={syncDatabaseData}
                        jobsFeedback={jobsFeedback}
                    />
                )}

                {/* Admin: Payroll tab */}
                {activeTab === "payroll" && (
                    <PayrollTab
                        timeEntries={timeEntries}
                        allFieldStaff={fieldStaff}
                        isSuperAdmin={isSuperAdmin}
                        getAuthHeaders={getAuthHeaders}
                        currentUser={currentUser}
                        syncDatabaseData={syncDatabaseData}
                    />
                )}

                {activeTab === "customers" && canViewCRM && (
                    <CustomersTab
                        getAuthHeaders={getAuthHeaders}
                        currentUser={currentUser}
                    />
                )}

                {activeTab === "finance" && canViewAdministration && (
                    <FinanceTab getAuthHeaders={getAuthHeaders} />
                )}

                {activeTab === "messages" && !isCleanerSelfServiceView && canViewCRM && (
                    <MessagesTab
                        getAuthHeaders={getAuthHeaders}
                        currentUser={currentUser}
                        Icons={Icons}
                    />
                )}

                {activeTab === "messages" && isCleanerSelfServiceView && (
                    <div className="animate-fade">
                        <div className="ops-control-header">
                            <div>
                                <p className="ops-eyebrow">Support</p>
                                <h3 className="ops-title">Message Support</h3>
                                <p className="ops-copy">One ongoing conversation with the office — spans every job you've worked. Chat about a specific job stays on that job's details until it's completed.</p>
                            </div>
                        </div>
                        <CleanerSupportChat getAuthHeaders={getAuthHeaders} currentUser={currentUser} />
                    </div>
                )}

                {activeTab === "expenses" && (
                    <ExpensesTab
                        Icons={Icons}
                        canReviewExpenses={canReviewExpenses}
                        myExpenses={myExpenses}
                        pendingExpenseApprovals={pendingExpenseApprovals}
                        reviewedExpenses={reviewedExpenses}
                        expenseForm={expenseForm}
                        setExpenseForm={setExpenseForm}
                        expenseReceiptUploading={expenseReceiptUploading}
                        expenseSubmitting={expenseSubmitting}
                        expenseFeedback={expenseFeedback}
                        expenseRejectReason={expenseRejectReason}
                        setExpenseRejectReason={setExpenseRejectReason}
                        handleExpenseReceiptCapture={handleExpenseReceiptCapture}
                        handleSubmitExpense={handleSubmitExpense}
                        handleReviewExpense={handleReviewExpense}
                    />
                )}

                {/* TAB 4: FIELD STAFF ASSIGNMENTS VIEW */}
                {activeTab === "teams" && (
                    <TeamsTab
                        isViewingOwnCleanerProfile={isViewingOwnCleanerProfile}
                        peopleRoster={peopleRoster}
                        bookings={bookings}
                        selectedStaffMember={selectedStaffMember}
                        activeStaffProfileDraft={activeStaffProfileDraft}
                        selectedStaffCompletedJobs={selectedStaffCompletedJobs}
                        staffProfileFeedback={staffProfileFeedback}
                        staffProfileRejectReason={staffProfileRejectReason}
                        staffProfileMobileTab={staffProfileMobileTab}
                        staffProfileEditOpen={staffProfileEditOpen}
                        staffDocumentUploading={staffDocumentUploading}
                        staffProfileSaving={staffProfileSaving}
                        profilePhotoUploading={profilePhotoUploading}
                        blockedDateInput={blockedDateInput}
                        staffAddressSuggestions={staffAddressSuggestions}
                        showStaffAddressSuggestions={showStaffAddressSuggestions}
                        staffAutocompleteRef={staffAutocompleteRef}
                        selectedStaffIdentityCards={selectedStaffIdentityCards}
                        selectedStaffEmploymentCards={selectedStaffEmploymentCards}
                        selectedStaffAvailability={selectedStaffAvailability}
                        selectedStaffBlockedDates={selectedStaffBlockedDates}
                        canEditSelectedStaffProfile={canEditSelectedStaffProfile}
                        canAdminDirectEditSelectedStaffProfile={canAdminDirectEditSelectedStaffProfile}
                        canManagePeopleProfiles={canManagePeopleProfiles}
                        Icons={Icons}
                        getInitials={getInitials}
                        getRoleLabel={getRoleLabel}
                        normalizeStaffProfile={normalizeStaffProfile}
                        setSelectedStaffUid={setSelectedStaffUid}
                        setStaffProfileDraftOwnerUid={setStaffProfileDraftOwnerUid}
                        setStaffProfileDraft={setStaffProfileDraft}
                        setStaffProfileFeedback={setStaffProfileFeedback}
                        setStaffProfileRejectReason={setStaffProfileRejectReason}
                        setStaffProfileEditOpen={setStaffProfileEditOpen}
                        setStaffProfileMobileTab={setStaffProfileMobileTab}
                        setBlockedDateInput={setBlockedDateInput}
                        updateStaffDraftField={updateStaffDraftField}
                        handleStaffAddressChange={handleStaffAddressChange}
                        selectStaffAddressSuggestion={selectStaffAddressSuggestion}
                        handleProfilePhotoCapture={handleProfilePhotoCapture}
                        handleReviewStaffProfileRequest={handleReviewStaffProfileRequest}
                        handleSaveStaffProfileDirect={handleSaveStaffProfileDirect}
                        handleSubmitStaffProfile={handleSubmitStaffProfile}
                        handleStaffDocumentUpload={handleStaffDocumentUpload}
                        updateAvailabilityDayShift={updateAvailabilityDayShift}
                        addBlockedDateToDraft={addBlockedDateToDraft}
                        removeBlockedDateFromDraft={removeBlockedDateFromDraft}
                        handleUpdateEmploymentStatus={handleUpdateEmploymentStatus}
                    />
                )}

                {activeTab === "departments" && canViewAdministration && (
                    <DepartmentsTab
                        DEPARTMENTS={DEPARTMENTS}
                        canViewDepartment={canViewDepartment}
                        setActiveTab={setActiveTab}
                        pendingUsers={pendingUsers}
                        fieldStaff={fieldStaff}
                        getRoleLabel={getRoleLabel}
                        activeBranch={activeBranch}
                    />
                )}
                {activeTab === "permissions" && canManagePermissions && (
                    <PermissionsTab ROLE_DEFINITIONS={ROLE_DEFINITIONS} DEPARTMENTS={DEPARTMENTS} />
                )}

                {activeTab === "edit-requests" && canViewAdministration && (
                    <EditRequestsTab
                        editRequests={editRequests}
                        editRequestResolutions={editRequestResolutions}
                        setEditRequestResolutions={setEditRequestResolutions}
                        handleResolveEdit={handleResolveEdit}
                        handleResolveJobCompletion={handleResolveJobCompletion}
                    />
                )}

                {activeTab === "catalog" && canViewAdministration && (
                    <CatalogTab catalog={v2Catalog} setCatalog={setV2Catalog} onSave={handleSaveV2Catalog} />
                )}

                {activeTab === "promotions" && canViewAdministration && (
                    <PromotionsTab
                        promotionRules={promotionRules}
                        setPromotionRules={setPromotionRules}
                        documentCopy={documentCopy}
                        updateDocumentCopyField={updateDocumentCopyField}
                        handleSavePromotions={handleSavePromotions}
                        promotionSaving={promotionSaving}
                    />
                )}

                {activeTab === "settings" && (
                    <SettingsTab
                        currentUser={currentUser}
                        profileName={profileName}
                        setProfileName={setProfileName}
                        profileLoading={profileLoading}
                        profilePhotoUploading={profilePhotoUploading}
                        profilePhotoStatus={profilePhotoStatus}
                        handleProfileUpdate={handleProfileUpdate}
                        handleProfilePhotoCapture={handleProfilePhotoCapture}
                        canManagePermissions={canManagePermissions}
                        roleLabel={roleLabel}
                        handleSignout={handleSignout}
                        securityForm={securityForm}
                        setSecurityForm={setSecurityForm}
                        securityLoading={securityLoading}
                        handlePasswordChange={handlePasswordChange}
                        getInitials={getInitials}
                        leadSources={leadSources}
                        handleSaveLeadSources={handleSaveLeadSources}
                        canViewAdministration={canViewAdministration}
                        setActiveTab={setActiveTab}
                        Icons={Icons}
                    />
                )}
            </main>

            {/* High Fidelity iOS Fixed Bottom Navigation Bar on Mobile Viewports */}
            <div className="mobile-nav-bar">
                {!isPendingCleanerOnboarding && !isCleanerSelfServiceView && (
                    <button onClick={() => setActiveTab("dashboard")} className={`mobile-nav-item ${activeTab === "dashboard" ? "active" : ""}`}>
                        {Icons.Dashboard()}
                        <span>Dashboard</span>
                    </button>
                )}
                {!isPendingCleanerOnboarding && !isCleanerSelfServiceView && (
                    <button onClick={() => setActiveTab("bookings")} className={`mobile-nav-item ${activeTab === "bookings" ? "active" : ""}`}>
                        {Icons.Bookings()}
                        <span>Bookings</span>
                    </button>
                )}
                {!isPendingCleanerOnboarding && !isCleanerSelfServiceView && (
                    <button onClick={() => setActiveTab("recurring")} className={`mobile-nav-item ${activeTab === "recurring" ? "active" : ""}`}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="17 1 21 5 17 9"/>
                            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                            <polyline points="7 23 3 19 7 15"/>
                            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                        </svg>
                        <span>Recurring</span>
                    </button>
                )}
                {canViewCRM && !isCleanerSelfServiceView && (
                    <button onClick={() => setActiveTab("customers")} className={`mobile-nav-item ${activeTab === "customers" ? "active" : ""}`}>
                        {Icons.Teams()}
                        <span>Customers</span>
                    </button>
                )}
                {canViewCRM && (
                    <button onClick={() => setActiveTab("messages")} className={`mobile-nav-item ${activeTab === "messages" ? "active" : ""}`}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span>{isCleanerSelfServiceView ? "Support" : "Messages"}</span>
                    </button>
                )}
                {canViewOperations && (
                    <button onClick={() => setActiveTab("calendar")} className={`mobile-nav-item ${activeTab === "calendar" ? "active" : ""}`}>
                        {Icons.Calendar()}
                        <span>{isCleanerSelfServiceView ? "Schedule" : "Calendar"}</span>
                    </button>
                )}
                {canViewOperations && (
                    <button onClick={() => setActiveTab("jobs")} className={`mobile-nav-item ${activeTab === "jobs" ? "active" : ""}`}>
                        {Icons.Clock()}
                        <span>Jobs</span>
                    </button>
                )}
                {canViewOperations && (
                    <button onClick={() => setActiveTab("expenses")} className={`mobile-nav-item relative ${activeTab === "expenses" ? "active" : ""}`}>
                        {Icons.Cash()}
                        <span>Expenses</span>
                        {canReviewExpenses && pendingExpenseApprovals.length > 0 && (
                            <span className="absolute -top-1 right-2 bg-amber-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-black">
                                {pendingExpenseApprovals.length}
                            </span>
                        )}
                    </button>
                )}
                {canViewPeople && (
                    <button onClick={() => setActiveTab("teams")} className={`mobile-nav-item ${activeTab === "teams" ? "active" : ""}`}>
                        {Icons.Teams()}
                        <span>{isCleanerSelfServiceView ? "Profile" : "Staff"}</span>
                    </button>
                )}
                {canViewAdministration && (
                    <button onClick={() => setActiveTab("edit-requests")} className={`mobile-nav-item relative ${activeTab === "edit-requests" ? "active" : ""}`}>
                        {Icons.EditReview()}
                        <span>Review</span>
                        {editRequests.filter(r => r.status === "Pending").length > 0 && (
                            <span className="absolute -top-1 right-2 bg-amber-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-black">
                                {editRequests.filter(r => r.status === "Pending").length}
                            </span>
                        )}
                    </button>
                )}
                {canViewAdministration && (
                    <button onClick={() => setActiveTab("payroll")} className={`mobile-nav-item ${activeTab === "payroll" ? "active" : ""}`}>
                        {Icons.Cash()}
                        <span>Payroll</span>
                    </button>
                )}
                {!isPendingCleanerOnboarding && (
                    <button onClick={() => setActiveTab("settings")} className={`mobile-nav-item ${activeTab === "settings" ? "active" : ""}`}>
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        <span>Settings</span>
                    </button>
                )}
            </div>

            {bookingServiceCartOpen && (
                <div className="modal-backdrop show" style={{ zIndex: 15000 }}>
                    <div className="modal-content modal-content-service-config animate-pop">
                        <div className="modal-header modal-header-brand">
                            <div className="modal-title-stack">
                                <h3 className="modal-title-inverse">Edit Booking Services</h3>
                                <p className="modal-subtitle-inverse">Catalog-controlled pricing for this booking</p>
                            </div>
                            <button onClick={() => setBookingServiceCartOpen(false)} className="modal-close-btn" aria-label="Close">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                            </button>
                        </div>
                        <div className="max-h-[70dvh] overflow-y-auto p-5">
                            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <h4 className="font-extrabold text-slate-900">Add from Catalog Studio</h4>
                                        <p className="text-xs text-slate-500">Choose a service, then select its tier and add-ons.</p>
                                    </div>
                                    <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-800">{bookingServiceDraft.length} items</span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {(v2Catalog.categories || []).map(category => (
                                        <button
                                            key={category.id}
                                            type="button"
                                            onClick={() => openServiceConfigurator(category, "booking")}
                                            className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-400 hover:bg-blue-50"
                                        >
                                            <strong className="block text-sm text-slate-900">{category.name}</strong>
                                            <span className="mt-1 block text-xs text-slate-500">From ${getCategoryBasePrice(category).toFixed(2)}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className="mt-4 grid gap-3">
                                {bookingServiceDraft.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No services in this booking.</div>
                                ) : bookingServiceDraft.map(item => {
                                    const addonTotal = (item.addons || []).reduce((sum, addon) => sum + Number(addon.total ?? (Number(addon.price || 0) * Number(addon.qty || 1))), 0);
                                    return (
                                        <article key={item.cartId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h4 className="text-lg font-extrabold text-slate-900">{item.name}</h4>
                                                    <p className="mt-1 text-xs font-semibold text-slate-500">{item.optionName || "Base service"} • {Number(item.durationHrs || 0)} hrs</p>
                                                </div>
                                                <strong className="text-lg text-slate-800">${Number(item.price || 0).toFixed(2)}</strong>
                                            </div>
                                            <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                                                <div className="flex justify-between gap-3"><span>Base service / tier</span><strong>${Number(item.basePrice ?? (Number(item.price || 0) - addonTotal)).toFixed(2)}</strong></div>
                                                {(item.addons || []).map(addon => (
                                                    <div key={addon.id} className="mt-1 flex justify-between gap-3"><span>{addon.name} ×{addon.qty || 1}</span><strong>${Number(addon.total ?? (Number(addon.price || 0) * Number(addon.qty || 1))).toFixed(2)}</strong></div>
                                                ))}
                                            </div>
                                            <div className="mt-4 flex justify-end gap-2">
                                                <button type="button" onClick={() => editAdminCartItem(item, "booking")} className="btn btn-secondary btn-sm">Edit</button>
                                                <button type="button" onClick={() => setBookingServiceDraft(prev => prev.filter(candidate => candidate.cartId !== item.cartId))} className="btn btn-danger btn-sm">Delete</button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </section>
                        </div>
                        <div className="service-config-footer">
                            <div>
                                <span>Subtotal · {bookingServiceDraftTotals.duration.toFixed(1)} hrs</span>
                                <strong>${bookingServiceDraftTotals.subtotal.toFixed(2)}</strong>
                            </div>
                            <button type="button" onClick={applyBookingServiceDraft} className="admin-primary-action">Apply Services to Booking</button>
                        </div>
                    </div>
                </div>
            )}

            {serviceConfigOpen && configCategory && (() => {
                const serviceTypes = configCategory.serviceTypes || [];
                const selectedServiceType = serviceTypes.find(st => st.id === configServiceTypeId);
                const serviceTypeMultiplier = parseFloat(selectedServiceType?.multiplier || 1.0);

                const hasPropertyType = !!configCategory.hasPropertyType;
                const hasBathrooms = !!configCategory.hasBathrooms;

                // When property type is active, filter sizes to the selected group
                const visibleSizes = hasPropertyType
                    ? (configCategory.sizes || []).filter(s => s.propertyTypeId === configPropertyTypeId)
                    : (configCategory.sizes || []);

                const selectedSize = (configCategory.sizes || []).find(size => size.id === configSizeId);
                const rawBasePrice = selectedSize ? parseFloat(selectedSize.price || 0) : getCategoryBasePrice(configCategory);
                const basePrice = rawBasePrice * serviceTypeMultiplier;
                const bathroomPrice = hasBathrooms ? parseFloat(v2Catalog.bathrooms?.[configBathroomKey] || 0) : 0;
                const selectedAddonRows = (configCategory.addons || []).map(addon => {
                    const qty = Number(configAddons[addon.id] || 0);
                    return { ...addon, qty, total: qty * parseFloat(addon.price || 0) };
                });
                const addonTotal = selectedAddonRows.reduce((sum, a) => sum + a.total, 0);
                const grandTotal = basePrice + bathroomPrice + addonTotal;

                return (
                    <div className="modal-backdrop show" style={{ zIndex: 20000 }}>
                        <div className="modal-content modal-content-service-config animate-pop">
                            <div className="modal-header modal-header-brand">
                                <div className="modal-title-stack">
                                    <h3 className="modal-title-inverse">{configEditingCartId ? "Edit Service" : "Configure Service"}</h3>
                                    <p className="modal-subtitle-inverse">{configCategory.name}</p>
                                </div>
                                <button onClick={() => { setServiceConfigOpen(false); setConfigEditingCartId(""); }} className="modal-close-btn" aria-label="Close">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                                </button>
                            </div>
                            <div className="service-config-body">

                                {/* ── Service Type ── */}
                                {serviceTypes.length > 0 && (
                                    <section className="service-config-section">
                                        <div className="service-config-heading">
                                            <h4>Service Type</h4>
                                            {selectedServiceType?.multiplier > 1 && (
                                                <span style={{ color: "#7c3aed", fontWeight: 700 }}>×{serviceTypeMultiplier.toFixed(2)} multiplier</span>
                                            )}
                                        </div>
                                        <div className="service-option-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                                            {serviceTypes.map(st => (
                                                <button
                                                    key={st.id}
                                                    type="button"
                                                    onClick={() => setConfigServiceTypeId(st.id)}
                                                    className={`service-option-card ${configServiceTypeId === st.id ? "active" : ""}`}
                                                >
                                                    <strong>{st.name}</strong>
                                                    <span style={{ color: st.multiplier > 1 ? "#7c3aed" : undefined }}>
                                                        {st.multiplier === 1 ? "Base price" : `×${parseFloat(st.multiplier).toFixed(2)} price`}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* ── Property Type (house cleaning only) ── */}
                                {hasPropertyType && configCategory.propertyTypes?.length > 0 && (
                                    <section className="service-config-section">
                                        <div className="service-config-heading">
                                            <h4>Property Type</h4>
                                        </div>
                                        <div className="service-option-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
                                            {configCategory.propertyTypes.map(pt => (
                                                <button
                                                    key={pt.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setConfigPropertyTypeId(pt.id);
                                                        // Auto-select first size in this property type
                                                        const firstId = (configCategory.sizes || []).find(s => s.propertyTypeId === pt.id)?.id;
                                                        if (firstId) setConfigSizeId(firstId);
                                                    }}
                                                    className={`service-option-card ${configPropertyTypeId === pt.id ? "active" : ""}`}
                                                >
                                                    <strong>{pt.name}</strong>
                                                    <span>{pt.sizeIds?.length || 0} sizes</span>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* ── Size / Scope ── */}
                                <section className="service-config-section">
                                    <div className="service-config-heading">
                                        <h4>{configCategory.sizeLabel || "Subcategory"}</h4>
                                        <span>{configCategory.pricingModel?.replaceAll("_", " ")}</span>
                                    </div>
                                    {visibleSizes.length > 0 ? (
                                        <div className="service-option-grid">
                                            {visibleSizes.map(size => {
                                                const displayPrice = parseFloat(size.price || 0) * serviceTypeMultiplier;
                                                return (
                                                    <button
                                                        key={size.id}
                                                        onClick={() => setConfigSizeId(size.id)}
                                                        type="button"
                                                        className={`service-option-card ${configSizeId === size.id ? "active" : ""}`}
                                                    >
                                                        <strong>{size.name}</strong>
                                                        <span>${displayPrice.toFixed(2)} • {size.durationHrs || 0} hrs</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="service-option-card active">
                                            <strong>Base service</strong>
                                            <span>${basePrice.toFixed(2)} • {getCategoryDuration(configCategory)} hrs</span>
                                        </div>
                                    )}

                                    {/* Bathrooms */}
                                    {hasBathrooms && (
                                        <div className="service-bathroom-picker">
                                            <label htmlFor="bathroom-price-tier">Bathrooms</label>
                                            <select
                                                id="bathroom-price-tier"
                                                value={configBathroomKey}
                                                onChange={e => setConfigBathroomKey(e.target.value)}
                                            >
                                                {Object.entries(v2Catalog.bathrooms || {}).map(([label, price]) => (
                                                    <option key={label} value={label}>
                                                        {label} (+${parseFloat(price || 0).toFixed(2)})
                                                    </option>
                                                ))}
                                            </select>
                                            <span>Bathroom charge: ${bathroomPrice.toFixed(2)}</span>
                                        </div>
                                    )}
                                </section>

                                {/* ── Add-ons ── */}
                                <section className="service-config-section">
                                    <div className="service-config-heading">
                                        <h4>Add-ons</h4>
                                        <span>{configCategory.addons?.length || 0} available</span>
                                    </div>
                                    {configCategory.addons?.length > 0 ? (
                                        <div className="service-addon-list">
                                            {configCategory.addons.map(addon => {
                                                const qty = Number(configAddons[addon.id] || 0);
                                                return (
                                                    <div key={addon.id} className={`service-addon-row ${qty > 0 ? "active" : ""}`}>
                                                        <div>
                                                            <strong>{addon.name}</strong>
                                                            <span>${parseFloat(addon.price || 0).toFixed(2)} each</span>
                                                        </div>
                                                        {addon.qtySelector ? (
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={qty}
                                                                onChange={e => setConfigAddonQty(addon.id, e.target.value)}
                                                            />
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfigAddonQty(addon.id, qty > 0 ? 0 : 1)}
                                                            >
                                                                {qty > 0 ? "Selected" : "Add"}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="admin-cart-empty">No add-ons configured for this service yet.</div>
                                    )}
                                </section>
                            </div>
                            <div className="service-config-footer">
                                <div>
                                    <span>Configured total</span>
                                    <strong>${grandTotal.toFixed(2)}</strong>
                                    {selectedServiceType && selectedServiceType.multiplier > 1 && (
                                        <span style={{ fontSize: 11, color: "#7c3aed", marginLeft: 8 }}>
                                            {selectedServiceType.name} ×{serviceTypeMultiplier.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                                <button onClick={addConfiguredServiceToCart} type="button" className="admin-primary-action">
                                    {configEditingCartId ? "Update Configured Service" : "Add Configured Service"}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {adminCheckoutOpen && (
                <div className="modal-backdrop show">
                    <div className="modal-content modal-content-admin-checkout animate-pop">
                        <div className="modal-header modal-header-brand">
                            <div className="modal-title-stack">
                                <h3 className="modal-title-inverse">Admin Checkout</h3>
                                <p className="modal-subtitle-inverse">{adminServiceCart.length} configured service{adminServiceCart.length === 1 ? "" : "s"}</p>
                            </div>
                            <button onClick={() => { setAdminCheckoutOpen(false); setAdminCheckoutStep(0); }} className="modal-close-btn" aria-label="Close">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                            </button>
                        </div>
                        <form onSubmit={(event) => event.preventDefault()} className="admin-checkout-form">
                            <div className="admin-checkout-stepper">
                                {["Customer", "Schedule", "Review"].map((label, index) => (
                                    <div key={label} className={`rounded-full px-3 py-1 text-xs font-bold ${adminCheckoutStep === index ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                                        {index + 1}. {label}
                                    </div>
                                ))}
                            </div>
                            <div className={`admin-checkout-grid ${adminCheckoutStep === 2 ? "review-mode" : ""}`}>
                                {adminCheckoutStep === 0 && (
                                    <>
                                        <label>
                                            <span>First Name</span>
                                            <input required value={adminCheckoutForm.firstName} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, firstName: e.target.value }))} />
                                        </label>
                                        <label>
                                            <span>Last Name</span>
                                            <input required value={adminCheckoutForm.lastName} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, lastName: e.target.value }))} />
                                        </label>
                                        <label>
                                            <span>Phone</span>
                                            <input required value={adminCheckoutForm.phone} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, phone: e.target.value }))} />
                                        </label>
                                        <label>
                                            <span>Email</span>
                                            <input type="email" required value={adminCheckoutForm.email} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, email: e.target.value }))} />
                                        </label>
                                        <label className="span-2 places-field" ref={adminAutocompleteRef}>
                                            <span>Street Address</span>
                                            <input required value={adminCheckoutForm.address1} onChange={e => handleAdminAddressChange(e.target.value)} />
                                            {showAdminAddressSuggestions && adminAddressSuggestions.length > 0 && (
                                                <div className="places-suggestion-list">
                                                    {adminAddressSuggestions.map(suggestion => (
                                                        <button key={suggestion.place_id} type="button" className="places-suggestion-item" onClick={() => selectAdminAddressSuggestion(suggestion)}>
                                                            {suggestion.description}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </label>
                                        <label>
                                            <span>Unit / Apt</span>
                                            <input value={adminCheckoutForm.address2} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, address2: e.target.value }))} />
                                        </label>
                                        <label>
                                            <span>City</span>
                                            <input required value={adminCheckoutForm.city} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, city: e.target.value }))} />
                                        </label>
                                        <label>
                                            <span>Postal Code</span>
                                            <input required value={adminCheckoutForm.postalCode} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, postalCode: e.target.value }))} />
                                        </label>
                                    </>
                                )}

                                {adminCheckoutStep === 1 && (
                                    <>
                                        <label>
                                            <span>Date</span>
                                            <input type="date" required value={adminCheckoutForm.date} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, date: e.target.value }))} />
                                        </label>
                                        <label>
                                            <span>Estimated Arrival <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>(reference only)</span></span>
                                            <select value={adminCheckoutForm.time} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, time: e.target.value }))}>
                                                {["07:00 AM","07:30 AM","08:00 AM","08:30 AM","09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","01:00 PM","01:30 PM","02:00 PM","02:30 PM","03:00 PM","03:30 PM","04:00 PM","04:30 PM","05:00 PM","05:30 PM","06:00 PM","06:30 PM","07:00 PM"].map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </label>
                                        <label className="span-2">
                                            <span>Shift(s) — select all that apply</span>
                                            <div className="shift-selector">
                                                {SHIFTS.map(s => {
                                                    const isOn = (adminCheckoutForm.shifts || []).includes(s.id);
                                                    return (
                                                        <button key={s.id} type="button"
                                                            className={`shift-btn${isOn ? " selected" : ""}`}
                                                            onClick={() => setAdminCheckoutForm(prev => {
                                                                const cur = prev.shifts || [];
                                                                const next = isOn ? cur.filter(x => x !== s.id) : [...cur, s.id];
                                                                return { ...prev, shifts: next, time: shiftStartTime(next) };
                                                            })}>
                                                            <span className="shift-icon">{s.icon}</span>
                                                            <span className="shift-label">{s.label}</span>
                                                            <span className="shift-hours">{s.hours}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </label>
                                        <div className="span-2 recurring-toggle-row">
                                            <button type="button"
                                                className={`recurring-toggle${adminCheckoutForm.isRecurring ? " on" : ""}`}
                                                onClick={() => setAdminCheckoutForm(prev => ({ ...prev, isRecurring: !prev.isRecurring }))}>
                                                <span className="recurring-toggle-track"><span className="recurring-toggle-knob" /></span>
                                                <span className="recurring-toggle-text">
                                                    <strong>🔁 Recurring Booking</strong>
                                                    <small>{adminCheckoutForm.isRecurring
                                                        ? "The next 3 months will be booked automatically."
                                                        : "One-time job. Turn on to auto-book the next 3 months."}</small>
                                                </span>
                                            </button>
                                            {adminCheckoutForm.isRecurring && (
                                                <div className="recurring-freq-picker">
                                                    {RECURRING_FREQUENCIES.map(freq => (
                                                        <button key={freq} type="button"
                                                            className={`recurring-freq-btn${adminCheckoutForm.recurringFrequency === freq ? " selected" : ""}`}
                                                            onClick={() => setAdminCheckoutForm(prev => ({ ...prev, recurringFrequency: freq }))}>
                                                            {freq}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <label>
                                            <span>Booking Status</span>
                                            <select value={adminCheckoutForm.bookingStatus} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, bookingStatus: e.target.value }))}>
                                                <option value="Lead">Lead</option>
                                                <option value="Follow Up">Follow Up</option>
                                                <option value="Quote">Quote</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Confirmed">Confirmed</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span>Payment Status</span>
                                            <select value={adminCheckoutForm.paymentStatus} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, paymentStatus: e.target.value }))}>
                                                <option value="unpaid">Unpaid</option>
                                                <option value="paid">Paid</option>
                                                <option value="redo">Redo</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span>Payment Method</span>
                                            <select value={adminCheckoutForm.paymentMethod} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, paymentMethod: e.target.value }))}>
                                                <option value="">— Not specified —</option>
                                                <option value="cash">Cash</option>
                                                <option value="e-transfer">E-Transfer</option>
                                                <option value="credit-card">Credit Card</option>
                                                <option value="direct-deposit">Direct Deposit</option>
                                                <option value="cheque">Cheque</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span>Lead Source</span>
                                            <select value={adminCheckoutForm.leadSource || ""} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, leadSource: e.target.value }))}>
                                                <option value="">— Not specified —</option>
                                                {leadSources.map(src => <option key={src} value={src}>{src}</option>)}
                                            </select>
                                        </label>
                                        <div className="span-2 admin-staff-assignment">
                                            <span>Assign Field Staff</span>
                                            <div className="admin-staff-picker">
                                                {fieldStaff.length === 0 ? (
                                                    <p>No approved cleaners, supervisors, employees, or subcontractors found yet.</p>
                                                ) : (
                                                    adminStaffAvailabilityCards.map(({ member, status }) => {
                                                        const checked = adminCheckoutForm.assignedStaffIds.includes(member.uid);
                                                        return (
                                                            <label
                                                                key={member.uid}
                                                                className={`${checked ? "active" : ""} ${!status.available && adminCheckoutForm.date ? "unavailable" : ""}`}
                                                                onMouseEnter={() => setAdminScheduleHint(status.reason)}
                                                                onMouseLeave={() => setAdminScheduleHint("")}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    disabled={!status.available && !checked && Boolean(adminCheckoutForm.date)}
                                                                    onChange={e => setAdminCheckoutForm(prev => {
                                                                        const current = prev.assignedStaffIds || [];
                                                                        return {
                                                                            ...prev,
                                                                            assignedStaffIds: e.target.checked
                                                                                ? [...current, member.uid]
                                                                                : current.filter(uid => uid !== member.uid)
                                                                        };
                                                                    })}
                                                                />
                                                                <strong>{member.name}</strong>
                                                                <small>{getRoleLabel(member.role)} · {member.branchName || "Ottawa"} · {status.reason}</small>
                                                            </label>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                        <label>
                                            <span>Promo Code</span>
                                            <input value={adminCheckoutForm.promoCode} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, promoCode: e.target.value }))} placeholder="PROMO30" />
                                        </label>
                                        <label>
                                            <span>Gift Card Code</span>
                                            <input value={adminCheckoutForm.giftCardCode} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, giftCardCode: e.target.value }))} placeholder="GC-12345" />
                                        </label>
                                        <label>
                                            <span>Discount $</span>
                                            <input type="number" min="0" step="0.01" value={adminCheckoutForm.discountAmount} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, discountAmount: e.target.value }))} />
                                        </label>
                                        <label>
                                            <span>Discount %</span>
                                            <input type="number" min="0" max="100" step="1" value={adminCheckoutForm.discountPercent} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, discountPercent: e.target.value }))} />
                                        </label>
                                        <label className="span-2">
                                            <span>Admin Notes</span>
                                            <textarea rows={3} value={adminCheckoutForm.notes} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, notes: e.target.value }))} />
                                        </label>
                                    </>
                                )}

                                {adminCheckoutStep === 2 && (
                                    <div className="span-2 rounded-3xl border border-slate-200 bg-white p-5">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                            <div>
                                                <h4 className="text-lg font-extrabold text-slate-800">{getBookingDocumentLabel(adminCheckoutForm.bookingStatus)} Preview</h4>
                                                <p className="text-xs text-slate-500">{activeBranch.name} · {activeBranch.email || "info@smartouchclean.com"}</p>
                                            </div>
                                            <img src="/logo-full.png" alt="SmarTouch Clean" className="h-16 w-auto object-contain" />
                                        </div>
                                        <div className="admin-checkout-review-sheet mt-4">
                                            <div className="admin-checkout-review-top">
                                            <div className="admin-checkout-review-card">
                                                <strong>Client</strong>
                                                <p>{adminCheckoutForm.firstName} {adminCheckoutForm.lastName}</p>
                                                <p>{adminCheckoutForm.phone}</p>
                                                <p>{adminCheckoutForm.email}</p>
                                                <p>{adminCheckoutForm.address1}{adminCheckoutForm.address2 ? `, ${adminCheckoutForm.address2}` : ""}</p>
                                                <p>{adminCheckoutForm.city}, {adminCheckoutForm.state} {adminCheckoutForm.postalCode}</p>
                                            </div>
                                            <div className="admin-checkout-review-card">
                                                <strong>Booking</strong>
                                                <p>Document: {getBookingDocumentLabel(adminCheckoutForm.bookingStatus)}</p>
                                                <p>Status: {adminCheckoutForm.bookingStatus}</p>
                                                <p>Payment: {adminCheckoutForm.paymentStatus}</p>
                                                <p>Date: {adminCheckoutForm.date}</p>
                                                <p>Time: {adminCheckoutForm.time}</p>
                                                <p>Assigned: {adminCheckoutForm.assignedStaffIds.length ? fieldStaff.filter(member => adminCheckoutForm.assignedStaffIds.includes(member.uid)).map(member => member.name).join(", ") : "Unassigned"}</p>
                                            </div>
                                            </div>
                                        <div className="admin-checkout-review-lines">
                                            {adminCheckoutPricing.serviceLines.map(item => (
                                                <div key={item.cartId} className="admin-checkout-review-line">
                                                    <div>
                                                        <strong>{item.name}</strong>
                                                        <p>{item.optionName}{item.bathroomKey ? ` • ${item.bathroomKey}` : ""}</p>
                                                    </div>
                                                    <div>
                                                        <span>Estimated duration: {Number(item.durationHrs || 0).toFixed(1)} hrs</span>
                                                    </div>
                                                    <em>${item.price.toFixed(2)}</em>
                                                    <div className="col-span-full mt-1 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                                        <div className="admin-checkout-review-line">
                                                            <div>
                                                                <strong>Base Service</strong>
                                                                <p>{item.optionName || item.name}</p>
                                                            </div>
                                                            <div>
                                                                <span>{item.bathroomKey ? item.bathroomKey : "Included configuration"}</span>
                                                            </div>
                                                            <em>${item.basePortion.toFixed(2)}</em>
                                                        </div>
                                                        {item.addons.length > 0 ? item.addons.map((addon) => (
                                                            <div key={`${item.cartId}-${addon.id}`} className="admin-checkout-review-line">
                                                                <div>
                                                                    <strong>Add-on</strong>
                                                                    <p>{addon.name}</p>
                                                                </div>
                                                                <div>
                                                                    <span>{Number(addon.qty || 1) > 1 ? `Qty ${Number(addon.qty || 1)}` : "Qty 1"}</span>
                                                                </div>
                                                                <em>${(Number(addon.price || 0) * Number(addon.qty || 1)).toFixed(2)}</em>
                                                            </div>
                                                        )) : (
                                                            <div className="admin-checkout-review-line">
                                                                <div>
                                                                    <strong>Add-ons</strong>
                                                                    <p>No add-ons on this service</p>
                                                                </div>
                                                                <div>
                                                                    <span>Included</span>
                                                                </div>
                                                                <em>$0.00</em>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="admin-checkout-review-totals">
                                            <div className="admin-checkout-review-totals-row">
                                                <span>Subtotal</span>
                                                <strong>${adminCartTotals.subtotal.toFixed(2)}</strong>
                                            </div>
                                            {adminCheckoutPricing.fixedDiscount > 0 ? (
                                                <div className="admin-checkout-review-totals-row">
                                                    <span>Manual Discount ($)</span>
                                                    <strong>-${adminCheckoutPricing.fixedDiscount.toFixed(2)}</strong>
                                                </div>
                                            ) : null}
                                            {adminCheckoutPricing.percentDiscountValue > 0 ? (
                                                <div className="admin-checkout-review-totals-row">
                                                    <span>Manual Discount (%)</span>
                                                    <strong>-${adminCheckoutPricing.percentDiscountValue.toFixed(2)}</strong>
                                                </div>
                                            ) : null}
                                            {adminCheckoutForm.promoCode ? (
                                                <div className="admin-checkout-review-totals-row">
                                                    <span>Promo Code (validated on save)</span>
                                                    <strong>{adminCheckoutForm.promoCode}</strong>
                                                </div>
                                            ) : null}
                                            {adminCheckoutForm.giftCardCode ? (
                                                <div className="admin-checkout-review-totals-row">
                                                    <span>Gift Card</span>
                                                    <strong>{adminCheckoutForm.giftCardCode}</strong>
                                                </div>
                                            ) : null}
                                            {adminCheckoutPricing.combinedDiscount > 0 ? (
                                                <div className="admin-checkout-review-totals-row">
                                                    <span>Subtotal after discounts</span>
                                                    <strong>${adminCheckoutPricing.subtotalAfterDiscounts.toFixed(2)}</strong>
                                                </div>
                                            ) : null}
                                            <div className="admin-checkout-review-totals-row">
                                                <span>{activeBranch.taxLabel}</span>
                                                <strong>${adminCheckoutPricing.taxAmount.toFixed(2)}</strong>
                                            </div>
                                            <div className="admin-checkout-review-totals-row total">
                                                <span>Estimated Total</span>
                                                <strong>${adminCheckoutPricing.finalTotal.toFixed(2)}</strong>
                                            </div>
                                            {adminCheckoutForm.promoCode && (
                                                <div className="admin-checkout-review-totals-note">
                                                    A validated promo code will reduce this further and appear as its own line once saved.
                                                </div>
                                            )}
                                        </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <aside className={`admin-checkout-summary ${adminCheckoutStep === 2 ? "review-hidden" : ""}`}>
                                {adminServiceCart.map(item => (
                                    <div key={item.cartId}>
                                        <strong>{item.name}</strong>
                                        <span>{item.optionName}{item.bathroomKey ? ` • ${item.bathroomKey}` : ""}</span>
                                        <em>${item.price.toFixed(2)}</em>
                                    </div>
                                ))}
                                <div className="admin-checkout-total">
                                    <span>Subtotal</span><strong>${adminCartTotals.subtotal.toFixed(2)}</strong>
                                    <span>{activeBranch.taxLabel}</span><strong>${adminCheckoutPricing.taxAmount.toFixed(2)}</strong>
                                    <span>Estimated Total</span><strong>${adminCheckoutPricing.finalTotal.toFixed(2)}</strong>
                                </div>
                            </aside>
                            <div className="admin-checkout-actions">
                                <button type="button" onClick={() => adminCheckoutStep === 0 ? (setAdminCheckoutOpen(false), setAdminCheckoutStep(0)) : setAdminCheckoutStep(prev => Math.max(0, prev - 1))} className="btn btn-secondary btn-sm">
                                    {adminCheckoutStep === 0 ? "Back to Cart" : "Previous"}
                                </button>
                                {adminCheckoutStep < 2 ? (
                                    <button
                                        type="button"
                                        onClick={handleAdminCheckoutNext}
                                        className="btn btn-primary btn-sm"
                                    >
                                        Next Step
                                    </button>
                                ) : (
                                    <button type="button" onClick={saveAdminCartBooking} className="btn btn-primary btn-sm">
                                        Create {getBookingDocumentLabel(adminCheckoutForm.bookingStatus)}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* BOOKING WIZARD */}
            {bookingWizardOpen && (
                <BookingWizard
                    v2Catalog={v2Catalog}
                    promotionRules={promotionRules}
                    onAddToCart={(item) => setAdminServiceCart(prev => [...prev, item])}
                    onCheckout={() => { setBookingWizardOpen(false); checkoutAdminCart(); }}
                    onClose={() => setBookingWizardOpen(false)}
                />
            )}

            {/* MODAL 1: VIEW DETAILS MODAL */}
            {crmCustomerKey && (
                <CustomerProfileModal
                    customerKey={crmCustomerKey}
                    getAuthHeaders={getAuthHeaders}
                    currentUser={currentUser}
                    onClose={() => setCrmCustomerKey(null)}
                />
            )}

            {detailsModalOpen && selectedBooking && (() => {
                const b = selectedBooking;
                const extrasEntries = Object.entries(b.extras || {}).filter(([, qty]) => qty);
                const hasExtras = extrasEntries.length > 0;
                // Same breakdown builder the PDF uses — identical numbers everywhere.
                const priceBreakdown = buildDocumentPricingBreakdown(b, b.companySnapshot || {});
                return (
                    <div className="modal-backdrop show">
                        <div className="modal-content modal-content-details animate-pop">
                            {/* Header */}
                            <div className="modal-header modal-header-brand modal-header-compact">
                                <div className="modal-title-stack">
                                    <h3 className="modal-title-inverse">
                                        {isCleanerSelfServiceView ? "Job Details" : `${getBookingDocumentType(b)} Preview`}
                                    </h3>
                                    <p className="modal-subtitle-inverse">
                                        {getBookingDocumentNumber(b)} · {b.date} · {b.time} · {b.duration}h
                                    </p>
                                </div>
                                <div className="modal-header-actions">
                                    <span className={`detail-status-pill ${statusClassName(b.status)}`}>
                                        {b.status || 'Pending'}
                                    </span>
                                    <button onClick={() => setDetailsModalOpen(false)} className="modal-close-btn" aria-label="Close">
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="modal-body modal-body-scroll">

                                {!isCleanerSelfServiceView && (
                                    <div className="detail-card">
                                        <div className="detail-card-title">👤 Client Information</div>
                                        <div className="detail-card-grid">
                                            <div className="detail-row">
                                                <span className="detail-label">Full Name</span>
                                                <span className="detail-value bold">{b.clientName || `${b.firstName || ''} ${b.lastName || ''}`.trim()}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="detail-label">Phone</span>
                                                <span className="detail-value">{b.phone || '—'}</span>
                                            </div>
                                            <div className="detail-row full-width">
                                                <span className="detail-label">Email</span>
                                                <span className="detail-value">{b.email || '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Address */}
                                <div className="detail-card">
                                    <div className="detail-card-title">📍 Service Address</div>
                                    <div className="detail-card-grid">
                                        <div className="detail-row full-width">
                                            <span className="detail-label">Street</span>
                                            <span className="detail-value">{b.address1}{b.address2 ? `, ${b.address2}` : ''}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">City</span>
                                            <span className="detail-value">{b.city || '—'}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Postal Code</span>
                                            <span className="detail-value">{b.postalCode || '—'}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Province</span>
                                            <span className="detail-value">{b.state || '—'}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Country</span>
                                            <span className="detail-value">{b.country || '—'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Service & Schedule */}
                                <div className="detail-card">
                                    <div className="detail-card-title">🧹 Service & Schedule</div>
                                    <div className="detail-card-grid">
                                        <div className="detail-row full-width">
                                            <span className="detail-label">Service</span>
                                            <span className="detail-value detail-value-brand bold">{b.service}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Bathrooms</span>
                                            <span className="detail-value">{b.bathrooms || '—'}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Frequency</span>
                                            <span className="detail-value">{b.frequency || 'One-Time'}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Date</span>
                                            <span className="detail-value bold">{b.date}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Time Window</span>
                                            <span className="detail-value">{formatTimeWindow(b.time, b.duration)}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Duration</span>
                                            <span className="detail-value">{b.duration} hours</span>
                                        </div>
                                        {!isCleanerSelfServiceView && (
                                            <div className="detail-row">
                                                <span className="detail-label">Document Type</span>
                                                <span className="detail-value">{b.documentStage || getBookingDocumentLabel(b.status)}</span>
                                            </div>
                                        )}
                                        {!isCleanerSelfServiceView && (
                                            <div className="detail-row">
                                                <span className="detail-label">Order Number</span>
                                                <span className="detail-value">{b.orderNumber || b.estimateNumber || b.invoiceNumber || "Pending"}</span>
                                            </div>
                                        )}
                                        {!isCleanerSelfServiceView && (
                                            <div className="detail-row">
                                                <span className="detail-label">Payment Status</span>
                                                <span className="detail-value">{b.paymentStatus === "paid" ? "💳 Paid" : b.paymentStatus || "unpaid"}</span>
                                            </div>
                                        )}
                                        {!isCleanerSelfServiceView && (
                                            <div className="detail-row">
                                                <span className="detail-label">Payment Method</span>
                                                <span className="detail-value">
                                                    {b.paymentMethod === "cash" ? "💵 Cash" :
                                                     b.paymentMethod === "e-transfer" ? "📲 E-Transfer" :
                                                     b.paymentMethod === "credit-card" ? "💳 Credit Card" :
                                                     b.paymentMethod === "direct-deposit" ? "🏦 Direct Deposit" :
                                                     b.paymentMethod === "cheque" ? "📄 Cheque" :
                                                     "—"}
                                                </span>
                                            </div>
                                        )}
                                        {!isCleanerSelfServiceView && b.leadSource && (
                                            <div className="detail-row">
                                                <span className="detail-label">Lead Source</span>
                                                <span className="detail-value">📍 {b.leadSource}</span>
                                            </div>
                                        )}
                                        {!isCleanerSelfServiceView && b.customerConfirmed && (
                                            <div className="detail-row">
                                                <span className="detail-label">Customer Confirmed</span>
                                                <span className="detail-value" style={{color:"#16a34a",fontWeight:700}}>
                                                    ✓ Yes{b.customerConfirmedAt ? ` · ${new Date(b.customerConfirmedAt).toLocaleString("en-CA", {dateStyle:"medium",timeStyle:"short"})}` : ""}
                                                </span>
                                            </div>
                                        )}
                                        {!isCleanerSelfServiceView && (
                                            <div className="detail-row">
                                                <span className="detail-label">Assigned Staff</span>
                                                <span className="detail-value">
                                                    <span className="assigned-staff-list assigned-staff-list-inline">
                                                        {(b.assignedStaff || []).map(member => (
                                                            <span key={member.uid || member.email}>{member.name}</span>
                                                        ))}
                                                        {!b.assignedStaff?.length && <span>{b.team || "Unassigned"}</span>}
                                                    </span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Extras */}
                                {hasExtras && (
                                    <div className="detail-card">
                                        <div className="detail-card-title">✨ Selected Extras</div>
                                        <div className="detail-extras-list">
                                            {extrasEntries.map(([key, qty]) => {
                                                const extra = pricingRates.extras[key];
                                                if (!extra) return null;
                                                const qtyVal = typeof qty === 'boolean' ? 1 : qty;
                                                return (
                                                    <div key={key} className="detail-extra-row">
                                                        <span className="detail-extra-name">• {extra.name}{qtyVal > 1 ? ` × ${qtyVal}` : ''}</span>
                                                        <span className="detail-extra-price">${(extra.price * qtyVal).toFixed(2)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {!isCleanerSelfServiceView && (
                                    <div className="detail-card">
                                        <div className="detail-card-title">💰 Pricing</div>
                                        <div className="detail-pricing-list">
                                            <div className="detail-row">
                                                <span className="detail-label">Subtotal</span>
                                                <span className="detail-value">${priceBreakdown.subtotal.toFixed(2)}</span>
                                            </div>
                                            {priceBreakdown.fixedDiscount > 0 && (
                                                <div className="detail-row">
                                                    <span className="detail-label">Discount (fixed)</span>
                                                    <span className="detail-value detail-discount-value">-${priceBreakdown.fixedDiscount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {priceBreakdown.percentDiscountValue > 0 && (
                                                <div className="detail-row">
                                                    <span className="detail-label">Discount (%)</span>
                                                    <span className="detail-value detail-discount-value">-${priceBreakdown.percentDiscountValue.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {priceBreakdown.promoDiscount > 0 && (
                                                <div className="detail-row">
                                                    <span className="detail-label">
                                                        Promo{priceBreakdown.promoCode ? ` (${priceBreakdown.promoCode})` : ""}
                                                    </span>
                                                    <span className="detail-value detail-discount-value">-${priceBreakdown.promoDiscount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {priceBreakdown.totalDiscount > 0 && (
                                                <div className="detail-row">
                                                    <span className="detail-label">Subtotal after discounts</span>
                                                    <span className="detail-value">${priceBreakdown.subtotalAfterDiscounts.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {priceBreakdown.showTaxAmount && (
                                                <div className="detail-row">
                                                    <span className="detail-label">{priceBreakdown.taxLabel} ({priceBreakdown.taxRatePercent}%)</span>
                                                    <span className="detail-value">${priceBreakdown.taxAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="detail-row">
                                                <span className="detail-label">Total Price{priceBreakdown.showTaxAmount ? "" : ` + ${priceBreakdown.taxLabel} (${priceBreakdown.taxRatePercent}%)`}</span>
                                                <span className="detail-value detail-price-total bold">${(priceBreakdown.showTaxAmount ? priceBreakdown.total : priceBreakdown.subtotalAfterDiscounts).toFixed(2)}</span>
                                            </div>
                                            {b.frequency && b.frequency !== 'One-Time' && (() => {
                                                const freqConfig = pricingRates.frequencies[b.frequency];
                                                const pct = freqConfig ? Math.round((freqConfig.discount > 1 ? freqConfig.discount / 100 : freqConfig.discount) * 100) : 0;
                                                return pct > 0 ? (
                                                    <div className="detail-row">
                                                        <span className="detail-label">Frequency Discount</span>
                                                        <span className="frequency-discount-pill">{b.frequency} — {pct}% off</span>
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {!isCleanerSelfServiceView && Array.isArray(b.auditLog) && b.auditLog.length > 0 && (
                                    <div className="detail-card">
                                        <div className="detail-card-title">ℹ️ Booking Activity</div>
                                        <div className="flex flex-col gap-3">
                                            {[...b.auditLog].slice(-5).reverse().map((entry, index) => (
                                                <div key={`${entry.at || "log"}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <strong className="text-sm text-slate-800">{entry.summary || entry.type || "Update"}</strong>
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{entry.status || "logged"}</span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-slate-500">{entry.by || "system"} · {entry.at ? new Date(entry.at).toLocaleString() : "No timestamp"}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Operations */}
                                <div className="detail-card">
                                    <div className="detail-card-title">🏠 Property & Operations</div>
                                    <div className="detail-card-grid">
                                        <div className="detail-row">
                                            <span className="detail-label">Pets</span>
                                            <span className="detail-value">{b.hasPets ? 'Yes 🐶' : 'No 🚫'}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Parking</span>
                                            <span className="detail-value">{b.freeParking ? 'Free 🚗' : 'Street/Paid ⚠️'}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">First Clean 30 days</span>
                                            <span className="detail-value">{b.firstClean30 ? 'Yes' : 'No'}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Access Mode</span>
                                            <span className="detail-value">{b.accessMode || '—'}</span>
                                        </div>
                                        {b.accessDetails && (
                                            <div className="detail-row full-width">
                                                <span className="detail-label">Access Instructions</span>
                                                <span className="detail-value">{b.accessDetails}</span>
                                            </div>
                                        )}
                                        {b.specialNotes && (
                                            <div className="detail-row full-width">
                                                <span className="detail-label">Special Notes</span>
                                                <span className="detail-value whitespace-pre-wrap">{b.specialNotes}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {detailsModalOpen && (
                                    <JobChatCard
                                        bookingId={b.id}
                                        getAuthHeaders={getAuthHeaders}
                                        currentActorId={currentUser?.uid}
                                    />
                                )}

                            </div>

                            {/* Footer */}
                            <div className="modal-footer">
                                <button onClick={() => setDetailsModalOpen(false)} className="btn btn-secondary btn-sm">Close</button>
                                {!isCleanerSelfServiceView && (
                                    <>
                                        {b.customerConfirmed && b.status === "Pending" && (
                                            <button onClick={() => handleApproveBooking(b)} className="btn btn-sm" style={{background:"#16a34a",color:"#fff",fontWeight:700}}>✓ Approve Job</button>
                                        )}
                                        {b.paymentStatus === "paid" && (
                                            <button onClick={() => handleSendReceipt(b)} className="btn btn-sm" style={{background:"#0A6CB8",color:"#fff",fontWeight:700}}>Send Receipt</button>
                                        )}
                                        {b.status === "Completed" && !b.invoiceNumber && (
                                            <button onClick={() => handleGenerateInvoice(b)} className="btn btn-secondary btn-sm">Generate Invoice</button>
                                        )}
                                        <button onClick={() => handleDownloadBookingDocument(b)} className="btn btn-secondary btn-sm">Download PDF</button>
                                        <button onClick={() => handleSendBookingDocument(b)} className="btn btn-secondary btn-sm">Send To Client</button>
                                    </>
                                )}
                                <button onClick={() => { setDetailsModalOpen(false); isCleanerSelfServiceView ? handleOpenCleanerJob(selectedBooking) : openEditBookingModal(selectedBooking); }} className="btn btn-primary btn-sm">{isCleanerSelfServiceView ? "Open Job" : `Edit ${getBookingDocumentType(selectedBooking)}`}</button>
                            </div>
                        </div>
                    </div>
                );
            })()}



            {/* MODAL 2: DISPATCH EDIT MODAL */}
            {bookingModalOpen && (
                <div className="modal-backdrop show">
                    <div className="modal-content modal-content-booking animate-pop">
                            <div className="modal-header modal-header-brand">
                                <h3 className="modal-title-inverse">
                                    {isCleanerBookingEditor ? "Update Assigned Job" : `Edit ${getBookingDocumentType(bookingForm)}`}
                                </h3>
                                <button onClick={() => setBookingModalOpen(false)} className="modal-close-btn" aria-label="Close">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                                </button>
                            </div>
                            <form onSubmit={handleBookingSubmit} className="modal-form-scroll">
                                <div className="modal-body flex flex-col gap-4 text-xs p-6">
                                    {isCleanerBookingEditor ? (
                                        <>
                                            {/* ── CLEANER JOB WIZARD (modernized, .cjw-* classes in globals.css) ── */}
                                            {cleanerWizardPhase !== "submitted" && cleanerWizardPhase !== "read_only" && (
                                                <div className="cjw-progress">
                                                    {[["Check In", 0], ["Working", 1], ["Submit", 2]].map(([label, i]) => {
                                                        const phases = ["before_start", "in_progress", "after_photos"];
                                                        const cur = phases.indexOf(cleanerWizardPhase);
                                                        const active = cur >= i;
                                                        const done = cur > i;
                                                        return (
                                                            <div key={label} className="cjw-progress-step">
                                                                <div className="cjw-progress-col">
                                                                    <div className={`cjw-progress-dot${done ? " done" : active ? " active" : ""}`}>
                                                                        {done
                                                                            ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3.5 3.5 5.5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                                            : <span>{i + 1}</span>
                                                                        }
                                                                    </div>
                                                                    <span className={`cjw-progress-label${active ? " active" : ""}`}>{label}</span>
                                                                </div>
                                                                {i < 2 && <div className={`cjw-progress-connector${done ? " done" : ""}`} />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* ── SUBMITTED ── */}
                                            {cleanerWizardPhase === "submitted" && (
                                                <div className="cjw-success">
                                                    <div className="cjw-success-badge">
                                                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M6 18l9 9 15-15" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                    </div>
                                                    <div className="cjw-success-title">Job Submitted!</div>
                                                    <div className="cjw-success-body">Your work has been submitted for admin review. You will be notified once it is approved.</div>
                                                </div>
                                            )}

                                            {/* ── READ ONLY (past/future job) ── */}
                                            {cleanerWizardPhase === "read_only" && (
                                                <>
                                                    <div className="cjw-hero">
                                                        <div className="cjw-hero-service">🧹 {bookingForm.service}</div>
                                                        <div className="cjw-hero-meta">
                                                            <div className="cjw-hero-meta-item"><span className="l">Date</span><span className="v">{bookingForm.date}</span></div>
                                                            <div className="cjw-hero-meta-item"><span className="l">Time</span><span className="v">{bookingForm.time}</span></div>
                                                            <div className="cjw-hero-meta-item"><span className="l">Duration</span><span className="v">{bookingForm.duration} hrs</span></div>
                                                        </div>
                                                    </div>
                                                    <a href={getGoogleMapsDirectionsUrl(bookingForm)} target="_blank" rel="noreferrer" className="cjw-address-card">
                                                        <div className="cjw-address-icon">📍</div>
                                                        <div className="cjw-address-text">
                                                            <div className="cjw-address-label">Tap for Directions</div>
                                                            <div className="cjw-address-value">{formatAddress(bookingForm)}</div>
                                                        </div>
                                                        <span className="cjw-address-chevron">›</span>
                                                    </a>
                                                </>
                                            )}

                                            {/* ── BEFORE START ── */}
                                            {cleanerWizardPhase === "before_start" && (() => {
                                                const tasks = activeCleanerJobDraft?.tasks || [];
                                                const reqTasks = tasks.filter(t => t.requiresPhoto);
                                                const beforeDone = reqTasks.every(t => (t.beforePhotos || []).some(p => p.url));
                                                return (
                                                    <>
                                                        <div className="cjw-hero">
                                                            <div className="cjw-hero-service">🧹 {bookingForm.service}</div>
                                                            <div className="cjw-hero-meta">
                                                                <div className="cjw-hero-meta-item"><span className="l">Client</span><span className="v">{bookingForm.firstName || "Client"}</span></div>
                                                                <div className="cjw-hero-meta-item"><span className="l">Date &amp; Time</span><span className="v">{bookingForm.date} · {bookingForm.time}</span></div>
                                                                <div className="cjw-hero-meta-item"><span className="l">Duration</span><span className="v">{bookingForm.duration} hrs</span></div>
                                                                <div className="cjw-hero-meta-item"><span className="l">Frequency</span><span className="v">{bookingForm.frequency || "One-Time"}</span></div>
                                                            </div>
                                                        </div>
                                                        <a href={getGoogleMapsDirectionsUrl(bookingForm)} target="_blank" rel="noreferrer" className="cjw-address-card">
                                                            <div className="cjw-address-icon">📍</div>
                                                            <div className="cjw-address-text">
                                                                <div className="cjw-address-label">Tap for Directions</div>
                                                                <div className="cjw-address-value">{formatAddress(bookingForm)}</div>
                                                            </div>
                                                            <span className="cjw-address-chevron">›</span>
                                                        </a>
                                                        {(bookingForm.accessMode || bookingForm.accessDetails || bookingForm.specialNotes) && (
                                                            <div className="cjw-notice">
                                                                <div className="cjw-notice-title">🔑 Access &amp; Instructions</div>
                                                                {bookingForm.accessMode && <div className="cjw-notice-row"><b>Access:</b> {bookingForm.accessMode}</div>}
                                                                {bookingForm.accessDetails && <div className="cjw-notice-row">{bookingForm.accessDetails}</div>}
                                                                {bookingForm.specialNotes && <div className="cjw-notice-row">{bookingForm.specialNotes}</div>}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="cjw-section-label">📸 Before Photos</div>
                                                            {tasks.length === 0 ? (
                                                                <div className="cjw-empty">No tasks defined for this service.</div>
                                                            ) : (
                                                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                                    {tasks.map(task => (
                                                                        <div key={task.id} className="cjw-task-card">
                                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                                <span className="cjw-task-label">{task.label}</span>
                                                                                {task.requiresPhoto && <span className="cjw-task-tag required">Required</span>}
                                                                            </div>
                                                                            <div className="cjw-photo-grid" style={{ marginTop: 10 }}>
                                                                                {(task.beforePhotos || []).map(photo => (
                                                                                    <div key={photo.id} className="cjw-photo-thumb">
                                                                                        {photo.url
                                                                                            ? <img src={photo.url} alt="" />
                                                                                            : <div className="cjw-photo-thumb pending">{photo.uploading ? "…" : "?"}</div>
                                                                                        }
                                                                                        {!photo.uploading && <button type="button" onClick={() => removeCleanerJobPhoto(bookingForm.id, task.id, "beforePhotos", photo.id)} className="cjw-photo-remove">×</button>}
                                                                                    </div>
                                                                                ))}
                                                                                <label className="cjw-photo-add">
                                                                                    +
                                                                                    <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={e => updateCleanerJobPhotos(bookingForm.id, task.id, "beforePhotos", e.target.files)} />
                                                                                </label>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {reqTasks.length > 0 && !beforeDone && (
                                                            <div className="cjw-hint">Upload required before photos to unlock Start Job</div>
                                                        )}
                                                        <button type="button" onClick={() => handleStartCleanerJob(bookingForm)} disabled={!beforeDone || timeEntrySaving} className="cjw-cta primary">
                                                            {timeEntrySaving ? "Starting…" : "▶  Start Job"}
                                                        </button>
                                                        {jobsFeedback && <div className="people-profile-message">{jobsFeedback}</div>}
                                                    </>
                                                );
                                            })()}

                                            {/* ── IN PROGRESS ── */}
                                            {cleanerWizardPhase === "in_progress" && (() => {
                                                const tasks = activeCleanerJobDraft?.tasks || [];
                                                const completedCount = tasks.filter(t => t.completed).length;
                                                return (
                                                    <>
                                                        <div className="cjw-banner live">
                                                            <div>
                                                                <div className="cjw-banner-title">🟢 Job in Progress</div>
                                                                <div className="cjw-banner-sub">{activeTimeEntry?.startedAt ? formatRuntime(activeTimeEntry.startedAt, jobsNow) : "—"}</div>
                                                            </div>
                                                            <div className="cjw-banner-count">{completedCount}/{tasks.length}</div>
                                                        </div>

                                                        <JobChatCard
                                                            bookingId={bookingForm.id}
                                                            getAuthHeaders={getAuthHeaders}
                                                            currentActorId={currentUser?.uid}
                                                            title="💬 Chat with Customer"
                                                        />

                                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                            <div className="cjw-section-label">Your Tasks</div>
                                                            {tasks.map(task => (
                                                                <div key={task.id} className={`cjw-task-card${task.completed ? " done" : ""}`}>
                                                                    <div className="cjw-task-top">
                                                                        <button type="button" onClick={() => toggleCleanerTaskComplete(bookingForm.id, task.id)} className={`cjw-task-check${task.completed ? " done" : ""}`}>
                                                                            {task.completed && <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                                                        </button>
                                                                        <div className="cjw-task-body">
                                                                            <div className={`cjw-task-label${task.completed ? " done" : ""}`}>{task.label}</div>
                                                                            {task.requiresPhoto && <span className="cjw-task-tag needed">📷 Photo needed</span>}
                                                                            {((task.beforePhotos || []).length > 0 || (task.afterPhotos || []).length > 0) && (
                                                                                <div className="cjw-photo-mini-row">
                                                                                    {[...(task.beforePhotos || []), ...(task.afterPhotos || [])].map(photo => (
                                                                                        <div key={photo.id} className="cjw-photo-mini">
                                                                                            {photo.url ? <img src={photo.url} alt="" /> : (photo.uploading ? "…" : "?")}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {cleanerExtraTaskOpen ? (
                                                                <div className="cjw-add-task-row">
                                                                    <input
                                                                        type="text"
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
                                                                    <button type="button" className="cjw-confirm" onClick={() => { addCleanerExtraTask(bookingForm.id, cleanerExtraTaskInput); setCleanerExtraTaskInput(""); setCleanerExtraTaskOpen(false); }}>Add</button>
                                                                    <button type="button" className="cjw-cancel" onClick={() => { setCleanerExtraTaskInput(""); setCleanerExtraTaskOpen(false); }}>Cancel</button>
                                                                </div>
                                                            ) : (
                                                                <button type="button" onClick={() => setCleanerExtraTaskOpen(true)} className="cjw-add-task-btn">
                                                                    + Add extra task
                                                                </button>
                                                            )}
                                                        </div>

                                                        <button type="button" onClick={() => handleEndCleanerJob(bookingForm)} disabled={timeEntrySaving} className="cjw-cta danger">
                                                            {timeEntrySaving ? "Saving…" : "⏹  End Job & Add After Photos"}
                                                        </button>
                                                        {jobsFeedback && <div className="people-profile-message">{jobsFeedback}</div>}
                                                    </>
                                                );
                                            })()}

                                            {/* ── AFTER PHOTOS ── */}
                                            {cleanerWizardPhase === "after_photos" && (() => {
                                                const tasks = activeCleanerJobDraft?.tasks || [];
                                                const reqTasks = tasks.filter(t => t.requiresPhoto);
                                                const afterDone = reqTasks.every(t => (t.afterPhotos || []).some(p => p.url));
                                                return (
                                                    <>
                                                        <div className="cjw-banner warn" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                                            <div className="cjw-banner-title" style={{ color: "#c2410c" }}>Almost done!</div>
                                                            <div className="cjw-banner-sub">Tasks: {tasks.filter(t => t.completed).length}/{tasks.length} completed · Upload after photos then submit for review.</div>
                                                        </div>

                                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                            <div className="cjw-section-label">📸 After Photos &amp; Task Review</div>
                                                            {tasks.map(task => (
                                                                <div key={task.id} className="cjw-task-card">
                                                                    <div className="cjw-task-top" style={{ marginBottom: 4 }}>
                                                                        <button type="button" onClick={() => toggleCleanerTaskComplete(bookingForm.id, task.id)} className={`cjw-task-check${task.completed ? " done" : ""}`}>
                                                                            {task.completed && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                                                        </button>
                                                                        <div className="cjw-task-body">
                                                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                                                <span className={`cjw-task-label${task.completed ? " done" : ""}`}>{task.label}</span>
                                                                                {task.requiresPhoto && <span className="cjw-task-tag required">Required</span>}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ paddingLeft: 40 }}>
                                                                        <div className="cjw-photo-caption">After Photos</div>
                                                                        <div className="cjw-photo-grid">
                                                                            {(task.afterPhotos || []).map(photo => (
                                                                                <div key={photo.id} className="cjw-photo-thumb">
                                                                                    {photo.url
                                                                                        ? <img src={photo.url} alt="" />
                                                                                        : <div className="cjw-photo-thumb pending">{photo.uploading ? "…" : "?"}</div>
                                                                                    }
                                                                                    {!photo.uploading && <button type="button" onClick={() => removeCleanerJobPhoto(bookingForm.id, task.id, "afterPhotos", photo.id)} className="cjw-photo-remove">×</button>}
                                                                                </div>
                                                                            ))}
                                                                            <label className="cjw-photo-add">
                                                                                +
                                                                                <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={e => updateCleanerJobPhotos(bookingForm.id, task.id, "afterPhotos", e.target.files)} />
                                                                            </label>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {reqTasks.length > 0 && !afterDone && (
                                                            <div className="cjw-hint">Upload required after photos to submit for review</div>
                                                        )}
                                                        <button type="button" onClick={() => handleSubmitJobForReview(bookingForm)} disabled={!afterDone || timeEntrySaving} className="cjw-cta success">
                                                            {timeEntrySaving ? "Submitting…" : "✅  Submit Job for Review"}
                                                        </button>
                                                        {jobsFeedback && <div className="people-profile-message">{jobsFeedback}</div>}
                                                    </>
                                                );
                                            })()}
                                        </>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Client First Name</label>
                                                    <input type="text" value={bookingForm.firstName} onChange={e => setBookingForm(prev => ({ ...prev, firstName: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Client Last Name</label>
                                                    <input type="text" value={bookingForm.lastName} onChange={e => setBookingForm(prev => ({ ...prev, lastName: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                                </div>
                                                {showBookingContactFields && (
                                                    <div className="form-group flex flex-col gap-1">
                                                        <label className="font-bold text-slate-700">Client Phone</label>
                                                        <input type="text" value={bookingForm.phone} onChange={e => setBookingForm(prev => ({ ...prev, phone: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                                    </div>
                                                )}
                                                {showBookingContactFields && (
                                                    <div className="form-group flex flex-col gap-1">
                                                        <label className="font-bold text-slate-700">Client Email</label>
                                                        <input type="email" value={bookingForm.email} onChange={e => setBookingForm(prev => ({ ...prev, email: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="form-group flex flex-col gap-1 places-field" ref={autocompleteRef}>
                                                <label className="font-bold text-slate-700">Service Street Address</label>
                                                <input type="text" value={bookingForm.address1} onChange={handleAddressChange} required className="border border-slate-200 rounded-lg p-2" />
                                                {showSuggestions && addressSuggestions.length > 0 && (
                                                    <div className="places-suggestion-list">
                                                        {addressSuggestions.map(suggestion => (
                                                            <button key={suggestion.place_id} type="button" className="places-suggestion-item" onClick={() => selectSuggestion(suggestion)}>
                                                                {suggestion.description}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">City</label>
                                                    <input type="text" value={bookingForm.city} onChange={e => setBookingForm(prev => ({ ...prev, city: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Postal Code</label>
                                                    <input type="text" value={bookingForm.postalCode} onChange={e => setBookingForm(prev => ({ ...prev, postalCode: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                                </div>
                                            </div>

                                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Booked Services</div>
                                                        <p className="mt-1 text-sm text-slate-500">Catalog pricing is protected. Use the catalog editor to change tiers or add-ons.</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button type="button" onClick={openBookingServiceEditor} className="btn btn-primary btn-sm">Edit Services from Catalog</button>
                                                        {isSuperAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setBookingPriceOverrideOpen(prev => !prev)}
                                                                className="btn btn-secondary btn-sm"
                                                            >
                                                                {bookingPriceOverrideOpen ? "Close Price Override" : "Override Name / Price"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-4 grid gap-3">
                                                    {(bookingForm.cartItems || []).map((item) => (
                                                        <div key={item.cartId} className="rounded-2xl border border-slate-200 bg-white p-4">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div>
                                                                    <strong className="text-slate-900">{item.name}</strong>
                                                                    <p className="mt-1 text-xs text-slate-500">{item.optionName || "Base service"}{item.bathroomKey ? ` • ${item.bathroomKey}` : ""} • {Number(item.durationHrs || 0)} hrs</p>
                                                                    {(item.addons || []).length > 0 && (
                                                                        <p className="mt-2 text-xs text-slate-500">Add-ons: {item.addons.map(addon => `${addon.name} ×${addon.qty || 1}`).join(", ")}</p>
                                                                    )}
                                                                </div>
                                                                <strong className="text-lg text-blue-900">${Number(item.price || 0).toFixed(2)}</strong>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {isSuperAdmin && bookingPriceOverrideOpen && (
                                                    <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <strong className="text-amber-900">Super Admin Override</strong>
                                                                <p className="text-xs text-amber-700">Changes apply only to this booking and are recorded in its audit log.</p>
                                                            </div>
                                                            <button type="button" onClick={addBookingServiceLine} className="btn btn-secondary btn-sm">Add Manual Service</button>
                                                        </div>
                                                        <div className="mt-4 grid gap-3">
                                                            {(bookingForm.cartItems || []).map(item => (
                                                                <div key={item.cartId} className="grid gap-3 rounded-xl border border-amber-200 bg-white p-3 md:grid-cols-[1fr,160px,auto]">
                                                                    <label className="flex flex-col gap-1">
                                                                        <span className="text-xs font-bold text-slate-600">Service Name</span>
                                                                        <input value={item.name} onChange={e => updateBookingCartItem(item.cartId, "name", e.target.value)} className="rounded-lg border border-slate-200 p-2" />
                                                                    </label>
                                                                    <label className="flex flex-col gap-1">
                                                                        <span className="text-xs font-bold text-slate-600">Line Price</span>
                                                                        <input type="number" min="0" step="0.01" value={item.price} onChange={e => updateBookingCartItem(item.cartId, "price", Number(e.target.value || 0))} className="rounded-lg border border-slate-200 p-2" />
                                                                    </label>
                                                                    <button type="button" onClick={() => removeBookingServiceLine(item.cartId)} className="btn btn-danger btn-sm self-end">Delete</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Scheduled Date</label>
                                                    <input type="date" value={bookingForm.date} onChange={e => setBookingForm(prev => ({ ...prev, date: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Estimated Arrival <span style={{ fontWeight: 600, color: "#94a3b8", fontSize: 10 }}>(reference only)</span></label>
                                                    <select value={bookingForm.time} onChange={e => setBookingForm(prev => ({ ...prev, time: e.target.value }))} className="border border-slate-200 rounded-lg p-2 bg-white">
                                                        {["07:00 AM","07:30 AM","08:00 AM","08:30 AM","09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","01:00 PM","01:30 PM","02:00 PM","02:30 PM","03:00 PM","03:30 PM","04:00 PM","04:30 PM","05:00 PM","05:30 PM","06:00 PM","06:30 PM","07:00 PM"].map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Estimated Hours</label>
                                                    <input type="number" step="0.5" value={bookingForm.duration} readOnly required className="border border-slate-200 rounded-lg bg-slate-50 p-2 text-slate-600" />
                                                </div>
                                                <div className="form-group flex flex-col gap-1 md:col-span-3">
                                                    <label className="font-bold text-slate-700">Shift(s)</label>
                                                    <div className="shift-selector">
                                                        {SHIFTS.map(s => {
                                                            const isOn = (bookingForm.shifts || []).includes(s.id);
                                                            return (
                                                                <button key={s.id} type="button"
                                                                    className={`shift-btn${isOn ? " selected" : ""}`}
                                                                    onClick={() => setBookingForm(prev => {
                                                                        const cur = prev.shifts || [];
                                                                        const next = isOn ? cur.filter(x => x !== s.id) : [...cur, s.id];
                                                                        return { ...prev, shifts: next, time: shiftStartTime(next) };
                                                                    })}>
                                                                    <span className="shift-icon">{s.icon}</span>
                                                                    <span className="shift-label">{s.label}</span>
                                                                    <span className="shift-hours">{s.hours}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="recurring-toggle-row">
                                                <button type="button"
                                                    className={`recurring-toggle${bookingForm.isRecurring ? " on" : ""}`}
                                                    onClick={() => setBookingForm(prev => ({
                                                        ...prev,
                                                        isRecurring: !prev.isRecurring,
                                                        frequency: !prev.isRecurring
                                                            ? (RECURRING_FREQUENCIES.includes(prev.frequency) ? prev.frequency : "Weekly")
                                                            : "One-Time"
                                                    }))}>
                                                    <span className="recurring-toggle-track"><span className="recurring-toggle-knob" /></span>
                                                    <span className="recurring-toggle-text">
                                                        <strong>🔁 Recurring Booking</strong>
                                                        <small>{bookingForm.isRecurring
                                                            ? (bookingForm.recurringSeriesId
                                                                ? "Part of a recurring series — extends automatically when the last visit completes."
                                                                : "Saving will book the next 3 months automatically.")
                                                            : "One-time job. Turn on to auto-book the next 3 months."}</small>
                                                    </span>
                                                </button>
                                                {bookingForm.isRecurring && (
                                                    <div className="recurring-freq-picker">
                                                        {RECURRING_FREQUENCIES.map(freq => (
                                                            <button key={freq} type="button"
                                                                className={`recurring-freq-btn${bookingForm.frequency === freq ? " selected" : ""}`}
                                                                onClick={() => setBookingForm(prev => ({ ...prev, frequency: freq }))}>
                                                                {freq}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="form-group flex flex-col gap-1 md:col-span-3">
                                                    <label className="font-bold text-slate-700">Assigned Field Staff</label>
                                                    <div className="admin-staff-picker">
                                                        {fieldStaff.length === 0 ? (
                                                            <p>No approved field staff found yet.</p>
                                                        ) : bookingStaffAvailabilityCards.map(({ member, status }) => {
                                                            const assignedIds = bookingForm.assignedStaffIds || [];
                                                            const checked = assignedIds.includes(member.uid);
                                                            return (
                                                                <label key={member.uid} className={`${checked ? "active" : ""} ${!status.available && bookingForm.date ? "unavailable" : ""}`}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        disabled={!status.available && !checked && Boolean(bookingForm.date)}
                                                                        onChange={e => setBookingForm(prev => {
                                                                            const current = prev.assignedStaffIds || [];
                                                                            const nextIds = e.target.checked
                                                                                ? [...current, member.uid]
                                                                                : current.filter(uid => uid !== member.uid);
                                                                            const nextStaff = fieldStaff
                                                                                .filter(person => nextIds.includes(person.uid))
                                                                                .map(person => ({
                                                                                    uid: person.uid,
                                                                                    name: person.name,
                                                                                    email: person.email,
                                                                                    role: person.role,
                                                                                    branchId: person.branchId || activeBranch.id
                                                                                }));
                                                                            return {
                                                                                ...prev,
                                                                                team: "",
                                                                                assignedStaffIds: nextIds,
                                                                                assignedStaff: nextStaff
                                                                            };
                                                                        })}
                                                                    />
                                                                    <strong>{member.name}</strong>
                                                                    <small>{getRoleLabel(member.role)} · {member.branchName || "Ottawa"} · {status.reason}</small>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Dispatch Status</label>
                                                    <select value={bookingForm.status} onChange={e => setBookingForm(prev => ({ ...prev, status: e.target.value }))} required className="border border-slate-200 rounded-lg p-2">
                                                        <option value="Lead">Lead</option>
                                                        <option value="Follow Up">Follow Up</option>
                                                        <option value="Quote">Quote</option>
                                                        <option value="Pending">Pending</option>
                                                        <option value="Confirmed">Confirmed</option>
                                                        <option value="Completed">Completed</option>
                                                        <option value="Cancelled">Cancelled</option>
                                                    </select>
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Material Cost ($)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={bookingForm.materialCost || ""}
                                                        onChange={e => setBookingForm(prev => ({ ...prev, materialCost: e.target.value }))}
                                                        placeholder="0.00"
                                                        className="border border-slate-200 rounded-lg p-2"
                                                    />
                                                    <small className="text-slate-400">Feeds job profitability once marked Completed.</small>
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Payment Status</label>
                                                    <select value={bookingForm.paymentStatus} onChange={e => setBookingForm(prev => ({ ...prev, paymentStatus: e.target.value }))} required className="border border-slate-200 rounded-lg p-2">
                                                        <option value="unpaid">Unpaid</option>
                                                        <option value="partial">Partial</option>
                                                        <option value="paid">Paid</option>
                                                        <option value="redo">Redo</option>
                                                    </select>
                                                </div>
                                                {bookingForm.paymentStatus === "partial" && (
                                                    <div className="form-group flex flex-col gap-1">
                                                        <label className="font-bold text-slate-700">Amount Received ($)</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            max={bookingForm.price || undefined}
                                                            value={bookingForm.amountReceived || ""}
                                                            onChange={e => setBookingForm(prev => ({ ...prev, amountReceived: e.target.value }))}
                                                            placeholder="0.00"
                                                            className="border border-slate-200 rounded-lg p-2"
                                                        />
                                                        <small className="text-slate-400">Balance due: ${Math.max(0, parseFloat(bookingForm.price || 0) - parseFloat(bookingForm.amountReceived || 0)).toFixed(2)}</small>
                                                    </div>
                                                )}
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Payment Method</label>
                                                    <select value={bookingForm.paymentMethod || ""} onChange={e => setBookingForm(prev => ({ ...prev, paymentMethod: e.target.value }))} className="border border-slate-200 rounded-lg p-2">
                                                        <option value="">— Not specified —</option>
                                                        <option value="cash">Cash</option>
                                                        <option value="e-transfer">E-Transfer</option>
                                                        <option value="credit-card">Credit Card</option>
                                                        <option value="direct-deposit">Direct Deposit</option>
                                                        <option value="cheque">Cheque</option>
                                                    </select>
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Lead Source</label>
                                                    <select value={bookingForm.leadSource || ""} onChange={e => setBookingForm(prev => ({ ...prev, leadSource: e.target.value }))} className="border border-slate-200 rounded-lg p-2">
                                                        <option value="">— Not specified —</option>
                                                        {leadSources.map(src => <option key={src} value={src}>{src}</option>)}
                                                    </select>
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Manual Discount ($)</label>
                                                    <input type="number" step="0.01" value={bookingForm.customDiscountAmount || 0} onChange={e => setBookingForm(prev => syncBookingFormCartTotals({ ...prev, customDiscountAmount: parseFloat(e.target.value || 0) }))} className="border border-slate-200 rounded-lg p-2" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Manual Discount (%)</label>
                                                    <input type="number" step="1" min="0" max="100" value={bookingForm.customDiscountPercent || 0} onChange={e => setBookingForm(prev => syncBookingFormCartTotals({ ...prev, customDiscountPercent: parseFloat(e.target.value || 0) }))} className="border border-slate-200 rounded-lg p-2" />
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Promo Code</label>
                                                    <input type="text" value={bookingForm.promoCode || ""} onChange={e => setBookingForm(prev => ({ ...prev, promoCode: e.target.value }))} className="border border-slate-200 rounded-lg p-2" />
                                                </div>
                                                <div className="form-group flex flex-col gap-1">
                                                    <label className="font-bold text-slate-700">Gift Card</label>
                                                    <input type="text" value={bookingForm.giftCardCode || ""} onChange={e => setBookingForm(prev => ({ ...prev, giftCardCode: e.target.value }))} className="border border-slate-200 rounded-lg p-2" />
                                                </div>
                                                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                                                    <div className="text-xs font-bold uppercase tracking-wider text-blue-700">Live Totals</div>
                                                    {(() => {
                                                        const livePricing = computeBookingPricing({
                                                            subtotal: bookingForm.subtotal || 0,
                                                            customDiscountAmount: bookingForm.customDiscountAmount || 0,
                                                            customDiscountPercent: bookingForm.customDiscountPercent || 0,
                                                            promoDiscount: bookingForm.promoDiscount || 0,
                                                            taxRate: activeBranch.taxRate
                                                        });
                                                        return (
                                                            <>
                                                                <div className="mt-2 text-sm text-slate-700">Subtotal: <strong>${livePricing.subtotal.toFixed(2)}</strong></div>
                                                                {livePricing.manualDiscount > 0 && (
                                                                    <div className="text-sm text-rose-600">Manual discount: <strong>-${livePricing.manualDiscount.toFixed(2)}</strong></div>
                                                                )}
                                                                {livePricing.promoDiscount > 0 && (
                                                                    <div className="text-sm text-rose-600">Promo{bookingForm.promoCode ? ` (${bookingForm.promoCode})` : ""}: <strong>-${livePricing.promoDiscount.toFixed(2)}</strong></div>
                                                                )}
                                                                <div className="text-sm text-slate-700">{activeBranch.taxLabel}: <strong>${livePricing.taxAmount.toFixed(2)}</strong></div>
                                                                <div className="text-sm text-slate-900">Total: <strong>${livePricing.total.toFixed(2)}</strong></div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">Special Instructions / Dispatch Notes</label>
                                                <textarea rows={2} value={bookingForm.specialNotes} onChange={e => setBookingForm(prev => ({ ...prev, specialNotes: e.target.value }))} className="border border-slate-200 rounded-lg p-2 resize-none" />
                                            </div>
                                        </>
                                    )}

                                </div>
                                <div className="modal-footer flex justify-end gap-3 p-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setBookingModalOpen(false)} className="btn btn-secondary btn-sm rounded-lg font-bold">
                                        Cancel
                                    </button>
                                    {!isCleanerBookingEditor && (
                                        <button type="submit" className="btn btn-primary btn-sm rounded-lg text-white font-bold">
                                            Save Changes
                                        </button>
                                    )}
                                </div>
                            </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: DISPATCH CREW MODAL */}
            {teamModalOpen && canViewPeople && (
                <div className="modal-backdrop show">
                    <div className="modal-content modal-content-team animate-pop">
                        <div className="modal-header modal-header-brand">
                            <h3 className="modal-title-inverse">Dispatch New Cleaning Crew</h3>
                            <button onClick={() => setTeamModalOpen(false)} className="modal-close-btn" aria-label="Close">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleTeamSubmit} className="modal-form-scroll">
                            <div className="modal-body flex flex-col gap-4 text-xs p-6">
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Crews Name *</label>
                                    <input type="text" required value={teamForm.name} onChange={e => setTeamForm(prev => ({ ...prev, name: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5" placeholder="Team Sparkle" />
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Team Color Theme *</label>
                                    <select value={teamForm.color} onChange={e => setTeamForm(prev => ({ ...prev, color: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5">
                                        <option value="sparkle">Sparkle (Blue)</option>
                                        <option value="deluxe">Deluxe (Purple)</option>
                                        <option value="ecoclean">EcoClean (Green)</option>
                                    </select>
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Crew Leader *</label>
                                    <select
                                        required
                                        value={teamForm.lead}
                                        onChange={e => setTeamForm(prev => ({ ...prev, lead: e.target.value }))}
                                        className="border border-slate-200 rounded-lg p-2.5"
                                    >
                                        <option value="">-- Select Registered Leader --</option>
                                        {teamForm.lead && !teamLeaders.some(l => l.name === teamForm.lead) && (
                                            <option value={teamForm.lead}>{teamForm.lead} (Assigned Leader)</option>
                                        )}
                                        {teamLeaders.length === 0 ? (
                                            <option value="" disabled>No registered team leaders found. Please have leaders register first.</option>
                                        ) : (
                                            teamLeaders.map(leader => (
                                                <option key={leader.uid || leader.email} value={leader.name}>
                                                    {leader.name} ({leader.email})
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Employment Type *</label>
                                    <select value={teamForm.employmentType || "in_house"} onChange={e => setTeamForm(prev => ({ ...prev, employmentType: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5">
                                        <option value="in_house">In-House Staff</option>
                                        <option value="subcontractor">Subcontractor</option>
                                    </select>
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Staff Count (Size)</label>
                                    <input type="number" value={teamForm.size} onChange={e => setTeamForm(prev => ({ ...prev, size: parseInt(e.target.value || 0) }))} className="border border-slate-200 rounded-lg p-2.5" />
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Crews Active Members (Comma separated)</label>
                                    <input type="text" value={teamForm.members} onChange={e => setTeamForm(prev => ({ ...prev, members: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5" placeholder="Emma Vance, Alice Smith, John Doe" />
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Service Description / Mottos</label>
                                    <textarea value={teamForm.description} onChange={e => setTeamForm(prev => ({ ...prev, description: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5" placeholder="Deep Cleaning & Sparkle residential cleans..." />
                                </div>
                                <div className="form-group flex flex-col gap-1 mt-4 border-t border-slate-200 pt-4">
                                    <label className="font-bold text-slate-700 flex justify-between items-center">
                                        <span>Blocked Dates (Unavailable)</span>
                                    </label>
                                    <p className="text-[10px] text-slate-400 mb-2">Select dates this team is off duty or fully booked. These dates will be hidden in the checkout flow.</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            id={`team-block-date-${teamForm.id}`}
                                            className="border border-slate-200 rounded-lg p-2 flex-grow text-xs"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const el = document.getElementById(`team-block-date-${teamForm.id}`);
                                                if (el && el.value) {
                                                    const dateStr = el.value; // YYYY-MM-DD
                                                    setTeamForm(prev => {
                                                        const current = prev.availability || {};
                                                        return {
                                                            ...prev,
                                                            availability: {
                                                                ...current,
                                                                [dateStr]: "blocked"
                                                            }
                                                        };
                                                    });
                                                    el.value = "";
                                                }
                                            }}
                                            className="bg-slate-800 text-white font-bold px-4 rounded-lg text-xs"
                                        >
                                            Block Date
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {Object.entries(teamForm.availability || {}).map(([date, status]) => {
                                            if (status === "blocked") {
                                                return (
                                                    <span key={date} className="bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded text-xs font-bold flex items-center gap-2">
                                                        {date}
                                                        <button
                                                            type="button"
                                                            onClick={() => setTeamForm(prev => {
                                                                const newAvail = { ...prev.availability };
                                                                delete newAvail[date];
                                                                return { ...prev, availability: newAvail };
                                                            })}
                                                            className="hover:text-red-900"
                                                        >×</button>
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setTeamModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                                <button type="submit" className="btn btn-primary btn-sm">Create Crew</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
