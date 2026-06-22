// Top-level service cards shown on the booking page
export const SERVICE_CARDS = [
    {
        id: "interior-cleaning",
        name: "House Cleaning",
        subtitle: "Regular recurring clean",
        icon: "🏠",
        bg: "#e0f2fe",
        type: "configurable",
        preselectedAddOns: [],
    },
    {
        id: "deep-clean",
        name: "Deep / First-Time",
        subtitle: "Top-to-bottom detailed clean",
        icon: "✨",
        bg: "#fef9c3",
        type: "configurable",
        preselectedAddOns: ["firstTimeClean"],
    },
    {
        id: "move-in-out",
        name: "Move In / Move Out",
        subtitle: "Perfect for transitions",
        icon: "📦",
        bg: "#fce7f3",
        type: "configurable",
        preselectedAddOns: ["moveInOut"],
    },
    {
        id: "window-cleaning",
        name: "Window Cleaning",
        subtitle: "Interior & exterior windows",
        icon: "🪟",
        bg: "#dcfce7",
        type: "flat",
        firestoreKey: "Window Cleaning",
        fallbackPrice: 150,
    },
    {
        id: "gutter-cleaning",
        name: "Gutter Cleaning",
        subtitle: "Clear debris & downspouts",
        icon: "🌿",
        bg: "#d1fae5",
        type: "flat",
        firestoreKey: "Gutter Cleaning",
        fallbackPrice: 100,
    },
    {
        id: "power-washing",
        name: "Power Washing",
        subtitle: "Driveway, patio & exterior",
        icon: "💦",
        bg: "#dbeafe",
        type: "flat",
        firestoreKey: "Power Washing",
        fallbackPrice: 200,
    },
];

export function getServiceCard(id) {
    return SERVICE_CARDS.find(s => s.id === id) || null;
}

// Maps Firestore pricing keys → clean display labels for the size selector
export const SIZE_MAP = [
    { key: "Studio or 1 Bedroom",                                    label: "Studio / 1 Bedroom",          sub: "Up to 1 bed" },
    { key: "2 bedroom apartment",                                     label: "2 Bedrooms",                  sub: "Apartment / condo" },
    { key: "3 bedroom apartment or townhouse",                        label: "3 Bedroom Apt / Townhouse",   sub: "Townhouse or apt" },
    { key: "3 or 4 bedroom house (or between 1700 to 1999 sqft)",    label: "3–4 Bedroom House",           sub: "~1700–1999 sq ft" },
    { key: "between 2000 to 2499 sq ft",                             label: "2000–2499 sq ft",             sub: "Large home" },
    { key: "between 2500 to 2999 sq ft",                             label: "2500–2999 sq ft",             sub: "Large home" },
    { key: "between 3000 to 3499 sq ft",                             label: "3000–3499 sq ft",             sub: "Very large home" },
    { key: "between 3500 to 3999 sq ft",                             label: "3500–3999 sq ft",             sub: "Estate home" },
];

// Add-on options available for configurable services
export const ADD_ONS = [
    { key: "firstTimeClean",      label: "First-Time / Deep Clean Upgrade", price: 87.50 },
    { key: "moveInOut",           label: "Move In / Move Out Upgrade",      price: 87.50 },
    { key: "havePets",            label: "I Have Pets",                     price: 17.50 },
    { key: "insideOven",          label: "Inside the Oven",                 price: 31.50 },
    { key: "insideEmptyFridge",   label: "Inside an Empty Fridge",          price: 17.50 },
    { key: "walls",               label: "Walls ($14/room)",                price: 14.00 },
    { key: "insideCabinets",      label: "Inside Cabinets (emptied)",       price: 35.00 },
];

export const TIME_SLOTS = [
    { value: "Morning (8am–12pm)",   label: "🌅  Morning",   sub: "8am – 12pm" },
    { value: "Afternoon (12pm–4pm)", label: "☀️  Afternoon", sub: "12pm – 4pm" },
    { value: "Evening (4pm–7pm)",    label: "🌆  Evening",   sub: "4pm – 7pm" },
];

// Reward points redemption rate: 100 points = $1 off
export const POINTS_PER_DOLLAR = 100;
