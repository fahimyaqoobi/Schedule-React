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
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "../lib/firebase";
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
    Loading: () => <svg className="animate-spin" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
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
// This isolates the new dynamic cart engine from the old v1 system during development.
const INITIAL_V2_CATALOG = {
    categories: [
        {
            id: 'house_cleaning',
            name: 'House Cleaning (Interior)',
            pricingModel: 'size_based', // flat_rate, size_based, hourly, flat_plus_unit
            baseRate: 0,
            sizes: [
                { id: 'hc_1bed', name: 'Studio or 1 Bedroom', price: 87.50, durationHrs: 2 },
                { id: 'hc_2bed', name: '2 bedroom apartment', price: 101.50, durationHrs: 2.5 },
                { id: 'hc_3bed_apt', name: '3 bedroom apartment or townhouse', price: 115.50, durationHrs: 3 },
                { id: 'hc_3bed_house', name: '3 or 4 bedroom house (or between 1700 to 1999 sqft)', price: 143.50, durationHrs: 3.5 },
                { id: 'hc_2000sqft', name: 'between 2000 to 2499 sq ft', price: 150.50, durationHrs: 4 },
                { id: 'hc_2500sqft', name: 'between 2500 to 2999 sq ft', price: 175.00, durationHrs: 4.5 },
                { id: 'hc_3000sqft', name: 'between 3000 to 3499 sq ft', price: 208.60, durationHrs: 5 },
                { id: 'hc_3500sqft', name: 'between 3500 to 3999 sq ft', price: 243.60, durationHrs: 5.5 }
            ],
            addons: [
                { id: 'firstTimeClean', name: 'First Time Clean Upgrade', price: 87.50, qtySelector: false },
                { id: 'moveInOut', name: 'Move In/Out Upgrade', price: 87.50, qtySelector: false },
                { id: 'havePets', name: 'I Have Pets Premium', price: 17.50, qtySelector: false },
                { id: 'insideOven', name: 'Inside the Oven', price: 31.50, qtySelector: true },
                { id: 'insideEmptyFridge', name: 'Inside an Empty Fridge', price: 17.50, qtySelector: true },
                { id: 'insideFullFridge', name: 'Inside a Full Fridge', price: 31.50, qtySelector: true },
                { id: 'secondKitchen', name: 'Second Kitchen', price: 35.00, qtySelector: false },
                { id: 'walls', name: 'Walls ($14 per room)', price: 14.00, qtySelector: true },
                { id: 'shedPoolHouse', name: 'Shed/Pool House', price: 52.50, qtySelector: false },
                { id: 'insideCabinets', name: 'Inside Cabinets (emptied)', price: 35.00, qtySelector: false },
                { id: 'interiorWindows', name: 'Interior Windows ($7 per window)', price: 7.00, qtySelector: true },
                { id: 'slidingDoorWindow', name: 'Sliding Door Interior Window', price: 14.00, qtySelector: true },
                { id: 'garageSweep', name: 'Garage Sweep', price: 21.00, qtySelector: false },
                { id: 'balconySweep', name: 'Balcony Sweep', price: 14.00, qtySelector: true },
                { id: 'homeConcierge', name: 'Home Concierge ($35/hr, min 2 hrs)', price: 35.00, qtySelector: true, minQty: 2 },
                { id: 'organization', name: 'Organization ($56/hr, min 3 hrs)', price: 56.00, qtySelector: true, minQty: 3 },
                { id: 'laundryWashFold', name: 'Laundry - Wash & Fold (per load)', price: 17.50, qtySelector: true }
            ]
        },
        {
            id: 'window_washing',
            name: 'Window Washing (Exterior)',
            pricingModel: 'flat_plus_unit',
            baseRate: 150.00,
            durationHrs: 2,
            unitName: 'Additional Pane',
            unitPrice: 5.00,
            sizes: [],
            addons: [
                { id: 'screenCleaning', name: 'Screen Cleaning', price: 20.00, qtySelector: false },
                { id: 'hardWaterStain', name: 'Hard Water Stain Removal', price: 35.00, qtySelector: false }
            ]
        },
        {
            id: 'pressure_washing_siding',
            name: 'Pressure Washing (Siding)',
            pricingModel: 'flat_plus_sqft',
            baseRate: 200.00,
            durationHrs: 2.5,
            unitName: 'Per Sq Ft over 1000',
            unitPrice: 0.20,
            sizes: [],
            addons: []
        },
        {
            id: 'pressure_washing_deck',
            name: 'Pressure Washing (Deck, Sidewalk, Concrete)',
            pricingModel: 'flat_rate',
            baseRate: 150.00,
            durationHrs: 2,
            sizes: [],
            addons: []
        },
        {
            id: 'gutter_cleaning',
            name: 'Gutter & Downspout Cleaning',
            pricingModel: 'flat_rate',
            baseRate: 150.00,
            durationHrs: 1.5,
            sizes: [
                { id: 'gc_1story', name: '1-Story Home', price: 150.00, durationHrs: 1.5 },
                { id: 'gc_2story', name: '2-Story Home', price: 250.00, durationHrs: 2.5 }
            ],
            addons: [
                { id: 'downspoutFlush', name: 'Downspout Flushing', price: 50.00, qtySelector: false }
            ]
        },
        {
            id: 'lawn_mowing',
            name: 'Lawn Mower Mowing',
            pricingModel: 'flat_rate',
            baseRate: 60.00,
            durationHrs: 1,
            sizes: [
                { id: 'lm_small', name: 'Small Yard (Under 1/4 acre)', price: 60.00, durationHrs: 1 },
                { id: 'lm_med', name: 'Medium Yard (1/4 to 1/2 acre)', price: 90.00, durationHrs: 1.5 },
                { id: 'lm_large', name: 'Large Yard (Over 1/2 acre)', price: 140.00, durationHrs: 2 }
            ],
            addons: [
                { id: 'edgeTrimming', name: 'Edge Trimming', price: 25.00, qtySelector: false },
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
        'One-Time': { name: 'one time service', discount: 0 },
        'Weekly': { name: 'Weekly 20% off', discount: 0.20 },
        'Bi-Weekly': { name: 'Bi-Weekly 15% off', discount: 0.15 },
        'Tri-Weekly': { name: 'Tri weekly 12% off', discount: 0.12 },
        'Monthly': { name: 'Monthly 10% off', discount: 0.10 }
    },
    globalAddons: [
        { id: 'downtownParking', name: 'Downtown Street Parking Fee', price: 14.00, qtySelector: false },
        { id: 'nextDayBooking', name: 'Next Day Booking Fee', price: 52.50, qtySelector: false },
        { id: 'sameDayCancellation', name: 'Same Day Cancellation Fee', price: 55.30, qtySelector: false }
    ],
    promotions: [
        { id: 'promo_next30', name: 'Next Service $30 Off', type: 'fixed', value: 30, triggersOn: 'immediate_booking' }
    ]
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
    const [clockString, setClockString] = useState("");

    // Core Data collections loaded from Serverless APIs
    const [bookings, setBookings] = useState([]);
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
    const canManagePermissions = canManageSystem(currentUser);
    const canManagePeopleProfiles = currentUser ? ["super-admin", "branch-admin"].includes(normalizeRole(currentUser.role)) : false;
    const branchScope = currentUser ? getBranchScopeForUser({ ...currentUser, activeBranchId: selectedBranchId }) : null;
    const activeBranch = getBranchById(branchScope?.activeBranchId || selectedBranchId || DEFAULT_BRANCH_ID);

    // Address Autocomplete (Restricted to Ontario, Canada)
    const [addressQuery, setAddressQuery] = useState("");
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const autocompleteRef = useRef(null);
    const serviceCatalogRef = useRef(null);

    // Bookings Filters
    const [searchVal, setSearchVal] = useState("");
    const [filterService, setFilterService] = useState("");
    const [filterTeam, setFilterTeam] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
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
        time: "09:00 AM",
        team: "",
        assignedStaff: [],
        assignedStaffIds: [],
        status: "Pending",
        serviceDescription: "",
        accessDescription: ""
    });

    // Details and Editing modals
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [bookingModalOpen, setBookingModalOpen] = useState(false);
    const [adminServiceCart, setAdminServiceCart] = useState([]);
    const [serviceConfigOpen, setServiceConfigOpen] = useState(false);
    const [configCategory, setConfigCategory] = useState(null);
    const [configSizeId, setConfigSizeId] = useState("");
    const [configBathroomKey, setConfigBathroomKey] = useState("1 Bathroom");
    const [configAddons, setConfigAddons] = useState({});
    const [adminCheckoutOpen, setAdminCheckoutOpen] = useState(false);
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
        date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }),
        time: "09:00 AM",
        assignedStaffIds: [],
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
        if (!currentUser) return;
        if (!STAFF_SELF_SERVICE_ROLES.includes(normalizeRole(currentUser.role))) return;
        const timer = setTimeout(() => {
            setActiveTab("teams");
            setSelectedStaffUid(currentUser.uid);
            setStaffProfileDraftOwnerUid(currentUser.uid);
            setStaffProfileDraft(normalizeStaffProfile(currentUser.staffProfile));
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
        return normalizeStaffProfile(selectedStaffMember.staffProfile);
    }, [selectedStaffMember, staffProfileDraftOwnerUid, staffProfileDraft]);

    const selectedStaffAssignedJobs = useMemo(() => {
        if (!selectedStaffMember) return [];
        return bookings.filter(b => b.assignedStaffIds?.includes(selectedStaffMember.uid) && b.status !== "Cancelled");
    }, [bookings, selectedStaffMember]);

    const selectedStaffCompletedJobs = useMemo(() => {
        return selectedStaffAssignedJobs.filter(b => b.status === "Completed");
    }, [selectedStaffAssignedJobs]);

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
            value: selectedStaffMember?.email || "Not submitted",
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
            key: "start-date",
            label: "Start Date",
            value: selectedStaffMember?.createdAt ? selectedStaffMember.createdAt.split("T")[0] : "Pending"
        },
        {
            key: "work-status",
            label: "Work Eligibility",
            value: activeStaffProfileDraft?.eligibility?.workStatus || "Pending review"
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

            // 2. Fetch approved field staff for person-based job assignment
            if (isBranchManager) {
                const fieldStaffRes = await fetch("/api/users?type=field-staff", { headers });
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
    }, [getAuthHeaders, selectedBranchId]);

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
                            setActiveTab("teams");
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

    // ----------------------------------------------------
    // OpenStreetMap Autocomplete restricted to Ontario, Canada
    // ----------------------------------------------------
    const handleAddressChange = async (e) => {
        const value = e.target.value;
        setAddressQuery(value);
        setBookingForm(prev => ({ ...prev, address1: value }));

        if (value.trim().length < 4) {
            setAddressSuggestions([]);
            return;
        }

        try {
            // Ontario Canada query bounds
            const queryUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&countrycodes=ca&state=ontario&format=json&addressdetails=1&limit=5`;
            const res = await fetch(queryUrl, {
                headers: { "Accept-Language": "en-US,en;q=0.9" }
            });
            if (res.ok) {
                const suggestions = await res.json();
                setAddressSuggestions(suggestions);
                setShowSuggestions(true);
            }
        } catch (err) {
            console.warn("OSM autocomplete fetch interrupted", err);
        }
    };

    const selectSuggestion = (place) => {
        const addr = place.address || {};
        const houseNum = addr.house_number || "";
        const road = addr.road || addr.pedestrian || addr.suburb || "";
        const formattedStreet = `${houseNum} ${road}`.trim();

        const postal = addr.postcode || "";
        const city = addr.city || addr.town || addr.village || addr.municipality || "";

        setBookingForm(prev => ({
            ...prev,
            address1: formattedStreet || place.display_name.split(",")[0],
            city: city,
            state: "Ontario",
            postalCode: postal,
            country: "Canada"
        }));

        setAddressQuery(formattedStreet || place.display_name.split(",")[0]);
        setAddressSuggestions([]);
        setShowSuggestions(false);
    };

    // Close autocomplete when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
                setShowSuggestions(false);
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
        setActiveTab("dashboard");
        setAdminCheckoutOpen(false);
        setServiceConfigOpen(false);
        requestAnimationFrame(() => {
            serviceCatalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };

    const openEditBookingModal = (b) => {
        const nameParts = (b.clientName || "").split(" ");
        const fName = b.firstName || nameParts[0] || "";
        const lName = b.lastName || nameParts.slice(1).join(" ") || "";
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
            duration: b.duration || 2,
            date: b.date,
            time: b.time,
            team: "",
            assignedStaff: b.assignedStaff || [],
            assignedStaffIds: b.assignedStaffIds || [],
            status: b.status,
            serviceDescription: b.serviceDescription || "",
            accessDescription: b.accessDescription || ""
        });
        setAddressQuery(b.address1 || "");
        setBookingModalOpen(true);
    };

    const handleFormKeyDown = (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    };

    const handleBookingSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        const durationNum = parseFloat(bookingForm.duration || 2);
        try {
            const headers = await getAuthHeaders();
            const payload = {
                ...bookingForm,
                clientName: `${bookingForm.firstName} ${bookingForm.lastName}`.trim(),
                price: parseFloat(bookingForm.price || 0),
                duration: durationNum
            };

            const res = await fetch("/api/bookings", {
                method: "PUT",
                headers,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message);
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
        try {
            const storageRef = ref(storage, `staff-profile-photos/${currentUser.uid}/${Date.now()}-${file.name || "camera-photo.jpg"}`);
            await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
            const photoURL = await getDownloadURL(storageRef);

            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { photoURL });
            }

            const headers = await getAuthHeaders();
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

    const updateStaffDraftField = useCallback((section, field, value) => {
        setStaffProfileDraft(prev => {
            const base = prev || normalizeStaffProfile(selectedStaffMember?.staffProfile);
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
            setStaffProfileDraft(normalizeStaffProfile(data.user.staffProfile));
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

    // ----------------------------------------------------
    // Admin Review Merges (Approvals / Rejections)
    // ----------------------------------------------------
    const handleResolveEdit = async (requestId, action) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/edit-requests", {
                method: "POST",
                headers,
                body: JSON.stringify({ requestId, action })
            });

            if (res.ok) {
                alert(`Edit request ${action === "approve" ? "approved & merged" : "rejected"} successfully!`);
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

    const openServiceConfigurator = useCallback((category) => {
        setConfigCategory(category);
        setConfigSizeId(category.sizes?.[0]?.id || "base");
        setConfigBathroomKey("1 Bathroom");
        setConfigAddons({});
        setServiceConfigOpen(true);
    }, []);

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
        const basePrice = selectedSize ? parseFloat(selectedSize.price || 0) : getCategoryBasePrice(configCategory);
        const baseDuration = selectedSize ? parseFloat(selectedSize.durationHrs || 0) : getCategoryDuration(configCategory);
        const isHouseCleaning = configCategory.id === "house_cleaning";
        const bathroomPrice = isHouseCleaning ? parseFloat(v2Catalog.bathrooms?.[configBathroomKey] || 0) : 0;
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

        setAdminServiceCart(prev => [
            ...prev,
            {
                cartId: `${configCategory.id}-${Date.now()}`,
                categoryId: configCategory.id,
                name: configCategory.name,
                pricingModel: configCategory.pricingModel,
                optionId: selectedSize?.id || "base",
                optionName: selectedSize?.name || "Base service",
                basePrice,
                bathroomKey: isHouseCleaning ? configBathroomKey : "",
                bathroomPrice,
                price: basePrice + bathroomPrice + addonTotal,
                durationHrs: baseDuration,
                configuredExtras,
                addons: selectedAddons
            }
        ]);
        setServiceConfigOpen(false);
    }, [configAddons, configBathroomKey, configCategory, configSizeId, getCategoryBasePrice, getCategoryDuration, v2Catalog.bathrooms]);

    const removeAdminCartItem = useCallback((cartId) => {
        setAdminServiceCart(prev => prev.filter(item => item.cartId !== cartId));
    }, []);

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
        setAdminCheckoutOpen(true);
    }, []);

    const saveAdminCartBooking = useCallback(async (event) => {
        event.preventDefault();
        if (adminServiceCart.length === 0) {
            alert("Add at least one configured service before checkout.");
            return;
        }
        try {
            const discountAmount = parseFloat(adminCheckoutForm.discountAmount || 0);
            const discountPercent = parseFloat(adminCheckoutForm.discountPercent || 0);
            const percentDiscountValue = adminCartTotals.subtotal * (discountPercent / 100);
            const totalDiscount = Math.min(adminCartTotals.subtotal, discountAmount + percentDiscountValue);
            const finalTotal = Math.max(0, adminCartTotals.total - totalDiscount);
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
                date: adminCheckoutForm.date,
                time: adminCheckoutForm.time,
                team: "",
                assignedStaff,
                assignedStaffIds: assignedStaff.map(member => member.uid),
                status: "Pending",
                service: adminServiceCart.map(item => item.name).join(" + "),
                bathrooms: "N/A",
                frequency: "One-Time",
                duration: adminCartTotals.duration,
                price: finalTotal,
                subtotal: adminCartTotals.subtotal,
                tax: adminCartTotals.tax,
                customDiscountAmount: totalDiscount,
                promoCode: adminCheckoutForm.promoCode,
                giftCardCode: adminCheckoutForm.giftCardCode,
                specialNotes: adminCheckoutForm.notes,
                cartItems: adminServiceCart
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
            setAdminCheckoutOpen(false);
            setAdminServiceCart([]);
            syncDatabaseData(currentUser);
            alert("Service cart booking created successfully.");
        } catch (err) {
            alert(`Checkout failed: ${err.message}`);
        }
    }, [activeBranch, adminCartTotals, adminCheckoutForm, adminServiceCart, currentUser, fieldStaff, getAuthHeaders, syncDatabaseData]);

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
            const matchStatus = !filterStatus || b.status === filterStatus;

            const matchRoleAccess = currentUser?.role === "customer" ? b.email === currentUser?.email : true;

            return matchSearch && matchService && matchTeam && matchStatus && matchRoleAccess;
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
    }, [bookings, searchVal, filterService, filterTeam, filterStatus, sortVal, currentUser]);

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
        const completedBookings = activeBookings.filter(booking => booking.status === "Completed");
        const uniqueClients = new Set(activeBookings.map(b => (b.email || b.phone || b.clientName || "").toLowerCase()).filter(Boolean));
        const bookedServices = activeBookings.reduce((total, booking) => {
            if (Array.isArray(booking.cartItems) && booking.cartItems.length > 0) return total + booking.cartItems.length;
            return total + 1;
        }, 0);
        const revenue = completedBookings.reduce((total, booking) => total + parseFloat(booking.price || booking.totalAmount || 0), 0);
        const pending = activeBookings.filter(booking => booking.status === "Pending").length;
        const confirmed = activeBookings.filter(booking => booking.status === "Confirmed").length;

        return {
            activeBookings: activeBookings.length,
            uniqueClients: uniqueClients.size,
            bookedServices,
            revenue,
            pending,
            confirmed
        };
    }, [bookings]);

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
        return bookings.filter(b => b.date === selectedCalDate).sort((a, b) => a.time.localeCompare(b.time));
    }, [bookings, selectedCalDate]);

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
                        <img src="/logo.png" alt="SmarTouch Clean" className="auth-card-logo-mobile" />

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
        <div className="app-container">
            {/* Sidebar Navigation */}
            <aside className="sidebar">
                <div className="brand-logo">
                    <img src="/logo.png" alt="SmarTouch Clean" className="brand-logo-img" />
                </div>

                <nav className="nav-links">
                    {!isPendingCleanerOnboarding && (
                        <button onClick={() => setActiveTab("dashboard")} className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}>
                            {Icons.Dashboard()}
                            <span>Dashboard</span>
                        </button>
                    )}
                    {!isPendingCleanerOnboarding && (
                        <button onClick={() => setActiveTab("bookings")} className={`nav-item ${activeTab === "bookings" ? "active" : ""}`}>
                            {Icons.Bookings()}
                            <span>Bookings</span>
                        </button>
                    )}
                    {canViewOperations && (
                        <button onClick={() => setActiveTab("calendar")} className={`nav-item ${activeTab === "calendar" ? "active" : ""}`}>
                            {Icons.Calendar()}
                            <span>Calendar</span>
                        </button>
                    )}
                    {canViewPeople && (
                        <button onClick={() => setActiveTab("teams")} className={`nav-item ${activeTab === "teams" ? "active" : ""}`}>
                            {Icons.Teams()}
                            <span>Staff</span>
                        </button>
                    )}
                    {canViewAdministration && (
                        <button onClick={() => setActiveTab("departments")} className={`nav-item ${activeTab === "departments" ? "active" : ""}`}>
                            {Icons.Departments()}
                            <span>Departments</span>
                        </button>
                    )}
                    {canViewAdministration && (
                        <button onClick={() => setActiveTab("edit-requests")} className={`nav-item ${activeTab === "edit-requests" ? "active" : ""}`}>
                            <div className="flex items-center gap-3">
                                {Icons.EditReview()}
                                <span>Edit Review</span>
                            </div>
                            {editRequests.filter(r => r.status === "Pending").length > 0 && (
                                <span className="badge">{editRequests.filter(r => r.status === "Pending").length}</span>
                            )}
                        </button>
                    )}
                    {canViewAdministration && (
                        <button onClick={() => setActiveTab("catalog")} className={`nav-item ${activeTab === "catalog" ? "active" : ""}`}>
                            {Icons.Catalog()}
                            <span>Catalog Studio</span>
                        </button>
                    )}
                    {canManagePermissions && (
                        <button onClick={() => setActiveTab("permissions")} className={`nav-item ${activeTab === "permissions" ? "active" : ""}`}>
                            {Icons.Shield()}
                            <span>Permissions</span>
                        </button>
                    )}
                    {!isPendingCleanerOnboarding && (
                        <button onClick={() => setActiveTab("settings")} className={`nav-item ${activeTab === "settings" ? "active" : ""}`}>
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                            <span>Settings</span>
                        </button>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-profile flex justify-between items-center w-full">
                        <div className="flex items-center gap-2.5">
                            <div className={`user-avatar text-white font-bold ${currentUser.photoURL ? "user-avatar-photo" : ""}`}>
                                {currentUser.photoURL ? (
                                    <img src={currentUser.photoURL} alt={currentUser.name} className="avatar-image" />
                                ) : getInitials(currentUser.name)}
                            </div>
                            <div className="user-details flex flex-col">
                                <span className="user-name text-slate-800 text-xs font-bold leading-tight">{currentUser.name}</span>
                                <span className="user-role text-[10px] text-slate-400 mt-0.5">{roleLabel}{currentUser.teamId ? ` (${currentUser.teamId})` : ""}</span>
                            </div>
                        </div>
                        <button onClick={handleSignout} className="action-btn" title="Log Out">{Icons.Logout()}</button>
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
                                    activeTab === "calendar" ? "Scheduling Calendar" :
                                        activeTab === "teams" ? "Field Staff Assignments" :
                                            activeTab === "departments" ? "Departments Hub" :
                                            activeTab === "edit-requests" ? "Modification Requests Inbox" :
                                                activeTab === "catalog" ? "Catalog Studio" :
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
                    <div className="animate-fade">
                        {currentUser.role === "customer" ? (
                            <div className="customer-dashboard flex flex-col gap-8">
                                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Welcome back, {currentUser.name.split(" ")[0]}!</h2>
                                    <p className="text-slate-500 font-medium mt-2 max-w-lg">Manage your home cleaning schedule, view past services, and earn credits through our referral program.</p>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2 flex flex-col gap-6">
                                        <div className="panel-card">
                                            <div className="panel-header">
                                                <h4>Your Bookings</h4>
                                            </div>
                                            <div className="panel-body p-0">
                                                {(() => {
                                                    const myBookings = bookings.filter(b => b.email === currentUser.email).sort((a, b) => new Date(b.date) - new Date(a.date));
                                                    if (myBookings.length === 0) {
                                                        return <div className="p-8 text-center text-slate-400 text-sm">You haven&apos;t booked any services yet.</div>;
                                                    }
                                                    return (
                                                        <div className="flex flex-col">
                                                            {myBookings.map((b, idx) => (
                                                                <div key={b.id || idx} className="flex justify-between items-center p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                                                    <div>
                                                                        <div className="font-bold text-slate-800 text-sm">{b.date} at {b.time}</div>
                                                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{b.status}</div>
                                                                        {b.isV2Booking && b.cartItems && b.cartItems.some(i => ["Weekly", "Bi-Weekly", "Monthly"].includes(i.frequency)) && (
                                                                            <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mt-2">
                                                                                ↻ Next Scheduled: {
                                                                                    (() => {
                                                                                        const freq = b.cartItems.find(i => ["Weekly", "Bi-Weekly", "Monthly"].includes(i.frequency))?.frequency;
                                                                                        const d = new Date(b.date);
                                                                                        if (freq === "Weekly") d.setDate(d.getDate() + 7);
                                                                                        if (freq === "Bi-Weekly") d.setDate(d.getDate() + 14);
                                                                                        if (freq === "Monthly") d.setMonth(d.getMonth() + 1);
                                                                                        return d.toLocaleDateString('en-CA');
                                                                                    })()
                                                                                } ({b.cartItems.find(i => ["Weekly", "Bi-Weekly", "Monthly"].includes(i.frequency))?.frequency})
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="font-black text-slate-800">${parseFloat(b.price || b.totalAmount || 0).toFixed(2)}</div>
                                                                        <div className="text-[10px] text-slate-400 mt-1">{b.duration} hrs</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-1 flex flex-col gap-6">
                                        <div className="panel-card bg-amber-50 border-amber-200">
                                            <div className="panel-header border-amber-200">
                                                <h4 className="text-amber-800">Refer & Earn</h4>
                                            </div>
                                            <div className="panel-body p-6">
                                                <p className="text-sm text-amber-700 font-medium mb-4">Give your friends <strong>$20 off</strong> their first cleaning, and get <strong>$40 off</strong> your next cleaning when they book!</p>
                                                <div className="bg-white p-3 rounded-xl border border-amber-200 text-center font-mono font-bold text-amber-900 text-lg tracking-widest shadow-inner">
                                                    REF-{currentUser.uid.slice(0, 6).toUpperCase()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <section className="admin-command-shell">
                                    <div className="admin-command-header">
                                        <div>
                                            <p className="admin-command-kicker">Admin booking command</p>
                                            <h3>Start a booking from the service catalog</h3>
                                            <p>
                                                Choose a core service, configure the subcategory and add-ons, add it to the cart, then repeat for multiple services before checkout.
                                            </p>
                                            <div className="admin-workflow-steps" aria-label="Booking workflow">
                                                <span><strong>1</strong> Select service</span>
                                                <span><strong>2</strong> Configure details</span>
                                                <span><strong>3</strong> Add to cart</span>
                                                <span><strong>4</strong> Checkout</span>
                                            </div>
                                        </div>
                                        <button onClick={openNewBookingCommand} className="admin-primary-action">
                                            {Icons.Plus()}
                                            Start Service Cart
                                        </button>
                                    </div>

                                    <div className="admin-metric-row">
                                        <div className="admin-metric-card">
                                            <span>Total Revenue</span>
                                            <strong>${adminCommandMetrics.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                            <small>Completed jobs/bookings only</small>
                                        </div>
                                        <div className="admin-metric-card">
                                            <span>Booked Clients</span>
                                            <strong>{adminCommandMetrics.uniqueClients}</strong>
                                            <small>{adminCommandMetrics.activeBookings} active bookings</small>
                                        </div>
                                        <div className="admin-metric-card">
                                            <span>Booked Services</span>
                                            <strong>{adminCommandMetrics.bookedServices}</strong>
                                            <small>Cart and legacy bookings</small>
                                        </div>
                                        <div className="admin-metric-card warning">
                                            <span>Pending Work</span>
                                            <strong>{adminCommandMetrics.pending}</strong>
                                            <small>{adminCommandMetrics.confirmed} confirmed jobs</small>
                                        </div>
                                    </div>

                                    <div className="admin-booking-workspace">
                                        <div ref={serviceCatalogRef} className="admin-service-panel" tabIndex="-1">
                                            <div className="admin-section-heading">
                                                <div>
                                                    <h4>Service Catalog</h4>
                                                    <p>Core services from your V2 Dynamic Service Manager.</p>
                                                </div>
                                                <span>{catalogServiceCards.length} Services</span>
                                            </div>
                                            <div className="admin-service-grid">
                                                {catalogServiceCards.map(service => (
                                                    <article key={service.id} className="admin-service-card">
                                                        <div className={`admin-service-visual ${service.visualClass}`}>
                                                            <span>{service.count} booked</span>
                                                        </div>
                                                        <div className="admin-service-body">
                                                            <div className="admin-service-title-row">
                                                                <h5>{service.name}</h5>
                                                                <strong>${service.basePrice.toFixed(2)}</strong>
                                                            </div>
                                                            <p>{service.pricingModel.replaceAll("_", " ")} • {service.durationHrs || "Custom"} hrs baseline</p>
                                                            <div className="admin-service-meta">
                                                                <span>{service.sizes?.length || 0} subcategories</span>
                                                                <span>{service.addons?.length || 0} add-ons</span>
                                                            </div>
                                                            <button onClick={() => openServiceConfigurator(service)} type="button" className="admin-add-service-btn">
                                                                {Icons.Plus()}
                                                                Configure
                                                            </button>
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        </div>

                                        <aside className="admin-cart-panel">
                                            <div className="admin-section-heading">
                                                <div>
                                                    <h4>Client Service Cart</h4>
                                                    <p>Add multiple services before checkout.</p>
                                                </div>
                                                <span>{adminServiceCart.length} Items</span>
                                            </div>
                                            {adminServiceCart.length === 0 ? (
                                                <div className="admin-cart-empty">
                                                    <strong>No services selected yet.</strong>
                                                    <p>Tap Configure on any core service, choose the tier and add-ons, then add it to this cart.</p>
                                                </div>
                                            ) : (
                                                <div className="admin-cart-list">
                                                    {adminServiceCart.map(item => (
                                                        <div key={item.cartId} className="admin-cart-item">
                                                            <div>
                                                                <strong>{item.name}</strong>
                                                                <span>
                                                                    {item.optionName}
                                                                    {item.bathroomKey ? ` • ${item.bathroomKey}` : ""}
                                                                    {` • ${item.addons?.length || 0} add-ons selected`}
                                                                </span>
                                                            </div>
                                                            <div className="admin-cart-price">
                                                                <strong>${item.price.toFixed(2)}</strong>
                                                                <button onClick={() => removeAdminCartItem(item.cartId)} type="button" aria-label={`Remove ${item.name}`}>
                                                                    {Icons.Trash()}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="admin-cart-totals">
                                                <div><span>Subtotal</span><strong>${adminCartTotals.subtotal.toFixed(2)}</strong></div>
                                                <div><span>{activeBranch.taxLabel}</span><strong>${adminCartTotals.tax.toFixed(2)}</strong></div>
                                                <div><span>Estimated Hours</span><strong>{adminCartTotals.duration.toFixed(1)}</strong></div>
                                                <div className="admin-cart-grand"><span>Total</span><strong>${adminCartTotals.total.toFixed(2)}</strong></div>
                                            </div>
                                            <button disabled={adminServiceCart.length === 0} onClick={checkoutAdminCart} type="button" className="admin-checkout-btn">
                                                Continue to Checkout
                                            </button>
                                        </aside>
                                    </div>

                                    <div className="admin-ops-grid">
                                        <div className="admin-live-panel">
                                            <div className="admin-section-heading">
                                                <div>
                                                    <h4>Today&apos;s Dispatches</h4>
                                                    <p>{new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                </div>
                                                <span>{todayBookings.length} Jobs</span>
                                            </div>
                                            {todayBookings.length === 0 ? (
                                                <div className="admin-cart-empty">No dispatches scheduled for today.</div>
                                            ) : (
                                                <div className="admin-dispatch-list">
                                                    {todayBookings.slice(0, 5).map(b => (
                                                        <button key={b.id} onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }} className="admin-dispatch-item" type="button">
                                                            <span>{b.time}</span>
                                                            <div>
                                                                <strong>{b.clientName}</strong>
                                                                <small>{b.service} • {b.team}</small>
                                                            </div>
                                                            <em>{b.status}</em>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="admin-live-panel">
                                            <div className="admin-section-heading">
                                                <div>
                                                    <h4>HR & Compliance Queue</h4>
                                                    <p>Employee/subcontractor readiness.</p>
                                                </div>
                                                <span>{pendingUsers.length} Pending</span>
                                            </div>
                                            <div className="admin-hr-queue">
                                                <div><strong>{fieldStaff.length}</strong><span>Approved field staff</span></div>
                                                <div><strong>{pendingUsers.length}</strong><span>Pending approvals</span></div>
                                                <div><strong>{bookings.filter(b => b.assignedStaffIds?.length > 0).length}</strong><span>Assigned jobs</span></div>
                                            </div>
                                            <button onClick={() => setActiveTab("departments")} className="admin-secondary-action" type="button">
                                                Open HR modules
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                {/* Permissioned pending user approvals table in Dashboard */}
                                {canManagePermissions && pendingUsers.length > 0 && (
                                    <div className="panel-card mt-6">
                                        <div className="panel-header">
                                            <h4>Awaiting operational registration approvals</h4>
                                            <span className="badge badge-warning">{pendingUsers.length} Pending</span>
                                        </div>
                                        <div className="panel-body">
                                            <div className="table-container">
                                                <table className="bookings-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Person Name</th>
                                                            <th>Email Address</th>
                                                            <th>Account Role</th>
                                                            <th>Requested Role</th>
                                                            <th className="text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pendingUsers.map(u => (
                                                            <tr key={u.uid}>
                                                                <td className="font-bold text-slate-800">{u.name}</td>
                                                                <td>{u.email}</td>
                                                                <td>
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'customer' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                        {getRoleLabel(u.role)}
                                                                    </span>
                                                                </td>
                                                                <td>{getRoleLabel(u.role)}</td>
                                                                <td className="text-right">
                                                                    <div className="flex gap-2 justify-end">
                                                                        <button onClick={() => handleResolveUserApproval(u.uid, "approve")} className="btn btn-secondary btn-sm">Approve</button>
                                                                        <button onClick={() => handleResolveUserApproval(u.uid, "reject")} className="btn btn-danger btn-sm">Reject</button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* TAB 2: BOOKINGS LIST VIEWS */}
                {activeTab === "bookings" && (
                    <div className="animate-fade">
                        <div className="filters-card">
                            <div className="search-input-wrapper">
                                <span className="search-icon">{Icons.Search()}</span>
                                <input type="text" value={searchVal} onChange={e => setSearchVal(e.target.value)} placeholder="Search by client name, address, email or phone..." />
                            </div>
                            <div className="filters-actions">
                                <select value={filterService} onChange={e => setFilterService(e.target.value)}>
                                    <option value="">All Services</option>
                                    {Object.keys(pricingRates.services).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                    <option value="">All Statuses</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Confirmed">Confirmed</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                                <select value={sortVal} onChange={e => setSortVal(e.target.value)}>
                                    <option value="date-asc">Date: Soonest First</option>
                                    <option value="date-desc">Date: Latest First</option>
                                    <option value="name-asc">Client: Name A-Z</option>
                                    <option value="price-desc">Cost: Highest First</option>
                                </select>
                            </div>
                        </div>

                        <div className="table-container">
                            {filteredBookings.length === 0 ? (
                                <div className="text-center p-12 text-slate-400 text-sm">No scheduled cleanings match search variables.</div>
                            ) : (
                                <table className="bookings-table">
                                    <thead>
                                        <tr>
                                            <th>Client Details</th>
                                            <th>Street Address</th>
                                            <th>Service Details</th>
                                            <th>Schedule Window</th>
                                            <th>Assigned Staff</th>
                                            <th>Status</th>
                                            <th className="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBookings.map(b => {
                                            const hasPendingEdit = editRequests.some(r => r.bookingId === b.id && r.status === "Pending");
                                            return (
                                                <tr key={b.id}>
                                                    <td data-label="Client Details">
                                                        <div className="flex flex-col items-end md:items-start">
                                                            <div className="client-name-cell">{b.clientName}</div>
                                                            <div className="text-[10px] text-slate-400 mt-0.5">{b.phone}</div>
                                                            {hasPendingEdit && (
                                                                <div className="inline-block text-[9px] bg-amber-50 border border-amber-200 text-amber-700 font-bold px-1.5 py-0.5 rounded-full mt-1">Pending Admin Review</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td data-label="Street Address">
                                                        <div className="address-cell text-xs" title={formatAddress(b)}>{formatAddress(b)}</div>
                                                    </td>
                                                    <td data-label="Service Details" className="service-cell">
                                                        <div className="flex flex-col items-end md:items-start">
                                                            <div className="font-bold text-slate-700 text-xs">{b.service}</div>
                                                            <div className="price-text">${parseFloat(b.price || 0).toFixed(2)}</div>
                                                        </div>
                                                    </td>
                                                    <td data-label="Schedule Window" className="datetime-cell">
                                                        <div className="flex flex-col items-end md:items-start">
                                                            <div className="font-bold text-xs">{b.date}</div>
                                                            <div className="time-text text-[11px]">{formatTimeWindow(b.time, b.duration)}</div>
                                                        </div>
                                                    </td>
                                                    <td data-label="Assigned Staff">
                                                        <div className="assigned-staff-list">
                                                            {(b.assignedStaff || []).map(member => (
                                                                <span key={member.uid || member.email}>{member.name}</span>
                                                            ))}
                                                            {!b.assignedStaff?.length && <span>{b.team || "Unassigned"}</span>}
                                                        </div>
                                                    </td>
                                                    <td data-label="Status">
                                                        <div>
                                                            <span className={`status-badge status-${b.status.toLowerCase()}`}>{b.status}</span>
                                                        </div>
                                                    </td>
                                                    <td data-label="Actions" className="actions-cell text-right">
                                                        <div className="actions-cell-inner flex gap-2 justify-end">
                                                            <button onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }} className="action-btn btn-view" title="Details">{Icons.Eye()}</button>
                                                            <button onClick={() => openEditBookingModal(b)} className="action-btn btn-edit" title="Edit">{Icons.Edit()}</button>
                                                            {canManagePermissions && (
                                                                <button onClick={() => handleDeleteBooking(b.id)} className="action-btn btn-delete" title="Cancel">{Icons.Trash()}</button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 3: CALENDAR & DAY AGENDA PANEL */}
                {activeTab === "calendar" && (
                    <div className="calendar-split-container animate-fade">
                        <div className="calendar-card panel-card">
                            <div className="panel-header flex justify-between items-center">
                                <h4>Calendar Dispatch Matrix</h4>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => changeMonth(-1)} className="action-btn">{Icons.ChevronLeft()}</button>
                                    <span className="font-bold text-sm text-slate-700">{monthNames[currentCalMonth.getMonth()]} {currentCalMonth.getFullYear()}</span>
                                    <button onClick={() => changeMonth(1)} className="action-btn">{Icons.ChevronRight()}</button>
                                </div>
                            </div>
                            <div className="panel-body">
                                <div className="calendar-grid-header">
                                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                                </div>
                                <div className="calendar-grid-days border-t border-slate-100 pt-2">
                                    {calendarDays.map((cell, idx) => {
                                        if (!cell.day) return <div key={`empty-${idx}`} className="cal-day empty"></div>;

                                        const dayBookings = bookings.filter(b => b.date === cell.dateStr && b.status !== "Cancelled");
                                        const isSelected = cell.dateStr === selectedCalDate;
                                        const isToday = cell.dateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });

                                        return (
                                            <div
                                                key={cell.dateStr}
                                                onClick={() => setSelectedCalDate(cell.dateStr)}
                                                className={`cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                                            >
                                                <span className="cal-day-num">{cell.day}</span>
                                                <div className="cal-events-dots">
                                                    {dayBookings.slice(0, 3).map(b => {
                                                        const teamColor = teams.find(t => t.name === b.team)?.color || "sparkle";
                                                        return (
                                                            <span
                                                                key={b.id}
                                                                className={`event-dot ${teamColor}`}
                                                                title={`${b.clientName} - ${b.service}`}
                                                            ></span>
                                                        );
                                                    })}
                                                    {dayBookings.length > 3 && <span className="text-[9px] text-slate-400 font-bold">+{dayBookings.length - 3}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Calendar Agenda Pane */}
                        <div className="agenda-card">
                            <div className="panel-header agenda-panel-header">
                                <div>
                                    <h4 className="agenda-panel-kicker">Day agenda list</h4>
                                    <h3 className="font-extrabold text-slate-800 text-sm mt-1">{selectedCalDate}</h3>
                                </div>
                                <span className="badge">{agendaBookings.length} Job{agendaBookings.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="agenda-list">
                                {agendaBookings.length === 0 ? (
                                    <div className="text-center p-8 text-slate-400 text-xs">No dispatches scheduled on this date.</div>
                                ) : (
                                    agendaBookings.map(b => {
                                        const teamColor = (teams.find(t => t.name === b.team)?.color || "sparkle").toLowerCase();
                                        return (
                                            <div key={b.id} className={`agenda-item ${teamColor}`}>
                                                <div className="agenda-item-header">
                                                    <span className="agenda-item-title">{b.clientName}</span>
                                                    <span className="agenda-item-time">{b.time}</span>
                                                </div>
                                                <div className="agenda-item-desc">{b.service} ({b.duration} hrs)</div>
                                                <div className="agenda-item-addr">
                                                    {Icons.MapPin()}
                                                    <span className="agenda-address-text">{b.address1}</span>
                                                </div>
                                                <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2">
                                                    <span className={`status-badge status-${b.status.toLowerCase()}`}>{b.status}</span>
                                                    <div className="actions-cell">
                                                        <button onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }} className="action-btn btn-view">{Icons.Eye()}</button>
                                                        <button onClick={() => openEditBookingModal(b)} className="action-btn btn-edit">{Icons.Edit()}</button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: FIELD STAFF ASSIGNMENTS VIEW */}
                {activeTab === "teams" && (
                    <div className="animate-fade flex flex-col gap-6">
                        {!isViewingOwnCleanerProfile && (
                            <div className="ops-control-header">
                                <div>
                                    <p className="ops-eyebrow">People Management</p>
                                    <h3 className="ops-title">Field Staff Profiles</h3>
                                    <p className="ops-copy">
                                        Open a staff profile to review branch status, required documents, eligibility, and approval requests. Staff can submit updates from their own login for branch admin approval.
                                    </p>
                                </div>
                                <span className="ops-chip">{peopleRoster.length} Visible Staff</span>
                            </div>
                        )}
                        {peopleRoster.length === 0 ? (
                            <div className="empty-state p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-md">
                                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-slate-300"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                <h4 className="font-extrabold text-slate-700 text-sm mb-1">No approved field staff yet</h4>
                                <p className="text-xs text-slate-400 max-w-[280px] mx-auto">Register and approve cleaners, supervisors, employees, or subcontractors to assign them to jobs.</p>
                            </div>
                        ) : (
                            <div className="people-management-shell">
                                {!isViewingOwnCleanerProfile && (
                                    <div className="teams-grid">
                                        {peopleRoster.map(member => {
                                            const assignedJobs = bookings.filter(b => b.assignedStaffIds?.includes(member.uid) && b.status !== "Cancelled");
                                            const completedCount = assignedJobs.filter(b => b.status === "Completed").length;
                                            const initials = getInitials(member.name || member.email || "FS");
                                            const requestPending = member.staffProfileRequest?.requestedProfile;
                                            return (
                                                <button
                                                    key={member.uid}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedStaffUid(member.uid);
                                                        setStaffProfileDraftOwnerUid(member.uid);
                                                        setStaffProfileDraft(normalizeStaffProfile(member.staffProfile));
                                                        setStaffProfileFeedback("");
                                                        setStaffProfileRejectReason("");
                                                        setStaffProfileEditOpen(false);
                                                    }}
                                                    className={`team-card team-card-button ${selectedStaffMember?.uid === member.uid ? "team-card-active" : ""}`}
                                                >
                                                    <div className="team-card-header">
                                                        <div className="team-card-title-group">
                                                        <div className="team-avatar-square team-sparkle-bg">
                                                                {member.photoURL ? (
                                                                    <img src={member.photoURL} alt={member.name || member.email} className="avatar-image" />
                                                                ) : initials}
                                                            </div>
                                                            <div className="team-card-info">
                                                                <h4>{member.name}</h4>
                                                                <span>
                                                                    {getRoleLabel(member.role)} · {member.branchName || "Ottawa"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {requestPending && <span className="ops-chip ops-chip-green">Needs Review</span>}
                                                    </div>
                                                    <div className="team-card-body">
                                                        <p className="text-xs text-slate-400 mb-4 italic">{member.email}</p>
                                                        <div className="team-members-container">
                                                            <h5 className="team-section-title">Profile Status</h5>
                                                            <div className="flex flex-col gap-2 text-xs text-slate-600">
                                                                <div><strong>Account:</strong> {member.status}</div>
                                                                <div><strong>Profile:</strong> {member.staffProfileMeta?.status || "incomplete"}</div>
                                                                <div><strong>Branch:</strong> {member.branchName || "Ottawa"}</div>
                                                            </div>
                                                        </div>
                                                        <div className="team-jobs-today-container mt-4 pt-3 border-t border-slate-100">
                                                            <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                                                                <span>Assigned jobs: <strong>{assignedJobs.length}</strong></span>
                                                                <span>Completed: <strong>{completedCount}</strong></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {selectedStaffMember && activeStaffProfileDraft && (
                                    <section className="people-profile-canvas">
                                        <section className={`people-mobile-profile-shell ${isViewingOwnCleanerProfile ? "people-mobile-profile-shell-self" : ""}`}>
                                            <div className="people-mobile-profile-top">
                                                <div className="people-mobile-profile-avatar-wrap">
                                                    <div className={`people-mobile-profile-avatar ${selectedStaffMember.photoURL ? "people-mobile-profile-avatar-photo" : ""}`}>
                                                        {selectedStaffMember.photoURL ? (
                                                            <img src={selectedStaffMember.photoURL} alt={selectedStaffMember.name || selectedStaffMember.email} className="avatar-image" />
                                                        ) : getInitials(selectedStaffMember.name || selectedStaffMember.email || "FS")}
                                                    </div>
                                                    <span className="people-mobile-profile-presence"></span>
                                                </div>
                                                <h3>{selectedStaffMember.name}</h3>
                                                <div className="people-mobile-profile-status">
                                                    <span></span>
                                                    Active
                                                </div>
                                                {canEditSelectedStaffProfile && (
                                                    <label className="people-photo-upload-button">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            capture="user"
                                                            onChange={e => handleProfilePhotoCapture(e.target.files?.[0])}
                                                            disabled={profilePhotoUploading}
                                                        />
                                                        {profilePhotoUploading ? "Uploading Photo..." : "Take Live Photo"}
                                                    </label>
                                                )}
                                            </div>

                                            <div className="people-mobile-profile-stats">
                                                <div>
                                                    <strong>4.9</strong>
                                                    <span>Rating</span>
                                                </div>
                                                <div>
                                                    <strong>{selectedStaffCompletedJobs.length}</strong>
                                                    <span>Jobs</span>
                                                </div>
                                                <div>
                                                    <strong>98%</strong>
                                                    <span>On-Time</span>
                                                </div>
                                            </div>

                                            {staffProfileFeedback && (
                                                <div className="people-profile-message people-mobile-profile-message">
                                                    {staffProfileFeedback}
                                                </div>
                                            )}

                                            {canManagePeopleProfiles && selectedStaffMember.staffProfileRequest?.requestedProfile && (
                                                <div className="people-review-panel people-mobile-review-panel">
                                                    <div>
                                                        <p className="ops-eyebrow">Approval Queue</p>
                                                        <h4>Pending Staff Profile Request</h4>
                                                        <p>
                                                            Submitted by {selectedStaffMember.staffProfileRequest.submittedByName} on {selectedStaffMember.staffProfileRequest.submittedAt?.split("T")[0]}.
                                                        </p>
                                                    </div>
                                                    <textarea
                                                        placeholder="Optional rejection reason for branch admin feedback"
                                                        value={staffProfileRejectReason}
                                                        onChange={e => setStaffProfileRejectReason(e.target.value)}
                                                    />
                                                    <div className="people-review-actions">
                                                        <button type="button" className="team-primary-action" onClick={() => handleReviewStaffProfileRequest("approve")} disabled={staffProfileSaving}>
                                                            Approve Changes
                                                        </button>
                                                        <button type="button" className="team-secondary-action" onClick={() => handleReviewStaffProfileRequest("reject")} disabled={staffProfileSaving}>
                                                            Reject Changes
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <nav className="people-mobile-profile-tabs">
                                                <button type="button" className={staffProfileMobileTab === "identity" ? "active" : ""} onClick={() => setStaffProfileMobileTab("identity")}>Identity</button>
                                                <button type="button" className={staffProfileMobileTab === "employment" ? "active" : ""} onClick={() => setStaffProfileMobileTab("employment")}>Employment</button>
                                                <button type="button" className={staffProfileMobileTab === "availability" ? "active" : ""} onClick={() => setStaffProfileMobileTab("availability")}>Availability</button>
                                            </nav>

                                            <div className="people-mobile-profile-content">
                                                {staffProfileMobileTab === "identity" && !staffProfileEditOpen && (
                                                    <div className="people-mobile-section-stack">
                                                        <section className="people-mobile-card-group">
                                                            <label>Contact Information</label>
                                                            <div className="people-mobile-info-stack">
                                                                {selectedStaffIdentityCards.map(card => (
                                                                    <article key={card.key} className="people-mobile-info-card">
                                                                        <div className="people-mobile-info-icon">{card.icon}</div>
                                                                        <div>
                                                                            <span>{card.label}</span>
                                                                            <strong>{card.value}</strong>
                                                                        </div>
                                                                    </article>
                                                                ))}
                                                            </div>
                                                        </section>
                                                        <section className="people-mobile-card-group">
                                                            <label>Emergency Contact</label>
                                                            <article className="people-mobile-emergency-card">
                                                                <div>
                                                                    <strong>{activeStaffProfileDraft.emergency.contactName || "Not submitted"}</strong>
                                                                    <span>{activeStaffProfileDraft.emergency.relationship || "Relationship pending"}</span>
                                                                    <p>{activeStaffProfileDraft.emergency.phone || "Phone pending"}</p>
                                                                </div>
                                                                <div className="people-mobile-info-icon">{Icons.Contact()}</div>
                                                            </article>
                                                        </section>
                                                    </div>
                                                )}

                                                {staffProfileMobileTab === "employment" && !staffProfileEditOpen && (
                                                    <div className="people-mobile-section-stack">
                                                        <section className="people-mobile-card-group">
                                                            <label>Employment</label>
                                                            <div className="people-mobile-mini-grid">
                                                                {selectedStaffEmploymentCards.map(card => (
                                                                    <article key={card.key} className="people-mobile-mini-card">
                                                                        <span>{card.label}</span>
                                                                        <strong>{card.value}</strong>
                                                                    </article>
                                                                ))}
                                                            </div>
                                                        </section>
                                                        <section className="people-mobile-card-group">
                                                            <label>Internal Notes</label>
                                                            <article className="people-mobile-note-card">
                                                                {activeStaffProfileDraft.employment.availabilityNotes || "Staff profile notes will appear here after branch admin approval."}
                                                            </article>
                                                        </section>
                                                    </div>
                                                )}

                                                {staffProfileMobileTab === "availability" && !staffProfileEditOpen && (
                                                    <div className="people-mobile-section-stack">
                                                        <section className="people-mobile-availability-hero">
                                                            <div>
                                                                <strong>Weekly Schedule</strong>
                                                                <span>Live scheduling data from Firestore</span>
                                                            </div>
                                                            <span>Max {selectedStaffAvailability.maxJobsPerDay} Jobs/Day</span>
                                                        </section>
                                                        <section className="people-mobile-availability-card">
                                                            <div className="people-mobile-availability-week">
                                                                {selectedStaffAvailability.weekdays.map((day, index) => (
                                                                    <div key={`${day.label}-${index}`} className="people-mobile-availability-day">
                                                                        <span>{day.label}</span>
                                                                        <div className={`people-mobile-day-pill ${day.status !== "A" ? "passive" : ""}`}>{day.status}</div>
                                                                        <small>{day.shifts?.morning ? "M" : "-"}/{day.shifts?.afternoon ? "A" : "-"}/{day.shifts?.evening ? "E" : "-"}</small>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="people-mobile-availability-shifts">
                                                                <div className="people-mobile-shift-row"><div><span className="people-mobile-shift-dot"></span><p>Morning (08:00 - 12:00)</p></div><strong>Per day</strong></div>
                                                                <div className="people-mobile-shift-row"><div><span className="people-mobile-shift-dot"></span><p>Afternoon (13:00 - 17:00)</p></div><strong>Per day</strong></div>
                                                                <div className="people-mobile-shift-row muted"><div><span className="people-mobile-shift-dot"></span><p>Evening (18:00+)</p></div><strong>Per day</strong></div>
                                                            </div>
                                                            <div className="people-mobile-blocked-wrap">
                                                                <label>Upcoming Blocked Dates</label>
                                                                <div className="people-blocked-dates people-mobile-blocked-dates">
                                                                    {selectedStaffBlockedDates.length > 0 ? selectedStaffBlockedDates.map(date => (
                                                                        <span key={date}>{date}</span>
                                                                    )) : <span>No blocked dates</span>}
                                                                </div>
                                                            </div>
                                                        </section>
                                                    </div>
                                                )}

                                                {staffProfileEditOpen && (
                                                    <section className="people-mobile-editor">
                                                        {staffProfileMobileTab === "identity" && (
                                                            <div className="people-mobile-editor-section">
                                                                <label className="span-2"><span>Legal name</span><input value={activeStaffProfileDraft.personal.legalName} onChange={e => updateStaffDraftField("personal", "legalName", e.target.value)} /></label>
                                                                <label><span>Preferred name</span><input value={activeStaffProfileDraft.personal.preferredName} onChange={e => updateStaffDraftField("personal", "preferredName", e.target.value)} /></label>
                                                                <label><span>Phone</span><input value={activeStaffProfileDraft.personal.phone} onChange={e => updateStaffDraftField("personal", "phone", e.target.value)} /></label>
                                                                <label className="span-2"><span>Emergency contact</span><input value={activeStaffProfileDraft.emergency.contactName} onChange={e => updateStaffDraftField("emergency", "contactName", e.target.value)} /></label>
                                                                <label><span>Relationship</span><input value={activeStaffProfileDraft.emergency.relationship} onChange={e => updateStaffDraftField("emergency", "relationship", e.target.value)} /></label>
                                                                <label><span>Emergency phone</span><input value={activeStaffProfileDraft.emergency.phone} onChange={e => updateStaffDraftField("emergency", "phone", e.target.value)} /></label>
                                                            </div>
                                                        )}

                                                        {staffProfileMobileTab === "employment" && (
                                                            <div className="people-mobile-editor-section">
                                                                {canAdminDirectEditSelectedStaffProfile && <label><span>Worker type</span><input value={activeStaffProfileDraft.employment.workerType} onChange={e => updateStaffDraftField("employment", "workerType", e.target.value)} /></label>}
                                                                {canAdminDirectEditSelectedStaffProfile && <label><span>Years experience</span><input value={activeStaffProfileDraft.employment.yearsExperience} onChange={e => updateStaffDraftField("employment", "yearsExperience", e.target.value)} /></label>}
                                                                <label><span>Document upload</span><input value={activeStaffProfileDraft.eligibility.workStatus} onChange={e => updateStaffDraftField("eligibility", "workStatus", e.target.value)} placeholder="ID or document reference" /></label>
                                                                {canAdminDirectEditSelectedStaffProfile && <label><span>Background check</span><input value={activeStaffProfileDraft.compliance.backgroundCheckStatus} onChange={e => updateStaffDraftField("compliance", "backgroundCheckStatus", e.target.value)} /></label>}
                                                                <label className="span-2"><span>Availability notes</span><textarea value={activeStaffProfileDraft.employment.availabilityNotes} onChange={e => updateStaffDraftField("employment", "availabilityNotes", e.target.value)} /></label>
                                                            </div>
                                                        )}

                                                        {staffProfileMobileTab === "availability" && (
                                                            <div className="people-mobile-editor-section">
                                                                <div className="people-mobile-weekday-matrix">
                                                                    <div className="people-mobile-weekday-matrix-head">
                                                                        <span>Day</span>
                                                                        <span>Morning</span>
                                                                        <span>Afternoon</span>
                                                                        <span>Evening</span>
                                                                    </div>
                                                                    {activeStaffProfileDraft.availability.weekdays.map((day, index) => (
                                                                        <div key={`${day.label}-${index}`} className="people-mobile-weekday-row">
                                                                            <strong>{day.label}</strong>
                                                                            <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.morning)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "morning", e.target.checked))} /></label>
                                                                            <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.afternoon)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "afternoon", e.target.checked))} /></label>
                                                                            <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.evening)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "evening", e.target.checked))} /></label>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <label><span>Max jobs per day</span><input type="number" value={activeStaffProfileDraft.availability.maxJobsPerDay} onChange={e => updateStaffDraftField("availability", "maxJobsPerDay", parseInt(e.target.value || "0", 10))} /></label>
                                                                <label className="span-2"><span>Blocked dates (comma separated YYYY-MM-DD)</span><input value={(activeStaffProfileDraft.availability.blockedDates || []).join(", ")} onChange={e => updateStaffDraftField("availability", "blockedDates", e.target.value.split(",").map(value => value.trim()).filter(Boolean))} /></label>
                                                            </div>
                                                        )}

                                                        <div className="people-mobile-editor-actions">
                                                            <button type="button" className="team-secondary-action" onClick={() => setStaffProfileEditOpen(false)} disabled={staffProfileSaving}>
                                                                Cancel
                                                            </button>
                                                            {canAdminDirectEditSelectedStaffProfile ? (
                                                                <button type="button" className="team-primary-action" onClick={handleSaveStaffProfileDirect} disabled={staffProfileSaving}>
                                                                    {staffProfileSaving ? "Saving..." : "Save Directly"}
                                                                </button>
                                                            ) : (
                                                                <button type="button" className="team-primary-action" onClick={handleSubmitStaffProfile} disabled={staffProfileSaving}>
                                                                    {staffProfileSaving ? "Submitting..." : "Submit"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </section>
                                                )}
                                            </div>

                                            {(canEditSelectedStaffProfile || canAdminDirectEditSelectedStaffProfile) && (
                                                <button
                                                    type="button"
                                                    className="people-mobile-fab"
                                                    onClick={() => {
                                                        setStaffProfileDraftOwnerUid(selectedStaffMember.uid);
                                                        setStaffProfileDraft(normalizeStaffProfile(selectedStaffMember.staffProfileRequest?.requestedProfile || selectedStaffMember.staffProfile));
                                                        setStaffProfileFeedback("");
                                                        setStaffProfileEditOpen(true);
                                                    }}
                                                >
                                                    {Icons.Edit()}
                                                </button>
                                            )}
                                        </section>

                                        <div className="people-profile-desktop-shell">
                                        <div className="people-profile-breadcrumb">
                                            <button type="button" onClick={() => setSelectedStaffUid(selectedStaffMember.uid)}>
                                                Staff Management
                                            </button>
                                            <span>/</span>
                                            <strong>{selectedStaffMember.name}</strong>
                                        </div>

                                        <div className="people-profile-stat-grid people-profile-stat-grid-top">
                                            <div className="people-profile-stat-card">
                                                <p>Rating</p>
                                                <strong>4.9</strong>
                                            </div>
                                            <div className="people-profile-stat-card">
                                                <p>Jobs Completed</p>
                                                <strong>{selectedStaffCompletedJobs.length}</strong>
                                            </div>
                                            <div className="people-profile-stat-card">
                                                <p>On-Time</p>
                                                <strong>98.5%</strong>
                                            </div>
                                            <div className="people-profile-stat-card">
                                                <p>Exp. Level</p>
                                                <strong>{activeStaffProfileDraft.employment.yearsExperience || "0"} Years</strong>
                                            </div>
                                        </div>

                                        <div className="people-profile-hero people-profile-hero-reference">
                                            <div className="people-profile-hero-main">
                                                <div className="people-profile-photo-card">
                                                    <div className={`people-profile-photo ${selectedStaffMember.photoURL ? "people-profile-photo-image" : ""}`}>
                                                        {selectedStaffMember.photoURL ? (
                                                            <img src={selectedStaffMember.photoURL} alt={selectedStaffMember.name || selectedStaffMember.email} className="avatar-image" />
                                                        ) : getInitials(selectedStaffMember.name || selectedStaffMember.email || "FS")}
                                                    </div>
                                                    <span className="people-profile-active-badge">Active</span>
                                                </div>
                                                <div className="people-profile-headings">
                                                    <h3>{selectedStaffMember.name}</h3>
                                                    <p>{selectedStaffMember.branchName || "Ottawa"} • {getRoleLabel(selectedStaffMember.role)}</p>
                                                </div>
                                            </div>
                                            <div className="people-profile-hero-actions">
                                                <button
                                                    type="button"
                                                    className="people-icon-action"
                                                    disabled={!canEditSelectedStaffProfile && !canAdminDirectEditSelectedStaffProfile}
                                                    onClick={() => {
                                                        if (!canEditSelectedStaffProfile && !canAdminDirectEditSelectedStaffProfile) return;
                                                        setStaffProfileDraftOwnerUid(selectedStaffMember.uid);
                                                        setStaffProfileDraft(normalizeStaffProfile(selectedStaffMember.staffProfileRequest?.requestedProfile || selectedStaffMember.staffProfile));
                                                        setStaffProfileFeedback("");
                                                        setStaffProfileEditOpen(true);
                                                    }}
                                                >
                                                    {Icons.Edit()}
                                                </button>
                                            </div>
                                        </div>

                                        {staffProfileFeedback && (
                                            <div className="people-profile-message">
                                                {staffProfileFeedback}
                                            </div>
                                        )}

                                        {canManagePeopleProfiles && selectedStaffMember.staffProfileRequest?.requestedProfile && (
                                            <div className="people-review-panel">
                                                <div>
                                                    <p className="ops-eyebrow">Approval Queue</p>
                                                    <h4>Pending Staff Profile Request</h4>
                                                    <p>
                                                        Submitted by {selectedStaffMember.staffProfileRequest.submittedByName} on {selectedStaffMember.staffProfileRequest.submittedAt?.split("T")[0]}.
                                                    </p>
                                                </div>
                                                <textarea
                                                    placeholder="Optional rejection reason for branch admin feedback"
                                                    value={staffProfileRejectReason}
                                                    onChange={e => setStaffProfileRejectReason(e.target.value)}
                                                />
                                                <div className="people-review-actions">
                                                    <button type="button" className="team-primary-action" onClick={() => handleReviewStaffProfileRequest("approve")} disabled={staffProfileSaving}>
                                                        Approve Changes
                                                    </button>
                                                    <button type="button" className="team-secondary-action" onClick={() => handleReviewStaffProfileRequest("reject")} disabled={staffProfileSaving}>
                                                        Reject Changes
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {!staffProfileEditOpen ? (
                                        <div className="people-profile-reference-grid">
                                            <article className="people-profile-section">
                                                <div className="people-profile-section-head">
                                                    <p className="ops-eyebrow">Identity</p>
                                                    <h4>Identity</h4>
                                                </div>
                                                <div className="people-profile-read-list">
                                                    <div><span>Email Address</span><strong>{selectedStaffMember.email}</strong></div>
                                                    <div><span>Phone</span><strong>{activeStaffProfileDraft.personal.phone || "Not submitted"}</strong></div>
                                                    <div className="people-profile-divider"></div>
                                                    <div><span className="people-alert-label">Emergency Contact</span><strong>{activeStaffProfileDraft.emergency.contactName || "Not submitted"}</strong></div>
                                                    <div><span>Relationship</span><strong>{activeStaffProfileDraft.emergency.relationship || "Not submitted"}</strong></div>
                                                    <div><span>Phone</span><strong>{activeStaffProfileDraft.emergency.phone || "Not submitted"}</strong></div>
                                                </div>
                                            </article>

                                            <article className="people-profile-section">
                                                <div className="people-profile-section-head">
                                                    <p className="ops-eyebrow">Availability</p>
                                                    <h4>Availability</h4>
                                                </div>
                                                <div className="people-availability-header">
                                                    <strong>Max {selectedStaffAvailability.maxJobsPerDay} Jobs/Day</strong>
                                                </div>
                                                <div className="people-availability-week">
                                                    {selectedStaffAvailability.weekdays.map((day, index) => (
                                                        <div key={`${day.label}-${index}`} className="people-day-tile-wrap">
                                                            <span>{day.label}</span>
                                                            <div className={`people-day-tile ${day.status !== "A" ? "people-day-tile-passive" : ""}`}>{day.status}</div>
                                                            <small>{day.shifts?.morning ? "M" : "-"}/{day.shifts?.afternoon ? "A" : "-"}/{day.shifts?.evening ? "E" : "-"}</small>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="people-availability-shifts">
                                                    <div className="people-shift-row"><span className="people-shift-dot"></span><span>Morning (08:00 - 12:00)</span><strong>Per day</strong></div>
                                                    <div className="people-shift-row"><span className="people-shift-dot"></span><span>Afternoon (13:00 - 17:00)</span><strong>Per day</strong></div>
                                                    <div className="people-shift-row people-shift-row-muted"><span className="people-shift-dot"></span><span>Evening (18:00+)</span><strong>Per day</strong></div>
                                                </div>
                                                <div className="people-profile-divider"></div>
                                                <div>
                                                    <span className="people-subsection-title">Upcoming Blocked Dates</span>
                                                    <div className="people-blocked-dates">
                                                        {selectedStaffBlockedDates.length > 0 ? selectedStaffBlockedDates.map(date => (
                                                            <span key={date}>{date}</span>
                                                        )) : <span>No blocked dates</span>}
                                                    </div>
                                                </div>
                                            </article>

                                            <article className="people-profile-section">
                                                <div className="people-profile-section-head">
                                                    <p className="ops-eyebrow">Performance</p>
                                                    <h4>Performance</h4>
                                                </div>
                                                <div className="people-performance-rating">
                                                    <span>Customer Rating</span>
                                                    <strong>4.9 ★</strong>
                                                </div>
                                                <div className="people-performance-bar"><span></span></div>
                                                <div className="people-performance-metrics">
                                                    <div><span>No-Shows</span><strong>0</strong></div>
                                                    <div><span>Late (&gt;15m)</span><strong>2</strong></div>
                                                    <div><span>Cancellations</span><strong>1</strong></div>
                                                </div>
                                            </article>

                                            <article className="people-profile-section">
                                                <div className="people-profile-section-head">
                                                    <p className="ops-eyebrow">Employment</p>
                                                    <h4>Employment</h4>
                                                </div>
                                                <div className="people-profile-read-list">
                                                    <div><span>Worker Type</span><strong>{activeStaffProfileDraft.employment.workerType || getRoleLabel(selectedStaffMember.role)}</strong></div>
                                                    <div><span>Document Upload</span><strong>{activeStaffProfileDraft.eligibility.workStatus || "Pending review"}</strong></div>
                                                    <div><span>Police Clearance</span><strong>{activeStaffProfileDraft.compliance.backgroundCheckStatus || "Pending"}</strong></div>
                                                    <div><span>Start Date</span><strong>{selectedStaffMember.createdAt ? selectedStaffMember.createdAt.split("T")[0] : "Pending"}</strong></div>
                                                    <div className="people-note-card">
                                                        “{activeStaffProfileDraft.employment.availabilityNotes || "Staff profile notes will appear here after branch admin approval."}”
                                                    </div>
                                                </div>
                                            </article>

                                            <article className="people-profile-section">
                                                <div className="people-profile-section-head">
                                                    <p className="ops-eyebrow">Skills & Restrictions</p>
                                                    <h4>Skills & Restrictions</h4>
                                                </div>
                                                <div className="people-skill-group">
                                                    <span className="people-subsection-title">Approved Services</span>
                                                    <div className="people-chip-list">
                                                        <span>Standard Cleaning</span>
                                                        <span>Deep Cleaning</span>
                                                        <span>Move-in/out</span>
                                                        <span>Carpet Steam</span>
                                                    </div>
                                                </div>
                                                <div className="people-skill-group">
                                                    <span className="people-subsection-title">Work Restrictions</span>
                                                    <div className="people-restrictions-list">
                                                        <div><strong>No Pets</strong><span>(Allergy)</span></div>
                                                        <div><strong>Can work alone</strong></div>
                                                    </div>
                                                </div>
                                            </article>

                                        </div>
                                        ) : (
                                            <section className="people-profile-editor people-profile-editor-full">
                                                <div className="people-profile-section-head">
                                                    <p className="ops-eyebrow">Edit Profile</p>
                                                    <h4>{canAdminDirectEditSelectedStaffProfile ? "Edit Staff Profile" : "Submit Profile Changes For Review"}</h4>
                                                </div>
                                                <div className="people-edit-groups">
                                                    <section className="people-edit-group">
                                                        <div className="people-profile-section-head">
                                                            <p className="ops-eyebrow">Approval Required</p>
                                                            <h4>Identity</h4>
                                                        </div>
                                                        <div className="people-profile-form-grid people-profile-form-grid-wide">
                                                            <label><span>Legal name</span><input value={activeStaffProfileDraft.personal.legalName} onChange={e => updateStaffDraftField("personal", "legalName", e.target.value)} /></label>
                                                            <label><span>Preferred name</span><input value={activeStaffProfileDraft.personal.preferredName} onChange={e => updateStaffDraftField("personal", "preferredName", e.target.value)} /></label>
                                                            <label><span>Phone</span><input value={activeStaffProfileDraft.personal.phone} onChange={e => updateStaffDraftField("personal", "phone", e.target.value)} /></label>
                                                            <label><span>Date of birth</span><input type="date" value={activeStaffProfileDraft.personal.dateOfBirth} onChange={e => updateStaffDraftField("personal", "dateOfBirth", e.target.value)} /></label>
                                                            <label className="span-2"><span>Address</span><input value={activeStaffProfileDraft.personal.address} onChange={e => updateStaffDraftField("personal", "address", e.target.value)} /></label>
                                                            <label><span>City</span><input value={activeStaffProfileDraft.personal.city} onChange={e => updateStaffDraftField("personal", "city", e.target.value)} /></label>
                                                            <label><span>Postal code</span><input value={activeStaffProfileDraft.personal.postalCode} onChange={e => updateStaffDraftField("personal", "postalCode", e.target.value)} /></label>
                                                        </div>
                                                    </section>

                                                    <section className="people-edit-group">
                                                        <div className="people-profile-section-head">
                                                            <p className="ops-eyebrow">Approval Required</p>
                                                            <h4>Emergency Contact</h4>
                                                        </div>
                                                        <div className="people-profile-form-grid people-profile-form-grid-wide">
                                                            <label><span>Emergency contact</span><input value={activeStaffProfileDraft.emergency.contactName} onChange={e => updateStaffDraftField("emergency", "contactName", e.target.value)} /></label>
                                                            <label><span>Relationship</span><input value={activeStaffProfileDraft.emergency.relationship} onChange={e => updateStaffDraftField("emergency", "relationship", e.target.value)} /></label>
                                                            <label><span>Emergency phone</span><input value={activeStaffProfileDraft.emergency.phone} onChange={e => updateStaffDraftField("emergency", "phone", e.target.value)} /></label>
                                                        </div>
                                                    </section>

                                                    <section className="people-edit-group">
                                                        <div className="people-profile-section-head">
                                                            <p className="ops-eyebrow">Scheduling Logic</p>
                                                            <h4>Availability</h4>
                                                        </div>
                                                        <div className="people-availability-edit-grid">
                                                            <div className="people-availability-matrix">
                                                                <div className="people-availability-matrix-head">
                                                                    <span>Day</span>
                                                                    <span>Morning</span>
                                                                    <span>Afternoon</span>
                                                                    <span>Evening</span>
                                                                </div>
                                                                {activeStaffProfileDraft.availability.weekdays.map((day, index) => (
                                                                    <div key={`${day.label}-${index}`} className="people-availability-matrix-row">
                                                                        <strong>{day.label}</strong>
                                                                        <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.morning)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "morning", e.target.checked))} /></label>
                                                                        <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.afternoon)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "afternoon", e.target.checked))} /></label>
                                                                        <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.evening)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "evening", e.target.checked))} /></label>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <label><span>Max jobs per day</span><input type="number" value={activeStaffProfileDraft.availability.maxJobsPerDay} onChange={e => updateStaffDraftField("availability", "maxJobsPerDay", parseInt(e.target.value || "0", 10))} /></label>
                                                            <label className="span-2"><span>Blocked dates (comma separated YYYY-MM-DD)</span><input value={(activeStaffProfileDraft.availability.blockedDates || []).join(", ")} onChange={e => updateStaffDraftField("availability", "blockedDates", e.target.value.split(",").map(value => value.trim()).filter(Boolean))} /></label>
                                                        </div>
                                                    </section>
                                                </div>
                                                <div className="people-profile-form-grid people-profile-form-grid-wide">
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Worker type</span><input value={activeStaffProfileDraft.employment.workerType} onChange={e => updateStaffDraftField("employment", "workerType", e.target.value)} /></label>}
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Years experience</span><input value={activeStaffProfileDraft.employment.yearsExperience} onChange={e => updateStaffDraftField("employment", "yearsExperience", e.target.value)} /></label>}
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Languages</span><input value={activeStaffProfileDraft.employment.languages} onChange={e => updateStaffDraftField("employment", "languages", e.target.value)} /></label>}
                                                    <label><span>T-shirt size</span><input value={activeStaffProfileDraft.employment.tshirtSize} onChange={e => updateStaffDraftField("employment", "tshirtSize", e.target.value)} /></label>
                                                    <label className="span-2"><span>Availability notes</span><textarea value={activeStaffProfileDraft.employment.availabilityNotes} onChange={e => updateStaffDraftField("employment", "availabilityNotes", e.target.value)} /></label>
                                                    <label><span>Document upload</span><input value={activeStaffProfileDraft.eligibility.workStatus} onChange={e => updateStaffDraftField("eligibility", "workStatus", e.target.value)} placeholder="ID or document reference" /></label>
                                                    <label><span>Permit expiry</span><input type="date" value={activeStaffProfileDraft.eligibility.workPermitExpiry} onChange={e => updateStaffDraftField("eligibility", "workPermitExpiry", e.target.value)} /></label>
                                                    <label><span>SIN last 4</span><input value={activeStaffProfileDraft.eligibility.sinLast4} onChange={e => updateStaffDraftField("eligibility", "sinLast4", e.target.value)} /></label>
                                                    <label><span>License class</span><input value={activeStaffProfileDraft.eligibility.driversLicenseClass} onChange={e => updateStaffDraftField("eligibility", "driversLicenseClass", e.target.value)} /></label>
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Background check</span><input value={activeStaffProfileDraft.compliance.backgroundCheckStatus} onChange={e => updateStaffDraftField("compliance", "backgroundCheckStatus", e.target.value)} /></label>}
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Background expiry</span><input type="date" value={activeStaffProfileDraft.compliance.backgroundCheckExpiry} onChange={e => updateStaffDraftField("compliance", "backgroundCheckExpiry", e.target.value)} /></label>}
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Insurance status</span><input value={activeStaffProfileDraft.compliance.insuranceStatus} onChange={e => updateStaffDraftField("compliance", "insuranceStatus", e.target.value)} /></label>}
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Insurance expiry</span><input type="date" value={activeStaffProfileDraft.compliance.insuranceExpiry} onChange={e => updateStaffDraftField("compliance", "insuranceExpiry", e.target.value)} /></label>}
                                                    <label><span>Training status</span><input value={activeStaffProfileDraft.compliance.trainingStatus} onChange={e => updateStaffDraftField("compliance", "trainingStatus", e.target.value)} /></label>
                                                </div>
                                                <div className="people-profile-footer">
                                                    <p>
                                                        This profile is stored in Firestore. Identity and emergency contact changes require admin approval. Availability follows separate scheduling rules with the next 48 hours locked from direct cleaner changes.
                                                    </p>
                                                    <div className="people-editor-actions">
                                                        <button type="button" className="team-secondary-action" onClick={() => setStaffProfileEditOpen(false)} disabled={staffProfileSaving}>
                                                            Cancel
                                                        </button>
                                                        {canAdminDirectEditSelectedStaffProfile ? (
                                                            <button type="button" className="team-primary-action" onClick={handleSaveStaffProfileDirect} disabled={staffProfileSaving}>
                                                                {staffProfileSaving ? "Saving..." : "Save Directly"}
                                                            </button>
                                                        ) : (
                                                            <button type="button" className="team-primary-action" onClick={handleSubmitStaffProfile} disabled={staffProfileSaving}>
                                                                {staffProfileSaving ? "Submitting..." : "Submit For Review"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </section>
                                        )}

                                        {!canManagePeopleProfiles && (
                                            <div className="people-profile-footer">
                                                <p>
                                                    Profile changes go to branch admin for approval. Availability restrictions are enforced by scheduling logic and are not shown as editable warnings in the UI.
                                                </p>
                                                {canEditSelectedStaffProfile && (
                                                    <button type="button" className="team-primary-action" onClick={handleSubmitStaffProfile} disabled={staffProfileSaving}>
                                                        {staffProfileSaving ? "Submitting..." : "Submit Profile Update"}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "departments" && canViewAdministration && (
                    <div className="animate-fade flex flex-col gap-6">
                        <div className="ops-control-header">
                            <div>
                                <p className="ops-eyebrow">SmarTouch Clean v1.000 foundation</p>
                                <h3 className="ops-title">Departments Hub</h3>
                                <p className="ops-copy">
                                    Use this as the old system&apos;s upgrade map: every department is branch-aware and permission-ready.
                                </p>
                            </div>
                            <span className="ops-chip">Ottawa Branch</span>
                        </div>

                        <div className="department-grid">
                            {DEPARTMENTS.map(department => {
                                const unlocked = roleHasDepartment(currentUser.role, department.id);
                                return (
                                    <article key={department.id} className={`department-card ${unlocked ? "department-card-active" : ""}`}>
                                        <div className="department-card-top">
                                            <div className="department-icon">{Icons.Departments()}</div>
                                            <span className={`ops-chip ${unlocked ? "ops-chip-green" : ""}`}>
                                                {unlocked ? "Enabled" : "Locked"}
                                            </span>
                                        </div>
                                        <h4>{department.name}</h4>
                                        <p>{department.description}</p>
                                        <div className="department-modules">
                                            {department.modules.map(module => (
                                                <span key={module}>{module}</span>
                                            ))}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === "permissions" && canManagePermissions && (
                    <div className="animate-fade flex flex-col gap-6">
                        <div className="ops-control-header">
                            <div>
                                <p className="ops-eyebrow">Access control</p>
                                <h3 className="ops-title">Permissions & Roles</h3>
                                <p className="ops-copy">
                                    Legacy roles remain compatible while we introduce real departments, branch rules, and people management.
                                </p>
                            </div>
                            <span className="ops-chip ops-chip-green">Super Admin controlled</span>
                        </div>

                        <div className="permissions-grid">
                            {Object.entries(ROLE_DEFINITIONS).map(([roleId, definition]) => (
                                <article key={roleId} className="permission-card">
                                    <div className="permission-card-head">
                                        <div>
                                            <h4>{definition.label}</h4>
                                            <p>{definition.description}</p>
                                        </div>
                                        <span className="ops-chip">{roleId}</span>
                                    </div>
                                    <div className="permission-departments">
                                        {DEPARTMENTS.map(department => (
                                            <span
                                                key={department.id}
                                                className={definition.departments.includes(department.id) ? "allowed" : ""}
                                            >
                                                {department.name}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="permission-flags">
                                        <span>{definition.canSwitchBranches ? "Can switch branches" : "Branch scoped"}</span>
                                        <span>{definition.canManagePermissions ? "Can manage permissions" : "No permission edits"}</span>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <div className="notification-readiness-panel">
                            <div>
                                <p className="ops-eyebrow">Communication infrastructure</p>
                                <h3 className="ops-title">Email, SMS, and App Push Requirements</h3>
                                <p className="ops-copy">
                                    To send reminders from info@smartouchclean.com and notify customers, cleaners, supervisors, and admins,
                                    the app needs these production services connected.
                                </p>
                            </div>
                            <div className="notification-requirements-grid">
                                <div>
                                    <strong>Email</strong>
                                    <span>SendGrid, Resend, Postmark, or Gmail Workspace SMTP with SPF/DKIM/DMARC configured for smartouchclean.com.</span>
                                </div>
                                <div>
                                    <strong>SMS / Phone</strong>
                                    <span>Twilio or Telnyx number, consent tracking, opt-out handling, and customer/cleaner phone verification.</span>
                                </div>
                                <div>
                                    <strong>Web Push</strong>
                                    <span>PWA manifest, service worker, VAPID keys, browser permission prompts, and saved push subscriptions per user/device.</span>
                                </div>
                                <div>
                                    <strong>In-App Notes</strong>
                                    <span>Firestore notifications collection for supervisor notes, admin alerts, job comments, unread counts, and audit trail.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "edit-requests" && canViewAdministration && (
                    <div className="animate-fade flex flex-col gap-6">
                        {editRequests.filter(r => r.status === "Pending").length === 0 ? (
                            <div className="panel-card p-12 text-center text-slate-400 text-sm">Review Inbox is clean. No cleaner modification requests pending.</div>
                        ) : (
                            editRequests.filter(r => r.status === "Pending").map(req => {
                                const orig = req.originalData || {};
                                const reqd = req.requestedData || {};
                                return (
                                    <div key={req.id} className="panel-card border-l-4 border-amber-500 p-6 flex flex-col gap-4 bg-white shadow rounded-2xl">
                                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                                            <div>
                                                <h4 className="font-extrabold text-sm text-slate-800">Booking Edit Request for {req.clientName}</h4>
                                                <span className="text-[10px] text-slate-400 block mt-1">Submitted by: <strong>{req.requestedBy}</strong> • {req.createdAt.split("T")[0]}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleResolveEdit(req.id, "approve")} className="btn btn-primary btn-sm">Approve &amp; Merge</button>
                                                <button onClick={() => handleResolveEdit(req.id, "reject")} className="btn btn-danger btn-sm">Reject Request</button>
                                            </div>
                                        </div>

                                        {/* side-by-side comparative grid */}
                                        <div className="comparison-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Original details */}
                                            <div className="comparison-column bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                <div className="comparison-title text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">Original dispatch Details</div>
                                                <div className="flex flex-col gap-1.5 text-xs text-slate-700">
                                                    <div><strong>Client:</strong> {orig.clientName}</div>
                                                    <div><strong>Phone:</strong> {orig.phone}</div>
                                                    <div><strong>Email:</strong> {orig.email}</div>
                                                    <div><strong>Address 1:</strong> {orig.address1}</div>
                                                    <div><strong>Address 2:</strong> {orig.address2 || "None"}</div>
                                                    <div><strong>City:</strong> {orig.city} ({orig.postalCode})</div>
                                                    <div><strong>Service:</strong> {orig.service}</div>
                                                    <div><strong>Price / Duration:</strong> ${orig.price} / {orig.duration} hrs</div>
                                                    {orig.customDiscountAmount > 0 && (
                                                        <div className="text-green-600 font-semibold"><strong>Special Discount:</strong> -${parseFloat(orig.customDiscountAmount).toFixed(2)}</div>
                                                    )}
                                                    <div><strong>Schedule Date:</strong> {orig.date} • {orig.time}</div>
                                                    <div><strong>Assigned Team:</strong> {orig.team}</div>
                                                    <div><strong>Status:</strong> <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${orig.status === 'Completed' ? 'bg-green-100 text-green-700' : orig.status === 'Cancelled' ? 'bg-red-100 text-red-700' : orig.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{orig.status || 'Pending'}</span></div>
                                                </div>
                                            </div>
                                            {/* Requested updates */}
                                            <div className="comparison-column bg-amber-50 bg-opacity-30 border border-amber-200 p-4 rounded-xl">
                                                <div className="comparison-title text-[9px] font-bold text-amber-700 uppercase tracking-widest border-b border-amber-200 pb-1 mb-2">Requested Updates</div>
                                                <div className="flex flex-col gap-1.5 text-xs text-slate-700">
                                                    <div><strong>Client:</strong> <span className={orig.clientName !== reqd.clientName ? "diff-highlight font-bold" : ""}>{reqd.clientName}</span></div>
                                                    <div><strong>Phone:</strong> <span className={orig.phone !== reqd.phone ? "diff-highlight font-bold" : ""}>{reqd.phone}</span></div>
                                                    <div><strong>Email:</strong> <span className={orig.email !== reqd.email ? "diff-highlight font-bold" : ""}>{reqd.email}</span></div>
                                                    <div><strong>Address 1:</strong> <span className={orig.address1 !== reqd.address1 ? "diff-highlight font-bold" : ""}>{reqd.address1}</span></div>
                                                    <div><strong>Address 2:</strong> <span className={orig.address2 !== reqd.address2 ? "diff-highlight font-bold" : ""}>{reqd.address2 || "None"}</span></div>
                                                    <div><strong>City:</strong> <span className={(orig.city !== reqd.city || orig.postalCode !== reqd.postalCode) ? "diff-highlight font-bold" : ""}>{reqd.city} ({reqd.postalCode})</span></div>
                                                    <div><strong>Service:</strong> <span className={orig.service !== reqd.service ? "diff-highlight font-bold" : ""}>{reqd.service}</span></div>
                                                    <div><strong>Price / Duration:</strong> <span className={(orig.price !== reqd.price || orig.duration !== reqd.duration) ? "diff-highlight font-bold" : ""}>${reqd.price} / {reqd.duration} hrs</span></div>
                                                    {reqd.customDiscountAmount > 0 && (
                                                        <div className="text-green-600 font-semibold"><strong>Special Discount:</strong> <span className={orig.customDiscountAmount !== reqd.customDiscountAmount ? "diff-highlight font-bold text-green-700" : ""}>-${parseFloat(reqd.customDiscountAmount).toFixed(2)}</span></div>
                                                    )}
                                                    <div><strong>Schedule Date:</strong> <span className={(orig.date !== reqd.date || orig.time !== reqd.time) ? "diff-highlight font-bold" : ""}>{reqd.date} • {reqd.time}</span></div>
                                                    <div><strong>Assigned Team:</strong> <span className={orig.team !== reqd.team ? "diff-highlight font-bold" : ""}>{reqd.team}</span></div>
                                                    <div><strong>Status:</strong> <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${orig.status !== reqd.status ? 'diff-highlight' : ''} ${reqd.status === 'Completed' ? 'bg-green-100 text-green-700' : reqd.status === 'Cancelled' ? 'bg-red-100 text-red-700' : reqd.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{reqd.status || 'Pending'}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === "catalog" && canViewAdministration && (
                    <div className="animate-fade">
                        <V2SettingsManager
                            catalog={v2Catalog}
                            setCatalog={setV2Catalog}
                            onSave={handleSaveV2Catalog}
                        />
                    </div>
                )}

                {activeTab === "settings" && (
                    <div className="animate-fade">
                        <div className="settings-container">
                            {/* Card 1: User Profile */}
                            <div className="settings-card">
                                <div className="panel-header border-b border-slate-100 pb-3">
                                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">User Profile Specifications</h4>
                                </div>
                                <form onSubmit={handleProfileUpdate} className="settings-form">
                                    <div className="settings-avatar-group">
                                        <div className={`settings-avatar ${currentUser.photoURL ? "settings-avatar-photo" : ""}`}>
                                            {currentUser.photoURL ? (
                                                <img src={currentUser.photoURL} alt={currentUser.name} className="avatar-image" />
                                            ) : getInitials(currentUser.name)}
                                        </div>
                                        <div>
                                            <h5 className="settings-profile-name">{currentUser.name}</h5>
                                            <span className="settings-profile-role">{roleLabel}</span>
                                        </div>
                                    </div>
                                    <label className="settings-photo-upload">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="user"
                                            onChange={e => handleProfilePhotoCapture(e.target.files?.[0])}
                                            disabled={profilePhotoUploading}
                                        />
                                        {profilePhotoUploading ? "Uploading Photo..." : "Take Or Upload Profile Photo"}
                                    </label>
                                    {profilePhotoStatus && (
                                        <div className="people-profile-message">
                                            {profilePhotoStatus}
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label>Display Name</label>
                                        <input
                                            type="text"
                                            value={profileName}
                                            onChange={e => setProfileName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Email Address (Read-only)</label>
                                        <input
                                            type="email"
                                            value={currentUser.email}
                                            disabled
                                            className="input-readonly"
                                        />
                                    </div>
                                    {!canManagePermissions && (
                                        <div className="form-group">
                                            <label>Assigned Cleaning Crew</label>
                                            <input
                                                type="text"
                                                value={currentUser.teamId || "None"}
                                                disabled
                                                className="input-readonly"
                                            />
                                        </div>
                                    )}
                                    <button type="submit" disabled={profileLoading} className="btn btn-primary h-[44px] rounded-lg text-white font-bold transition mt-2">
                                        {profileLoading ? "Updating Profile..." : "Save Profile Details"}
                                    </button>

                                    {/* Mobile Accessible Log Out Button */}
                                    <div className="mt-4 pt-4 border-t border-slate-100/80 w-full">
                                        <button
                                            type="button"
                                            onClick={handleSignout}
                                            className="btn btn-danger w-full h-[44px] flex items-center justify-center gap-2 font-bold transition-all mt-2"
                                        >
                                            {Icons.Logout()} Log Out of Account
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Card 2: Security & Password Update */}
                            <div className="settings-card">
                                <div className="panel-header border-b border-slate-100 pb-3">
                                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Security & Password Management</h4>
                                </div>
                                <form onSubmit={handlePasswordChange} className="settings-form">
                                    <div className="form-group">
                                        <label>Current Password</label>
                                        <input
                                            type="password"
                                            value={securityForm.currentPassword}
                                            onChange={e => setSecurityForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                            required
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>New Password</label>
                                        <input
                                            type="password"
                                            value={securityForm.newPassword}
                                            onChange={e => setSecurityForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                            required
                                            placeholder="Min 6 characters"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Confirm New Password</label>
                                        <input
                                            type="password"
                                            value={securityForm.confirmPassword}
                                            onChange={e => setSecurityForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                            required
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <button type="submit" disabled={securityLoading} className="btn btn-danger h-[44px] rounded-lg font-bold transition mt-2">
                                        {securityLoading ? "Updating Password..." : "Change Security Password"}
                                    </button>
                                </form>
                            </div>

                        </div>
                    </div>
                )}
            </main>

            {/* High Fidelity iOS Fixed Bottom Navigation Bar on Mobile Viewports */}
            <div className="mobile-nav-bar">
                {!isPendingCleanerOnboarding && (
                    <button onClick={() => setActiveTab("dashboard")} className={`mobile-nav-item ${activeTab === "dashboard" ? "active" : ""}`}>
                        {Icons.Dashboard()}
                        <span>Dashboard</span>
                    </button>
                )}
                {!isPendingCleanerOnboarding && (
                    <button onClick={() => setActiveTab("bookings")} className={`mobile-nav-item ${activeTab === "bookings" ? "active" : ""}`}>
                        {Icons.Bookings()}
                        <span>Bookings</span>
                    </button>
                )}
                {canViewOperations && (
                    <button onClick={() => setActiveTab("calendar")} className={`mobile-nav-item ${activeTab === "calendar" ? "active" : ""}`}>
                        {Icons.Calendar()}
                        <span>Calendar</span>
                    </button>
                )}
                {canViewPeople && (
                    <button onClick={() => setActiveTab("teams")} className={`mobile-nav-item ${activeTab === "teams" ? "active" : ""}`}>
                        {Icons.Teams()}
                        <span>Staff</span>
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
                    <button onClick={() => setActiveTab("departments")} className={`mobile-nav-item ${activeTab === "departments" ? "active" : ""}`}>
                        {Icons.Departments()}
                        <span>Departments</span>
                    </button>
                )}
                {canManagePermissions && (
                    <button onClick={() => setActiveTab("permissions")} className={`mobile-nav-item ${activeTab === "permissions" ? "active" : ""}`}>
                        {Icons.Shield()}
                        <span>Permissions</span>
                    </button>
                )}
                {!isPendingCleanerOnboarding && (
                    <button onClick={() => setActiveTab("settings")} className={`mobile-nav-item ${activeTab === "settings" ? "active" : ""}`}>
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        <span>Settings</span>
                    </button>
                )}
            </div>

            {serviceConfigOpen && configCategory && (() => {
                const selectedSize = configCategory.sizes?.find(size => size.id === configSizeId);
                const basePrice = selectedSize ? parseFloat(selectedSize.price || 0) : getCategoryBasePrice(configCategory);
                const isHouseCleaning = configCategory.id === "house_cleaning";
                const bathroomPrice = isHouseCleaning ? parseFloat(v2Catalog.bathrooms?.[configBathroomKey] || 0) : 0;
                const selectedAddonRows = (configCategory.addons || []).map(addon => {
                    const qty = Number(configAddons[addon.id] || 0);
                    return {
                        ...addon,
                        qty,
                        total: qty * parseFloat(addon.price || 0)
                    };
                });
                const addonTotal = selectedAddonRows.reduce((sum, addon) => sum + addon.total, 0);
                return (
                    <div className="modal-backdrop show">
                        <div className="modal-content modal-content-service-config animate-pop">
                            <div className="modal-header modal-header-brand">
                                <div className="modal-title-stack">
                                    <h3 className="modal-title-inverse">Configure Service</h3>
                                    <p className="modal-subtitle-inverse">{configCategory.name}</p>
                                </div>
                                <button onClick={() => setServiceConfigOpen(false)} className="modal-close-btn" aria-label="Close">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                                </button>
                            </div>
                            <div className="service-config-body">
                                <section className="service-config-section">
                                    <div className="service-config-heading">
                                        <h4>Subcategory</h4>
                                        <span>{configCategory.pricingModel?.replaceAll("_", " ")}</span>
                                    </div>
                                    {configCategory.sizes?.length > 0 ? (
                                        <div className="service-option-grid">
                                            {configCategory.sizes.map(size => (
                                                <button
                                                    key={size.id}
                                                    onClick={() => setConfigSizeId(size.id)}
                                                    type="button"
                                                    className={`service-option-card ${configSizeId === size.id ? "active" : ""}`}
                                                >
                                                    <strong>{size.name}</strong>
                                                    <span>${parseFloat(size.price || 0).toFixed(2)} • {size.durationHrs || 0} hrs</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="service-option-card active">
                                            <strong>Base service</strong>
                                            <span>${basePrice.toFixed(2)} • {getCategoryDuration(configCategory)} hrs</span>
                                        </div>
                                    )}
                                    {isHouseCleaning && (
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
                                    <strong>${(basePrice + bathroomPrice + addonTotal).toFixed(2)}</strong>
                                </div>
                                <button onClick={addConfiguredServiceToCart} type="button" className="admin-primary-action">
                                    Add Configured Service
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
                            <button onClick={() => setAdminCheckoutOpen(false)} className="modal-close-btn" aria-label="Close">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                            </button>
                        </div>
                        <form onSubmit={saveAdminCartBooking} className="admin-checkout-form">
                            <div className="admin-checkout-grid">
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
                                <label className="span-2">
                                    <span>Street Address</span>
                                    <input required value={adminCheckoutForm.address1} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, address1: e.target.value }))} />
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
                                <label>
                                    <span>Date</span>
                                    <input type="date" required value={adminCheckoutForm.date} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, date: e.target.value }))} />
                                </label>
                                <label>
                                    <span>Time</span>
                                    <input required value={adminCheckoutForm.time} onChange={e => setAdminCheckoutForm(prev => ({ ...prev, time: e.target.value }))} />
                                </label>
                                <div className="span-2 admin-staff-assignment">
                                    <span>Assign Field Staff</span>
                                    <div className="admin-staff-picker">
                                        {fieldStaff.length === 0 ? (
                                            <p>No approved cleaners, supervisors, employees, or subcontractors found yet.</p>
                                        ) : (
                                            fieldStaff.map(member => {
                                                const checked = adminCheckoutForm.assignedStaffIds.includes(member.uid);
                                                return (
                                                    <label key={member.uid} className={checked ? "active" : ""}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
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
                                                        <small>{getRoleLabel(member.role)} · {member.branchName || "Ottawa"}</small>
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
                            </div>
                            <aside className="admin-checkout-summary">
                                {adminServiceCart.map(item => (
                                    <div key={item.cartId}>
                                        <strong>{item.name}</strong>
                                        <span>{item.optionName}{item.bathroomKey ? ` • ${item.bathroomKey}` : ""}</span>
                                        <em>${item.price.toFixed(2)}</em>
                                    </div>
                                ))}
                                <div className="admin-checkout-total">
                                    <span>Subtotal</span><strong>${adminCartTotals.subtotal.toFixed(2)}</strong>
                                    <span>{activeBranch.taxLabel}</span><strong>${adminCartTotals.tax.toFixed(2)}</strong>
                                    <span>Total before discounts</span><strong>${adminCartTotals.total.toFixed(2)}</strong>
                                </div>
                            </aside>
                            <div className="admin-checkout-actions">
                                <button type="button" onClick={() => setAdminCheckoutOpen(false)} className="btn btn-secondary btn-sm">Back to Cart</button>
                                <button type="submit" className="btn btn-primary btn-sm">Create Booking</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 1: VIEW DETAILS MODAL */}
            {detailsModalOpen && selectedBooking && (() => {
                const b = selectedBooking;
                const extrasEntries = Object.entries(b.extras || {}).filter(([, qty]) => qty);
                const hasExtras = extrasEntries.length > 0;
                const price = parseFloat(b.price || 0);
                const discount = parseFloat(b.customDiscountAmount || 0);
                return (
                    <div className="modal-backdrop show">
                        <div className="modal-content modal-content-details animate-pop">
                            {/* Header */}
                            <div className="modal-header modal-header-brand modal-header-compact">
                                <div className="modal-title-stack">
                                    <h3 className="modal-title-inverse">
                                        Dispatch Details
                                    </h3>
                                    <p className="modal-subtitle-inverse">
                                        {b.date} · {b.time} · {b.duration}h
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

                                {/* Client Info */}
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

                                {/* Pricing */}
                                <div className="detail-card">
                                    <div className="detail-card-title">💰 Pricing</div>
                                    <div className="detail-pricing-list">
                                        <div className="detail-row">
                                            <span className="detail-label">Total Price (incl. HST)</span>
                                            <span className="detail-value detail-price-total bold">${price.toFixed(2)}</span>
                                        </div>
                                        {discount > 0 && (
                                            <div className="detail-row">
                                                <span className="detail-label">Special Discount</span>
                                                <span className="detail-value detail-discount-value">-${discount.toFixed(2)}</span>
                                            </div>
                                        )}
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

                            </div>

                            {/* Footer */}
                            <div className="modal-footer">
                                <button onClick={() => setDetailsModalOpen(false)} className="btn btn-secondary btn-sm">Close</button>
                                <button onClick={() => { setDetailsModalOpen(false); openEditBookingModal(selectedBooking); }} className="btn btn-primary btn-sm">Edit Dispatch</button>
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
                                    Edit Dispatch Reservation
                                </h3>
                                <button onClick={() => setBookingModalOpen(false)} className="modal-close-btn" aria-label="Close">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                                </button>
                            </div>
                            <form onSubmit={handleBookingSubmit} className="modal-form-scroll">
                                <div className="modal-body flex flex-col gap-4 text-xs p-6">

                                    {/* 2-Column Administrative Fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Client First Name</label>
                                            <input type="text" value={bookingForm.firstName} onChange={e => setBookingForm(prev => ({ ...prev, firstName: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                        </div>
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Client Last Name</label>
                                            <input type="text" value={bookingForm.lastName} onChange={e => setBookingForm(prev => ({ ...prev, lastName: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                        </div>
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Client Phone</label>
                                            <input type="text" value={bookingForm.phone} onChange={e => setBookingForm(prev => ({ ...prev, phone: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                        </div>
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Client Email</label>
                                            <input type="email" value={bookingForm.email} onChange={e => setBookingForm(prev => ({ ...prev, email: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                        </div>
                                    </div>

                                    <div className="form-group flex flex-col gap-1">
                                        <label className="font-bold text-slate-700">Service Street Address</label>
                                        <input type="text" value={bookingForm.address1} onChange={e => setBookingForm(prev => ({ ...prev, address1: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">City</label>
                                            <input type="text" value={bookingForm.city} onChange={e => setBookingForm(prev => ({ ...prev, city: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                        </div>
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Postal Code</label>
                                            <input type="text" value={bookingForm.postalCode} onChange={e => setBookingForm(prev => ({ ...prev, postalCode: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                        </div>
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Service Category</label>
                                            <input type="text" value={bookingForm.service} onChange={e => setBookingForm(prev => ({ ...prev, service: e.target.value }))} required className="border border-slate-200 rounded-lg p-2 bg-slate-50 cursor-not-allowed" disabled />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Scheduled Date</label>
                                            <input type="date" value={bookingForm.date} onChange={e => setBookingForm(prev => ({ ...prev, date: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                        </div>
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Scheduled Time</label>
                                            <input type="text" value={bookingForm.time} onChange={e => setBookingForm(prev => ({ ...prev, time: e.target.value }))} required className="border border-slate-200 rounded-lg p-2" />
                                        </div>
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Estimated Hours</label>
                                            <input type="number" step="0.5" value={bookingForm.duration} onChange={e => setBookingForm(prev => ({ ...prev, duration: parseFloat(e.target.value) }))} required className="border border-slate-200 rounded-lg p-2" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="form-group flex flex-col gap-1 md:col-span-3">
                                            <label className="font-bold text-slate-700">Assigned Field Staff</label>
                                            <div className="admin-staff-picker">
                                                {fieldStaff.length === 0 ? (
                                                    <p>No approved field staff found yet.</p>
                                                ) : fieldStaff.map(member => {
                                                    const assignedIds = bookingForm.assignedStaffIds || [];
                                                    const checked = assignedIds.includes(member.uid);
                                                    return (
                                                        <label key={member.uid} className={checked ? "active" : ""}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
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
                                                            <small>{getRoleLabel(member.role)} · {member.branchName || "Ottawa"}</small>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Dispatch Status</label>
                                            <select value={bookingForm.status} onChange={e => setBookingForm(prev => ({ ...prev, status: e.target.value }))} required className="border border-slate-200 rounded-lg p-2">
                                                <option value="Pending">Pending</option>
                                                <option value="Confirmed">Confirmed</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        </div>
                                        <div className="form-group flex flex-col gap-1">
                                            <label className="font-bold text-slate-700">Override Total Price ($)</label>
                                            <input type="number" step="0.01" value={bookingForm.price} onChange={e => setBookingForm(prev => ({ ...prev, price: parseFloat(e.target.value) }))} required className="border border-slate-200 rounded-lg p-2" />
                                        </div>
                                    </div>

                                    <div className="form-group flex flex-col gap-1">
                                        <label className="font-bold text-slate-700">Special Instructions / Dispatch Notes</label>
                                        <textarea rows={2} value={bookingForm.specialNotes} onChange={e => setBookingForm(prev => ({ ...prev, specialNotes: e.target.value }))} className="border border-slate-200 rounded-lg p-2 resize-none" />
                                    </div>

                                </div>
                                <div className="modal-footer flex justify-end gap-3 p-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setBookingModalOpen(false)} className="btn btn-secondary btn-sm rounded-lg font-bold">
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary btn-sm rounded-lg text-white font-bold">
                                        Save Changes
                                    </button>
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
