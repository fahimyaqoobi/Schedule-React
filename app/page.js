"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from "firebase/auth";
import { auth } from "../lib/firebase";

// Font Awesome / Lucide style icons rendered via secure standalone inline SVGs for 100% crash-proof safety
const Icons = {
    Dashboard: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>,
    Bookings: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    Calendar: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
    Teams: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    EditReview: () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>,
    Logout: () => <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
    Search: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
    Plus: () => <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
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

const DEFAULT_PRICES = {
    services: {
        'Studio or 1 Bedroom': 87.50,
        '2 bedroom apartment': 101.50,
        '3 bedroom apartment or townhouse': 115.50,
        '3 or 4 bedroom house (or between 1700 to 1999 sqft)': 143.50,
        'between 2000 to 2499 sq ft': 150.50,
        'between 2500 to 2999 sq ft': 175.00,
        'between 3000 to 3499 sq ft': 208.60,
        'between 3500 to 3999 sq ft': 243.60
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

const DEFAULT_SERVICE_DURATIONS = {
    'Studio or 1 Bedroom': 2,
    '2 bedroom apartment': 2.5,
    '3 bedroom apartment or townhouse': 3,
    '3 or 4 bedroom house (or between 1700 to 1999 sqft)': 3.5,
    'between 2000 to 2499 sq ft': 4,
    'between 2500 to 2999 sq ft': 4.5,
    'between 3000 to 3499 sq ft': 5,
    'between 3500 to 3999 sq ft': 5.5
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

    // Auth Forms state
    const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [signupTeam, setSignupTeam] = useState("");

    // Address Autocomplete (Restricted to Ontario, Canada)
    const [addressQuery, setAddressQuery] = useState("");
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const autocompleteRef = useRef(null);

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

    // Pricing rates manager and wizard step counter states
    const [pricingRates, setPricingRates] = useState(DEFAULT_PRICES);
    const [formStep, setFormStep] = useState(1);
    const [submitCooldown, setSubmitCooldown] = useState(false);

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
        status: "Pending",
        serviceDescription: "",
        accessDescription: ""
    });

    // Details and Editing modals
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [bookingModalOpen, setBookingModalOpen] = useState(false);
    const [bookingModalMode, setBookingModalMode] = useState("create"); // "create" | "edit"

    // Admin team crew creation modal
    const [teamModalOpen, setTeamModalOpen] = useState(false);
    const [teamForm, setTeamForm] = useState({ id: "", name: "", color: "sparkle", lead: "", size: 2, members: "", description: "" });

    // Profile and Security settings states
    const [profileName, setProfileName] = useState("");
    const [profileLoading, setProfileLoading] = useState(false);
    const [securityForm, setSecurityForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [securityLoading, setSecurityLoading] = useState(false);

    useEffect(() => {
        if (currentUser) {
            setProfileName(currentUser.name || "");
        }
    }, [currentUser]);

    // Live pricing rates loader from Serverless API settings/pricing
    useEffect(() => {
        const loadPricingRates = async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch("/api/settings", { headers });
                if (res.ok) {
                    const data = await res.json();
                    if (data && Object.keys(data).length > 0) {
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
                            
                            return {
                                services: mergedServices,
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
    }, [currentUser]);


    // Auto-select first available team when booking modal is open and no team is selected yet
    useEffect(() => {
        if (bookingModalOpen && !bookingForm.team && teams.length > 0) {
            setBookingForm(prev => ({
                ...prev,
                team: currentUser && currentUser.role === "team-leader" ? currentUser.teamId : teams[0].name
            }));
        }
    }, [bookingModalOpen, teams, currentUser, bookingForm.team]);

    // Cooldown timer to prevent premature dispatch submission due to ghost-clicks / double-taps on iPad/mobile
    useEffect(() => {
        if (formStep === 8) {
            setSubmitCooldown(true);
            const timer = setTimeout(() => {
                setSubmitCooldown(false);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [formStep]);

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


    // ----------------------------------------------------
    // Shared Secure JWT Authorization Request Fetcher
    // ----------------------------------------------------
    const getAuthHeaders = async () => {
        if (!auth.currentUser) return {};
        const token = await auth.currentUser.getIdToken();
        return {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
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
    // Real-Time Auth Observer & Database Syncing
    // ----------------------------------------------------
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    // Try to fetch custom profile from firestore users collection
                    // Wait briefly in case it's a registration setting up in the background
                    let retries = 0;
                    let profile = null;

                    const fetchProfile = async () => {
                        const token = await firebaseUser.getIdToken();
                        const res = await fetch(`/api/bookings`, { headers: { "Authorization": `Bearer ${token}` } });
                        if (res.status === 401 || res.status === 403) {
                            // User is not approved or document not found yet
                            return null;
                        }
                        // To get user profile, fetch standard users collection or parse idToken decodes
                        // Let's call /api/bookings to see if authenticated session verifies.
                        // We will decode user parameters by reading firestore document directly inside the api
                        return firebaseUser;
                    };

                    // Load user profile parameters securely. We can query firestore users collection directly using API.
                    const token = await firebaseUser.getIdToken();
                    // Let's decode or read profile by hitting /api/bookings which verifies auth
                    const profileRes = await fetch("/api/bookings", { headers: { "Authorization": `Bearer ${token}` } });

                    if (profileRes.ok) {
                        // The user document should exist. Let's load user profile via API or fallback.
                        // We can load profile document details by querying Firestore users collection
                        // Wait, we need the exact role and teamId for front-end rendering!
                        // Let's write a simple secure API to return the current user's profile!
                        // Wait! Instead of building a new API route, we can fetch from firestore users directly inside client-side JS?
                        // No, we want to completely remove client-side direct reads!
                        // Wait, we can decode the client ID token or we can write a simple endpoint /api/auth/profile that returns user profile!
                        // Actually, we can fetch from users collection securely. Wait!
                        // Let's build a secure profile fetch inside /api/bookings or /api/auth/profile.
                        // Wait, we can modify `/api/bookings` or add `/api/auth/profile` in next step, or fetch profile securely.
                        // Wait! A simpler, elegant way is to retrieve it in client-side using firebase.firestore() client-side?
                        // No, the client-side SDK can still do reads if Rules allow it! But we want it 100% decoupled.
                        // Let's write a fast endpoint `/api/auth/profile`! No, let's just make `/api/bookings` return user payload if query param has profile, or create `/api/auth/profile/route.js`.
                        // Let's write it in client side directly since the client is authenticated, reads are perfectly fine!
                        // Wait! Yes! Read of a single user's own profile document `users/{uid}` is perfectly secure and standard in Firebase!
                        // So the client can safely read `users/{uid}` directly from Firestore on the frontend, because the user can only read their own document!
                        // Let's fetch it via client Firestore!
                    }
                } catch (e) {
                    console.error("Auth Load Error", e);
                }
            } else {
                setCurrentUser(null);
                setBookings([]);
                setEditRequests([]);
                setPendingUsers([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // ----------------------------------------------------
    // User Profile Poller & Sync Hook
    // ----------------------------------------------------
    const syncDatabaseData = async (user) => {
        try {
            const headers = await getAuthHeaders();

            // 1. Fetch scoped bookings
            const bookingsRes = await fetch("/api/bookings", { headers });
            if (bookingsRes.ok) {
                const data = await bookingsRes.json();
                setBookings(data);
            }

            // 2. Fetch crews/teams
            const teamsRes = await fetch("/api/teams", { headers });
            if (teamsRes.ok) {
                const data = await teamsRes.json();
                setTeams(data);
                if (data.length > 0 && !signupTeam) {
                    setSignupTeam(data[0].name);
                }
            }

            // 3. Fetch edit requests scoped by role
            const editsRes = await fetch("/api/edit-requests", { headers });
            if (editsRes.ok) {
                const data = await editsRes.json();
                setEditRequests(data);
            }

            // 4. Fetch pending user accounts & registered approved team leaders (Admin Only)
            if (user.role === "admin") {
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
    };

    // Keep data fresh by syncing when user changes or tab switches
    useEffect(() => {
        if (currentUser && currentUser.status === "approved") {
            syncDatabaseData(currentUser);
        }
    }, [currentUser, activeTab]);

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
                        if (userData.status === "approved") {
                            syncDatabaseData(userData);
                        }
                    } else {
                        // Safe fallback for console-registered cleaners or admins
                        const fallbackAdmin = {
                            uid: firebaseUser.uid,
                            name: firebaseUser.displayName || firebaseUser.email.split("@")[0],
                            email: firebaseUser.email,
                            role: "admin",
                            teamId: "",
                            status: "approved"
                        };
                        setCurrentUser(fallbackAdmin);
                        syncDatabaseData(fallbackAdmin);
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
    }, []);


    // ----------------------------------------------------
    // Client Side Authentication Actions
    // ----------------------------------------------------
    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) return alert("Please fill in email and password fields.");
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            console.error(err);
            let msg = err.message;
            if (err.code === "auth/configuration-not-found") {
                msg = "Email/Password provider is disabled in Firebase! Go to Build -> Authentication -> Sign-in Method, enable Email/Password, and save.";
            }
            alert(`Login Failed: ${msg}`);
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (!name || !email || !password) return alert("Please fill out all signup fields.");
        if (password.length < 6) return alert("Password must be at least 6 characters.");
        setLoading(true);

        try {
            const { createUserWithEmailAndPassword } = await import("firebase/auth");
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await updateProfile(user, { displayName: name });

            // Write securely via Vercel serverless API! Completely hides write payload permissions
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: user.uid, name, email, teamId: signupTeam })
            });

            if (res.ok) {
                const regData = await res.json();
                alert(`Account Registered Successfully!\n\nYour operational cleaner profile is ${regData.user.status === "approved" ? "approved Admin" : "Pending Admin Approval"}.`);

                if (regData.user.status === "approved") {
                    setCurrentUser(regData.user);
                    syncDatabaseData(regData.user);
                } else {
                    await signOut(auth);
                    setEmail("");
                    setPassword("");
                    setName("");
                    setAuthMode("login");
                }
            } else {
                const errData = await res.json();
                throw new Error(errData.error || "Firestore write failed");
            }
        } catch (err) {
            console.error("Signup failed", err);
            alert(`Registration Failed: ${err.message}`);
        }
        setLoading(false);
    };

    const handleSignout = async () => {
        setLoading(true);
        await signOut(auth);
        setActiveTab("dashboard");
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
    const validateFormStep = (step) => {
        if (step === 1) {
            if (!bookingForm.firstName.trim()) { alert("First Name is required."); return false; }
            if (!bookingForm.lastName.trim()) { alert("Last Name is required."); return false; }
            if (!bookingForm.email.trim()) { alert("Email Address is required."); return false; }
            if (!bookingForm.email.includes("@")) { alert("Please enter a valid email address."); return false; }
            if (!bookingForm.phone.trim()) { alert("Phone Number is required."); return false; }
        }
        if (step === 2) {
            if (!bookingForm.address1.trim()) { alert("Street address is required."); return false; }
            if (!bookingForm.city.trim()) { alert("City is required."); return false; }
            if (!bookingForm.postalCode.trim()) { alert("Postal Code is required."); return false; }
        }
        if (step === 5) {
            if (!bookingForm.date) { alert("Please select a schedule date."); return false; }
            if (!bookingForm.time) { alert("Please select an arrival time slot."); return false; }
            const finalTeam = currentUser?.role === "team-leader" ? currentUser.teamId : bookingForm.team;
            if (!finalTeam) { alert("Please select a dispatch crew."); return false; }
            if (bookingForm.team !== finalTeam) {
                setBookingForm(prev => ({ ...prev, team: finalTeam }));
            }
        }
        return true;
    };

    const handleNextStep = () => {
        if (validateFormStep(formStep)) {
            setFormStep(prev => prev + 1);
        }
    };

    const handleBackStep = () => {
        setFormStep(prev => prev - 1);
    };

    const openCreateBookingModal = () => {
        setBookingModalMode("create");
        setFormStep(1);
        setBookingForm({
            id: "",
            firstName: "",
            lastName: "",
            phone: "",
            email: "",
            address1: "",
            address2: "",
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
            date: selectedCalDate,
            time: "09:00 AM",
            team: currentUser ? (currentUser.role === "team-leader" ? currentUser.teamId : (teams[0]?.name || "")) : (teams[0]?.name || ""),
            status: "Pending",
            serviceDescription: "",
            accessDescription: ""
        });
        setAddressQuery("");
        setBookingModalOpen(true);
    };

    const openEditBookingModal = (b) => {
        setBookingModalMode("edit");
        setFormStep(1);
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
            team: b.team,
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

        // Prevent premature submission prior to step 8
        if (formStep < 8) {
            handleNextStep();
            return;
        }

        // Validate collision
        const durationNum = parseFloat(bookingForm.duration || 2);
        const isOverlap = checkScheduleCollisions(
            bookingForm.date,
            bookingForm.time,
            durationNum,
            bookingForm.team,
            bookingModalMode === "edit" ? bookingForm.id : null
        );

        if (isOverlap) {
            alert(`Schedule Collision Warning!\n\n${bookingForm.team} is already booked during this time window (${formatTimeWindow(bookingForm.time, durationNum)}). Please select another time slot, date, or team crew.`);
            return;
        }

        try {
            const calculated = calculateBookingTotal(bookingForm);
            const priceNum = parseFloat(calculated.total || 0);

            const headers = await getAuthHeaders();
            const payload = {
                ...bookingForm,
                clientName: `${bookingForm.firstName} ${bookingForm.lastName}`.trim(),
                price: priceNum,
                duration: durationNum
            };

            const method = bookingModalMode === "create" ? "POST" : "PUT";
            const res = await fetch("/api/bookings", {
                method,
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

            return matchSearch && matchService && matchTeam && matchStatus;
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
    }, [bookings, searchVal, filterService, filterTeam, filterStatus, sortVal]);

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

    const serviceCounts = useMemo(() => {
        const counts = {};
        Object.keys(pricingRates.services).forEach(key => {
            counts[key] = 0;
        });
        let validJobs = 0;

        bookings.forEach(b => {
            if (b.status !== "Cancelled") {
                const s = b.service;
                if (counts[s] !== undefined) {
                    counts[s]++;
                } else {
                    const firstKey = Object.keys(pricingRates.services)[0];
                    if (firstKey) counts[firstKey] = (counts[firstKey] || 0) + 1;
                }
                validJobs++;
            }
        });

        return { counts, total: validJobs };
    }, [bookings, pricingRates]);

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
                        <img src="/logo.png" alt="SmartTouch Clean" className="auth-card-logo-mobile" />

                        {authMode === "login" ? (
                            <>
                                <h2 className="auth-card-heading">Welcome back 👋</h2>
                                <p className="auth-card-sub">Sign in to access the SmartTouch Clean scheduling portal.</p>
                                <form onSubmit={handleLogin}>
                                    <div className="auth-field">
                                        <label>Email Address</label>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="cleaner@smartouchclean.com" />
                                    </div>
                                    <div className="auth-field">
                                        <label>Password</label>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                                    </div>
                                    <button type="submit" className="auth-submit-btn">Sign In to Dashboard</button>
                                </form>
                                <p className="auth-switch-text">
                                    New crew member? <span onClick={() => setAuthMode("signup")} className="auth-switch-link">Create an account</span>
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="auth-card-heading">Join the crew ✦</h2>
                                <p className="auth-card-sub">Register your account — an admin will activate it once reviewed.</p>
                                <form onSubmit={handleSignup}>
                                    <div className="auth-field">
                                        <label>Full Name</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Jenkins" />
                                    </div>
                                    <div className="auth-field">
                                        <label>Email Address</label>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="cleaner@smartouchclean.com" />
                                    </div>
                                    <div className="auth-field">
                                        <label>Password</label>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min 6 characters" />
                                    </div>
                                    <div className="auth-field">
                                        <label>Assigned Crew / Team</label>
                                        <select value={signupTeam} onChange={e => setSignupTeam(e.target.value)}>
                                            {teams.length === 0 ? <option value="">No Crews Available Yet</option> : teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <button type="submit" className="auth-submit-btn">Create Account</button>
                                </form>
                                <p className="auth-switch-text">
                                    Already registered? <span onClick={() => setAuthMode("login")} className="auth-switch-link">Sign In</span>
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
    if (currentUser.status === "pending_approval") {
        return (
            <div className="auth-fullscreen" style={{ alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #0a3d7a 0%, #0268b3 50%, #1a8a40 100%)" }}>
                <div className="auth-pending-card animate-pop">
                    <img src="/logo.png" alt="SmartTouch Clean" style={{ width: "110px", margin: "0 auto 24px", display: "block" }} />
                    <div style={{ background: "#fef3c7", color: "#b45309", width: "64px", height: "64px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", border: "1px solid #fde68a" }}>
                        {Icons.Alert()}
                    </div>
                    <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", marginBottom: "12px" }}>Awaiting Activation</h2>
                    <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.7, marginBottom: "8px" }}>
                        Welcome to <strong>SmartTouch Clean</strong>! Your account has been registered and is <strong>Pending Admin Approval</strong>.
                    </p>
                    <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.6, marginBottom: "28px" }}>
                        Please contact management or wait for an administrator to review and activate your crew role.
                    </p>
                    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "24px" }}>
                        <button type="button" onClick={handleSignout} className="btn btn-secondary" style={{ width: "100%", justifyContent: "center", gap: "8px" }}>
                            {Icons.Logout()}
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ----------------------------------------------------
    // Authorized approved Application dashboard
    // ----------------------------------------------------
    return (
        <div className="app-container">
            {/* Sidebar Navigation */}
            <aside className="sidebar">
                <div className="brand-logo">
                    <img src="/logo.png" alt="SmartTouch Clean" style={{ height: "44px", width: "auto", objectFit: "contain" }} />
                </div>

                <nav className="nav-links">
                    <button onClick={() => setActiveTab("dashboard")} className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}>
                        {Icons.Dashboard()}
                        <span>Dashboard</span>
                    </button>
                    <button onClick={() => setActiveTab("bookings")} className={`nav-item ${activeTab === "bookings" ? "active" : ""}`}>
                        {Icons.Bookings()}
                        <span>Bookings</span>
                    </button>
                    <button onClick={() => setActiveTab("calendar")} className={`nav-item ${activeTab === "calendar" ? "active" : ""}`}>
                        {Icons.Calendar()}
                        <span>Calendar</span>
                    </button>
                    {currentUser.role === "admin" && (
                        <button onClick={() => setActiveTab("teams")} className={`nav-item ${activeTab === "teams" ? "active" : ""}`}>
                            {Icons.Teams()}
                            <span>Teams</span>
                        </button>
                    )}
                    {currentUser.role === "admin" && (
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
                    <button onClick={() => setActiveTab("settings")} className={`nav-item ${activeTab === "settings" ? "active" : ""}`}>
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        <span>Settings</span>
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <div className="user-profile flex justify-between items-center w-full">
                        <div className="flex items-center gap-2.5">
                            <div className="user-avatar text-white font-bold">{currentUser.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}</div>
                            <div className="user-details flex flex-col">
                                <span className="user-name text-slate-800 text-xs font-bold leading-tight">{currentUser.name}</span>
                                <span className="user-role text-[10px] text-slate-400 mt-0.5">{currentUser.role === "admin" ? "Administrator" : `Leader (${currentUser.teamId})`}</span>
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
                                        activeTab === "teams" ? "Cleaning Crew Dispatch" : "Modification Requests Inbox"}
                        </h2>
                    </div>
                    <div className="header-right">
                        <div className="datetime-indicator text-xs font-bold text-slate-500 bg-white p-2.5 rounded-full border border-slate-200">{clockString}</div>
                        <button onClick={openCreateBookingModal} className="btn btn-primary shadow-lg font-bold flex items-center gap-2">
                            {Icons.Plus()}
                            <span>New Booking</span>
                        </button>
                    </div>
                </header>

                {/* TAB 1: DASHBOARD VIEW */}
                {activeTab === "dashboard" && (
                    <div className="animate-fade">
                        <div className="stats-grid">
                            <div className="stat-card glow-cyan">
                                <div className="stat-icon-wrapper cyan-bg">$</div>
                                <div className="stat-data">
                                    <h3>${dashboardMetrics.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
                                    <span>Total Booked Revenue</span>
                                </div>
                            </div>
                            <div className="stat-card glow-purple">
                                <div className="stat-icon-wrapper purple-bg">#</div>
                                <div className="stat-data">
                                    <h3>{dashboardMetrics.total}</h3>
                                    <span>Total Bookings</span>
                                </div>
                            </div>
                            <div className="stat-card glow-blue">
                                <div className="stat-icon-wrapper blue-bg">⏳</div>
                                <div className="stat-data">
                                    <h3>{dashboardMetrics.pending}</h3>
                                    <span>Pending Bookings</span>
                                </div>
                            </div>
                            <div className="stat-card glow-green">
                                <div className="stat-icon-wrapper green-bg">✓</div>
                                <div className="stat-data">
                                    <h3>{dashboardMetrics.completed}</h3>
                                    <span>Completed Cleanings</span>
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-panels">
                            {/* Today's Jobs agenda panel */}
                            <div className="panel-card">
                                <div className="panel-header">
                                    <div>
                                        <h4>Today's Operational Dispatches</h4>
                                        <span className="subtext text-xs text-slate-400">Toronto Reference Date: {new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                    <span className="badge">{todayBookings.length} Job{todayBookings.length === 1 ? '' : 's'}</span>
                                </div>
                                <div className="panel-body">
                                    {todayBookings.length === 0 ? (
                                        <div className="text-center p-8 text-slate-400 text-xs">No dispatches scheduled for today.</div>
                                    ) : (
                                        <div className="today-list">
                                            {todayBookings.map(b => (
                                                <div key={b.id} className="today-item">
                                                    <div className="today-left">
                                                        <div className="today-time-badge">{b.time}</div>
                                                        <div className="today-info">
                                                            <h5>{b.clientName}</h5>
                                                            <p>
                                                                {Icons.MapPin()}
                                                                <span>{formatAddress(b)}</span>
                                                            </p>
                                                            <div className="text-[10px] text-slate-400 mt-1">Duration: <strong>{b.duration} hrs</strong> ({formatTimeWindow(b.time, b.duration)})</div>
                                                        </div>
                                                    </div>
                                                    <div className="today-right">
                                                        <div className="team-pill">
                                                            <span className={`dot dot-${teams.find(t => t.name === b.team)?.color || "sparkle"}`}></span>
                                                            <span>{b.team}</span>
                                                        </div>
                                                        <span className={`status-badge status-${b.status.toLowerCase()}`}>{b.status}</span>
                                                        <div className="actions-cell">
                                                            <button onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }} className="action-btn btn-view" title="View">{Icons.Eye()}</button>
                                                            <button onClick={() => openEditBookingModal(b)} className="action-btn btn-edit" title="Edit">{Icons.Edit()}</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Service Breakdown progress bar panels */}
                            <div className="panel-card">
                                <div className="panel-header">
                                    <h4>Service Breakdown</h4>
                                </div>
                                <div className="panel-body">
                                    <div className="analytics-bars">
                                        {Object.keys(pricingRates.services).map(serv => {
                                            const count = serviceCounts.counts[serv] || 0;
                                            const percentage = serviceCounts.total > 0 ? Math.round((count / serviceCounts.total) * 100) : 0;
                                            const fillClass = serv.toLowerCase().includes("studio") || serv.toLowerCase().includes("1 bedroom") ? "fill-standard" :
                                                serv.toLowerCase().includes("2 bedroom") ? "fill-deep" :
                                                serv.toLowerCase().includes("3 bedroom") || serv.toLowerCase().includes("townhouse") ? "fill-move" :
                                                serv.toLowerCase().includes("4 bedroom") || serv.toLowerCase().includes("1700") ? "fill-window" :
                                                serv.toLowerCase().includes("2000") || serv.toLowerCase().includes("2499") ? "fill-commercial" :
                                                serv.toLowerCase().includes("2500") || serv.toLowerCase().includes("2999") ? "fill-deep" :
                                                serv.toLowerCase().includes("3000") || serv.toLowerCase().includes("3499") ? "fill-move" : "fill-commercial";
                                            return (
                                                <div key={serv} className="bar-item">
                                                    <div className="bar-label-row text-xs">
                                                        <span className="bar-name font-bold text-slate-600">{serv}</span>
                                                        <span className="bar-value text-slate-400">{count} Job{count === 1 ? '' : 's'} ({percentage}%)</span>
                                                    </div>
                                                    <div className="bar-track">
                                                        <div className={`bar-fill ${fillClass}`} style={{ width: `${percentage}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Admin-only pending user approvals table in Dashboard */}
                        {currentUser.role === "admin" && pendingUsers.length > 0 && (
                            <div className="panel-card mt-6">
                                <div className="panel-header">
                                    <h4>Awaiting operational registration approvals</h4>
                                    <span className="badge bg-[#fef3c7] text-[#b45309]">{pendingUsers.length} Pending</span>
                                </div>
                                <div className="panel-body">
                                    <div className="table-container">
                                        <table className="bookings-table">
                                            <thead>
                                                <tr>
                                                    <th>Cleaner Name</th>
                                                    <th>Email Address</th>
                                                    <th>Assigned Team/Crew</th>
                                                    <th className="text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pendingUsers.map(u => (
                                                    <tr key={u.uid}>
                                                        <td className="font-bold text-slate-800">{u.name}</td>
                                                        <td>{u.email}</td>
                                                        <td>{u.teamId || "None"}</td>
                                                        <td className="text-right">
                                                            <div className="flex gap-2 justify-end">
                                                                <button onClick={() => handleResolveUserApproval(u.uid, "approve")} className="btn btn-primary btn-sm bg-[#39a93e] hover:bg-[#2b8a30]">Approve</button>
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
                                <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
                                    <option value="">All Teams</option>
                                    {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
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
                                            <th>Assigned Crew</th>
                                            <th>Status</th>
                                            <th className="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBookings.map(b => {
                                            const teamColor = teams.find(t => t.name === b.team)?.color || "sparkle";
                                            const hasPendingEdit = editRequests.some(r => r.bookingId === b.id && r.status === "Pending");
                                            return (
                                                <tr key={b.id}>
                                                    <td data-label="Client Details">
                                                        <div className="client-name-cell">{b.clientName}</div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5">{b.phone}</div>
                                                        {hasPendingEdit && (
                                                            <div className="inline-block text-[9px] bg-amber-50 border border-amber-200 text-amber-700 font-bold px-1.5 py-0.5 rounded-full mt-1">Pending Admin Review</div>
                                                        )}
                                                    </td>
                                                    <td data-label="Street Address">
                                                        <div className="address-cell text-xs" title={formatAddress(b)}>{formatAddress(b)}</div>
                                                    </td>
                                                    <td data-label="Service Details" className="service-cell">
                                                        <div className="font-bold text-slate-700 text-xs">{b.service}</div>
                                                        <div className="price-text">${parseFloat(b.price || 0).toFixed(2)}</div>
                                                    </td>
                                                    <td data-label="Schedule Window" className="datetime-cell">
                                                        <div className="font-bold text-xs">{b.date}</div>
                                                        <div className="time-text text-[11px]">{formatTimeWindow(b.time, b.duration)}</div>
                                                    </td>
                                                    <td data-label="Assigned Crew">
                                                        <div className="team-pill">
                                                            <span className={`dot dot-${teamColor}`}></span>
                                                            <span>{b.team}</span>
                                                        </div>
                                                    </td>
                                                    <td data-label="Status">
                                                        <span className={`status-badge status-${b.status.toLowerCase()}`}>{b.status}</span>
                                                    </td>
                                                    <td data-label="Actions" className="text-right">
                                                        <div className="actions-cell">
                                                            <button onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }} className="action-btn btn-view" title="Details">{Icons.Eye()}</button>
                                                            <button onClick={() => openEditBookingModal(b)} className="action-btn btn-edit" title="Edit">{Icons.Edit()}</button>
                                                            {currentUser.role === "admin" && (
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
                            <div className="panel-header" style={{ padding: "20px 24px" }}>
                                <div>
                                    <h4 className="text-xs text-slate-400 font-bold uppercase tracking-widest" style={{ fontSize: "10px", letterSpacing: "1px" }}>Day agenda list</h4>
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
                                                    <span style={{ marginLeft: "4px" }}>{b.address1}</span>
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

                {/* TAB 4: TEAMS DISPATCH VIEW */}
                {activeTab === "teams" && (
                    <div className="animate-fade">
                        {currentUser.role === "admin" && (
                            <div className="flex justify-end mb-4">
                                <button onClick={() => { setTeamForm({ id: `team-${Date.now()}`, name: "", color: "sparkle", lead: "", size: 2, members: "", description: "" }); setTeamModalOpen(true); }} className="btn btn-primary font-bold">Add New Crew</button>
                            </div>
                        )}
                        {teams.length === 0 ? (
                            <div className="empty-state p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-md">
                                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-slate-300"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                <h4 className="font-extrabold text-slate-700 text-sm mb-1">No cleaning crews dispatched</h4>
                                <p className="text-xs text-slate-400 max-w-[280px] mx-auto">Dispatch operations are clean. Click Add New Crew above to configure a cleaning squad.</p>
                            </div>
                        ) : (
                            <div className="teams-grid">
                                {teams.map(t => {
                                    const teamJobs = bookings.filter(b => b.team === t.name && b.status !== "Cancelled");
                                    const completedCount = teamJobs.filter(b => b.status === "Completed").length;
                                    const colorClass = ["sparkle", "deluxe", "ecoclean"].includes((t.color || "").toLowerCase()) ? (t.color || "").toLowerCase() : "sparkle";
                                    const bgClass = `team-${colorClass}-bg`;
                                    const initials = t.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "TM";
                                    return (
                                        <div key={t.id} className="team-card">
                                            <div className="team-card-header">
                                                <div className="team-card-title-group">
                                                    <div className={`team-avatar-square ${bgClass}`}>
                                                        {initials}
                                                    </div>
                                                    <div className="team-card-info">
                                                        <h4>{t.name}</h4>
                                                        <span>{t.color.toUpperCase()} Crew</span>
                                                    </div>
                                                </div>
                                                {currentUser.role === "admin" && (
                                                    <div className="team-card-actions">
                                                        <button onClick={() => { setTeamForm(t); setTeamModalOpen(true); }} className="action-btn btn-edit" title="Edit Crew">{Icons.Edit()}</button>
                                                        <button onClick={() => handleDeleteTeam(t.id)} className="action-btn btn-delete" title="Delete Crew">{Icons.Trash()}</button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="team-card-body">
                                                <p className="text-xs text-slate-400 mb-4 italic">"{t.description || "Operational Cleaning Crew"}"</p>

                                                <div className="team-members-container">
                                                    <h5 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", color: "var(--text-primary)" }}>Crew Specifications</h5>
                                                    <div className="flex flex-col gap-2 text-xs text-slate-600">
                                                        <div><strong>Crew Lead:</strong> {t.lead}</div>
                                                        <div><strong>Crew Size:</strong> {t.size || 2} cleaners</div>
                                                        <div><strong>Members:</strong> <span className="italic text-[11px] block mt-0.5 text-slate-500">{t.members}</span></div>
                                                    </div>
                                                </div>

                                                <div className="team-jobs-today-container mt-4 pt-3 border-t border-slate-100">
                                                    <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                                                        <span>Active jobs: <strong>{teamJobs.length}</strong></span>
                                                        <span>Completed: <strong>{completedCount}</strong></span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === "edit-requests" && currentUser.role === "admin" && (
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
                                                <button onClick={() => handleResolveEdit(req.id, "approve")} className="btn btn-primary btn-sm bg-[#39a93e] hover:bg-[#2b8a30]">Approve & Merge</button>
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
                                        <div className="settings-avatar">
                                            {currentUser.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-slate-800 text-base" style={{ fontSize: "16px", color: "var(--text-primary)" }}>{currentUser.name}</h5>
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest" style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>{currentUser.role === "admin" ? "System Administrator" : "Team Leader"}</span>
                                        </div>
                                    </div>
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
                                            style={{ backgroundColor: "#f8fafc", color: "var(--text-muted)", cursor: "not-allowed" }}
                                        />
                                    </div>
                                    {currentUser.role !== "admin" && (
                                        <div className="form-group">
                                            <label>Assigned Cleaning Crew</label>
                                            <input
                                                type="text"
                                                value={currentUser.teamId || "None"}
                                                disabled
                                                style={{ backgroundColor: "#f8fafc", color: "var(--text-muted)", cursor: "not-allowed" }}
                                            />
                                        </div>
                                    )}
                                    <button type="submit" disabled={profileLoading} className="btn btn-primary h-[44px] rounded-lg text-white font-bold transition mt-2">
                                        {profileLoading ? "Updating Profile..." : "Save Profile Details"}
                                    </button>
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
                                    <button type="submit" disabled={securityLoading} className="btn btn-primary h-[44px] rounded-lg text-white font-bold transition mt-2" style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}>
                                        {securityLoading ? "Updating Password..." : "Change Security Password"}
                                    </button>
                                </form>
                            </div>

                            {/* Card 3: Rates & Pricing Manager (Admin-Only) */}
                            {currentUser.role === "admin" && (
                                <div className="settings-card md:col-span-2" style={{ gridColumn: "span 2" }}>
                                    <div className="panel-header border-b border-slate-100 pb-3 flex justify-between items-center">
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Pricing & Rates Manager Settings</h4>
                                            <p className="text-slate-400 text-[10px] mt-0.5">Customize real-time booking rates, bathroom fees, extras, and discounts</p>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const headers = await getAuthHeaders();
                                                    const res = await fetch("/api/settings", {
                                                        method: "POST",
                                                        headers,
                                                        body: JSON.stringify(pricingRates)
                                                    });
                                                    if (!res.ok) {
                                                        const errData = await res.json();
                                                        throw new Error(errData.error || "Failed to update settings");
                                                    }
                                                    alert("Pricing and rates updated successfully in database!");
                                                } catch (err) {
                                                    alert("Failed to save rates: " + err.message);
                                                }
                                            }}
                                            className="btn btn-primary btn-sm rounded-lg text-white font-bold"
                                        >
                                            Save System Rates
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                                        {/* Column 1: Services & Bathrooms */}
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-1 mb-2">Base Home Size Rates ($)</h5>
                                                <div className="max-h-[220px] overflow-y-auto pr-1 flex flex-col gap-2">
                                                    {Object.keys(pricingRates.services).map(key => (
                                                        <div key={key} className="flex items-center justify-between gap-4 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-all border border-slate-100/80">
                                                            <label className="font-semibold text-slate-600 text-[11px] leading-snug">{key}</label>
                                                            <div className="relative flex items-center">
                                                                <span className="absolute left-2.5 text-slate-400 font-extrabold text-[11px]">$</span>
                                                                <input 
                                                                    type="number" 
                                                                    value={pricingRates.services[key]} 
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value || 0);
                                                                        setPricingRates(prev => ({
                                                                            ...prev,
                                                                            services: { ...prev.services, [key]: val }
                                                                        }));
                                                                    }}
                                                                    className="rates-manager-input-price focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-700 transition-all outline-none" 
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-1 mb-2">Bathroom Increments ($)</h5>
                                                <div className="max-h-[160px] overflow-y-auto pr-1 flex flex-col gap-2">
                                                    {Object.keys(pricingRates.bathrooms).map(key => (
                                                        <div key={key} className="flex items-center justify-between gap-4 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-all border border-slate-100/80">
                                                            <label className="font-semibold text-slate-600 text-[11px]">{key}</label>
                                                            <div className="relative flex items-center">
                                                                <span className="absolute left-2.5 text-slate-400 font-extrabold text-[11px]">$</span>
                                                                <input 
                                                                    type="number" 
                                                                    value={pricingRates.bathrooms[key]} 
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value || 0);
                                                                        setPricingRates(prev => ({
                                                                            ...prev,
                                                                            bathrooms: { ...prev.bathrooms, [key]: val }
                                                                        }));
                                                                    }}
                                                                    className="rates-manager-input-price focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-700 transition-all outline-none" 
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 2: Extras & Frequencies */}
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-1 mb-2">Select Extras Upgrade Rates ($)</h5>
                                                <div className="max-h-[220px] overflow-y-auto pr-1 flex flex-col gap-2">
                                                    {Object.entries(pricingRates.extras).map(([key, extra]) => (
                                                        <div key={key} className="flex items-center justify-between gap-4 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-all border border-slate-100/80">
                                                            <label className="font-semibold text-slate-600 text-[11px] leading-snug">{extra.name}</label>
                                                            <div className="relative flex items-center">
                                                                <span className="absolute left-2.5 text-slate-400 font-extrabold text-[11px]">$</span>
                                                                <input 
                                                                    type="number" 
                                                                    value={extra.price} 
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value || 0);
                                                                        setPricingRates(prev => ({
                                                                            ...prev,
                                                                            extras: {
                                                                                ...prev.extras,
                                                                                [key]: { ...prev.extras[key], price: val }
                                                                            }
                                                                        }));
                                                                    }}
                                                                    className="rates-manager-input-price focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-700 transition-all outline-none" 
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-1 mb-2">Frequency Discounts (%)</h5>
                                                <div className="flex flex-col gap-2">
                                                    {Object.entries(pricingRates.frequencies).map(([key, freq]) => (
                                                        <div key={key} className="flex items-center justify-between gap-4 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-all border border-slate-100/80">
                                                            <label className="font-semibold text-slate-600 text-[11px] capitalize">{freq.name}</label>
                                                            <div className="relative flex items-center">
                                                                <input 
                                                                    type="number" 
                                                                    min="0"
                                                                    max="100"
                                                                    value={Math.round(freq.discount * 100)} 
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value || 0) / 100;
                                                                        setPricingRates(prev => ({
                                                                            ...prev,
                                                                            frequencies: {
                                                                                ...prev.frequencies,
                                                                                [key]: { ...prev.frequencies[key], discount: val }
                                                                            }
                                                                        }));
                                                                    }}
                                                                    className="rates-manager-input-percent focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-700 transition-all outline-none" 
                                                                />
                                                                <span className="absolute right-2.5 text-slate-400 font-extrabold text-[11px]">%</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* High Fidelity iOS Fixed Bottom Navigation Bar on Mobile Viewports */}
            <div className="mobile-nav-bar">
                <button onClick={() => setActiveTab("dashboard")} className={`mobile-nav-item ${activeTab === "dashboard" ? "active" : ""}`}>
                    {Icons.Dashboard()}
                    <span>Dashboard</span>
                </button>
                <button onClick={() => setActiveTab("bookings")} className={`mobile-nav-item ${activeTab === "bookings" ? "active" : ""}`}>
                    {Icons.Bookings()}
                    <span>Bookings</span>
                </button>
                <button onClick={() => setActiveTab("calendar")} className={`mobile-nav-item ${activeTab === "calendar" ? "active" : ""}`}>
                    {Icons.Calendar()}
                    <span>Calendar</span>
                </button>
                {currentUser.role === "admin" && (
                    <button onClick={() => setActiveTab("teams")} className={`mobile-nav-item ${activeTab === "teams" ? "active" : ""}`}>
                        {Icons.Teams()}
                        <span>Teams</span>
                    </button>
                )}
                {currentUser.role === "admin" && (
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
                <button onClick={() => setActiveTab("settings")} className={`mobile-nav-item ${activeTab === "settings" ? "active" : ""}`}>
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    <span>Settings</span>
                </button>
            </div>

            {/* MODAL 1: VIEW DETAILS MODAL */}
            {detailsModalOpen && selectedBooking && (() => {
                const b = selectedBooking;
                const statusColors = {
                    Pending:   { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
                    Confirmed: { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
                    Completed: { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
                    Cancelled: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
                };
                const sc = statusColors[b.status] || statusColors.Pending;
                const teamColor = teams.find(t => t.name === b.team)?.color || 'sparkle';
                const extrasEntries = Object.entries(b.extras || {}).filter(([, qty]) => qty);
                const hasExtras = extrasEntries.length > 0;
                const price = parseFloat(b.price || 0);
                const discount = parseFloat(b.customDiscountAmount || 0);
                return (
                    <div className="modal-backdrop show">
                        <div className="modal-content animate-pop" style={{ maxWidth: '640px', width: '95%' }}>
                            {/* Header */}
                            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #0268b3, #16a34a)', borderBottom: 'none', padding: '18px 24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#ffffff' }}>
                                        Dispatch Details
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.75)', fontWeight: '500' }}>
                                        {b.date} · {b.time} · {b.duration}h
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px', background: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}` }}>
                                        {b.status || 'Pending'}
                                    </span>
                                    <button onClick={() => setDetailsModalOpen(false)} className="modal-close-btn" aria-label="Close">
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '70vh', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

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
                                            <span className="detail-value bold" style={{ color: '#0268b3' }}>{b.service}</span>
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
                                            <span className="detail-label">Assigned Crew</span>
                                            <span className="detail-value">
                                                <span className="team-pill" style={{ marginTop: 0 }}>
                                                    <span className={`dot dot-${teamColor}`}></span>
                                                    {b.team || '—'}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Extras */}
                                {hasExtras && (
                                    <div className="detail-card">
                                        <div className="detail-card-title">✨ Selected Extras</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                                            {extrasEntries.map(([key, qty]) => {
                                                const extra = pricingRates.extras[key];
                                                if (!extra) return null;
                                                const qtyVal = typeof qty === 'boolean' ? 1 : qty;
                                                return (
                                                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                        <span style={{ fontSize: '10px', color: '#334155', fontWeight: '600' }}>• {extra.name}{qtyVal > 1 ? ` × ${qtyVal}` : ''}</span>
                                                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a' }}>${(extra.price * qtyVal).toFixed(2)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Pricing */}
                                <div className="detail-card">
                                    <div className="detail-card-title">💰 Pricing</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                        <div className="detail-row">
                                            <span className="detail-label">Total Price (incl. HST)</span>
                                            <span className="detail-value bold" style={{ fontSize: '14px', color: '#0268b3' }}>${price.toFixed(2)}</span>
                                        </div>
                                        {discount > 0 && (
                                            <div className="detail-row">
                                                <span className="detail-label">Special Discount</span>
                                                <span className="detail-value" style={{ color: '#15803d', fontWeight: '800' }}>-${discount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {b.frequency && b.frequency !== 'One-Time' && (() => {
                                            const freqConfig = pricingRates.frequencies[b.frequency];
                                            const pct = freqConfig ? Math.round((freqConfig.discount > 1 ? freqConfig.discount / 100 : freqConfig.discount) * 100) : 0;
                                            return pct > 0 ? (
                                                <div className="detail-row">
                                                    <span className="detail-label">Frequency Discount</span>
                                                    <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '20px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>{b.frequency} — {pct}% off</span>
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
                                                <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{b.specialNotes}</span>
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



            {/* MODAL 2: SCHEDULING FORM MODAL */}
            {bookingModalOpen && (
                <div className="modal-backdrop show">
                    <div className="modal-content animate-pop" style={{ maxWidth: "850px", width: "95%" }}>
                        <div className="modal-header" style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-green))", borderBottom: "none" }}>
                            <h3 className="font-extrabold text-sm uppercase tracking-wider text-white" style={{ margin: 0 }}>
                                {bookingModalMode === "create" ? "Schedule New Dispatch" : "Request Modification Review"}
                            </h3>
                            <button onClick={() => setBookingModalOpen(false)} className="modal-close-btn" aria-label="Close">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                            </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, overflowY: "auto" }}>
                            <div className="modal-body flex flex-col text-xs" style={{ padding: "20px 24px" }}>
                                
                                {/* Stepper Progress Header */}
                                <div className="wizard-stepper select-none">
                                    {/* Connecting Background Progress Bar Track */}
                                    <div className="wizard-progress-track">
                                        {/* Filled progress bar portion */}
                                        <div 
                                            className="wizard-progress-bar" 
                                            style={{ width: `${((formStep - 1) / 7) * 100}%` }}
                                        ></div>
                                    </div>
                                    
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(stepNum => {
                                        const stepLabels = ["Contact", "Address", "Services", "Extras", "Schedule", "Frequency", "Info", "Review"];
                                        const isActive = formStep === stepNum;
                                        const isCompleted = formStep > stepNum;
                                        return (
                                            <div key={stepNum} className="wizard-step-node">
                                                {/* Circle step badge */}
                                                <div 
                                                    className={`wizard-step-circle ${
                                                        isActive ? 'active' : (isCompleted ? 'completed' : '')
                                                    }`}
                                                >
                                                    {isCompleted ? "✓" : stepNum}
                                                </div>
                                                {/* Text Label - visible and responsive */}
                                                <span 
                                                    className={`wizard-step-label ${
                                                        isActive ? 'active' : (isCompleted ? 'completed' : '')
                                                    }`}
                                                >
                                                    {stepLabels[stepNum - 1]}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>



                                {/* Step 1: Contact Information */}
                                {formStep === 1 && (
                                    <div className="flex flex-col gap-4 animate-fade">
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 text-sm">Contact Information</h4>
                                            <p className="text-slate-400 text-[11px]">The information will be used to contact you about your service</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">First Name *</label>
                                                <input type="text" required value={bookingForm.firstName} onChange={e => setBookingForm(prev => ({ ...prev, firstName: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full" placeholder="Jane" />
                                            </div>
                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">Last Name *</label>
                                                <input type="text" required value={bookingForm.lastName} onChange={e => setBookingForm(prev => ({ ...prev, lastName: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full" placeholder="Jenkins" />
                                            </div>
                                            <div className="form-group flex flex-col gap-1 md:col-span-2">
                                                <label className="font-bold text-slate-700">Email Address *</label>
                                                <input type="email" required value={bookingForm.email} onChange={e => setBookingForm(prev => ({ ...prev, email: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full" placeholder="jane@jenkins.com" />
                                            </div>
                                            <div className="form-group flex flex-col gap-1 md:col-span-2">
                                                <label className="font-bold text-slate-700">Phone Number *</label>
                                                <input type="tel" required value={bookingForm.phone} onChange={e => setBookingForm(prev => ({ ...prev, phone: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full" placeholder="555-0199" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Service Address */}
                                {formStep === 2 && (
                                    <div className="flex flex-col gap-4 animate-fade">
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 text-sm">Service Address</h4>
                                            <p className="text-slate-400 text-[11px]">Where would you like us to clean?</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Autocomplete restricted to Ontario, Canada maps */}
                                            <div ref={autocompleteRef} className="form-group flex flex-col gap-1 md:col-span-2 relative">
                                                <label className="font-bold text-slate-700">Street Address *</label>
                                                <div className="search-input-wrapper w-full">
                                                    <input type="text" required value={bookingForm.address1} onChange={handleAddressChange} onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)} className="border border-slate-200 rounded-lg p-2.5 w-full" placeholder="Type street address to search Ontario maps..." />
                                                </div>
                                                {showSuggestions && addressSuggestions.length > 0 && (
                                                    <div className="absolute top-[60px] left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[160px] overflow-y-auto z-[20000] flex flex-col">
                                                        {addressSuggestions.map((place, idx) => (
                                                            <div key={idx} onClick={() => selectSuggestion(place)} className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer text-[11px] text-slate-600 truncate">{place.display_name}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">Apt # / Suite / Unit</label>
                                                <input type="text" value={bookingForm.address2} onChange={e => setBookingForm(prev => ({ ...prev, address2: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full" placeholder="Suite 404" />
                                            </div>
                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">City *</label>
                                                <input type="text" required value={bookingForm.city} onChange={e => setBookingForm(prev => ({ ...prev, city: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full" placeholder="Toronto" />
                                            </div>
                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">Postal Code *</label>
                                                <input type="text" required value={bookingForm.postalCode} onChange={e => setBookingForm(prev => ({ ...prev, postalCode: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full" placeholder="M5B 1S1" />
                                            </div>
                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">State / Province</label>
                                                <input type="text" value={bookingForm.state} onChange={e => setBookingForm(prev => ({ ...prev, state: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full" placeholder="Ontario" />
                                            </div>
                                            <div className="form-group flex flex-col gap-1 md:col-span-2">
                                                <label className="font-bold text-slate-700">Country</label>
                                                <input type="text" value={bookingForm.country} onChange={e => setBookingForm(prev => ({ ...prev, country: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full" placeholder="Canada" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Choose Your Services */}
                                {formStep === 3 && (
                                    <div className="flex flex-col gap-4 animate-fade">
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 text-sm">Choose Your Services</h4>
                                            <p className="text-slate-400 text-[11px]">Tell us about your home</p>
                                        </div>
                                        <div className="flex flex-col gap-4">
                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">Service Size / Type *</label>
                                                <select value={bookingForm.service} onChange={handleServiceChange} className="border border-slate-200 rounded-lg p-2.5 w-full">
                                                    {Object.keys(pricingRates.services).map(s => (
                                                        <option key={s} value={s}>{s} (${pricingRates.services[s].toFixed(2)})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">Bathrooms *</label>
                                                <select value={bookingForm.bathrooms} onChange={e => setBookingForm(prev => ({ ...prev, bathrooms: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full">
                                                    {Object.keys(pricingRates.bathrooms).map(b => (
                                                        <option key={b} value={b}>{b} (+${pricingRates.bathrooms[b].toFixed(2)})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group flex flex-col gap-1 border-t border-slate-100 pt-3">
                                                <label className="font-bold text-slate-700">Job Duration Estimate (Hours) *</label>
                                                <input type="number" step="0.5" required value={bookingForm.duration} onChange={e => setBookingForm(prev => ({ ...prev, duration: parseFloat(e.target.value || 0) }))} className="border border-slate-200 rounded-lg p-2.5 font-bold w-full" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 4: Select Extras Grid */}
                                {formStep === 4 && (
                                    <div className="flex flex-col gap-4 animate-fade">
                                        <div className="text-center">
                                            <h4 className="font-extrabold text-slate-800 text-sm">Select Extras</h4>
                                            <p className="text-slate-400 text-[11px]">Add upgrades to your service</p>
                                        </div>
                                        <div className="extras-grid-container">
                                            {Object.entries(pricingRates.extras).map(([key, extra]) => {
                                                const qty = bookingForm.extras[key] || 0;
                                                const isActive = qty > 0;
                                                const extraIcons = {
                                                    downtownParking: "🅿️",
                                                    firstTimeClean: "🧹",
                                                    moveInOut: "🚚",
                                                    havePets: "🐶",
                                                    insideOven: "🍳",
                                                    insideEmptyFridge: "🧊",
                                                    insideFullFridge: "🥦",
                                                    secondKitchen: "🍳",
                                                    walls: "🧽",
                                                    shedPoolHouse: "🏡",
                                                    insideCabinets: "🚪",
                                                    interiorWindows: "🪟",
                                                    slidingDoorWindow: "🚪",
                                                    garageSweep: "🧹",
                                                    balconySweep: "🌇",
                                                    homeConcierge: "🛎️",
                                                    organization: "📦",
                                                    laundryWashFold: "🧺",
                                                    nextDayBooking: "📅",
                                                    sameDayCancellation: "⚠️"
                                                };

                                                const toggleExtra = () => {
                                                    setBookingForm(prev => {
                                                        const newExtras = { ...prev.extras };
                                                        if (newExtras[key]) {
                                                            delete newExtras[key];
                                                        } else {
                                                            newExtras[key] = extra.qtySelector ? (extra.minQty || 1) : 1;
                                                        }
                                                        return { ...prev, extras: newExtras };
                                                    });
                                                };

                                                const adjustQty = (amount) => {
                                                    setBookingForm(prev => {
                                                        const newExtras = { ...prev.extras };
                                                        const min = extra.minQty || 1;
                                                        const current = newExtras[key] || 0;
                                                        const updated = current + amount;
                                                        if (updated < min) {
                                                            delete newExtras[key];
                                                        } else {
                                                            newExtras[key] = updated;
                                                        }
                                                        return { ...prev, extras: newExtras };
                                                    });
                                                };

                                                return (
                                                    <div 
                                                        key={key} 
                                                        onClick={!extra.qtySelector ? toggleExtra : undefined}
                                                        className={`extra-card ${isActive ? 'active' : ''}`}
                                                    >
                                                        <div className="extra-card-icon">{extraIcons[key] || "✨"}</div>
                                                        <span className="extra-card-name">{extra.name}</span>
                                                        <span className="extra-card-price">${extra.price.toFixed(2)}</span>
                                                        {extra.qtySelector ? (
                                                            <div onClick={e => e.stopPropagation()}>
                                                                {!isActive ? (
                                                                    <button type="button" onClick={toggleExtra} className="extra-card-badge unselected">Add</button>
                                                                ) : (
                                                                    <div className="extra-card-qty-wrapper">
                                                                        <button type="button" onClick={() => adjustQty(-1)} className="extra-card-qty-btn">-</button>
                                                                        <span className="extra-card-qty-val">{qty}X</span>
                                                                        <button type="button" onClick={() => adjustQty(1)} className="extra-card-qty-btn">+</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                {isActive ? (
                                                                    <span className="extra-card-badge selected">Added</span>
                                                                ) : (
                                                                    <span className="extra-card-badge unselected">Select</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Step 5: Schedule Date & Time Availability */}
                                {formStep === 5 && (
                                    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 text-sm" style={{ margin: 0 }}>When would you like us to come?</h4>
                                            <p className="text-slate-400 text-[11px]" style={{ margin: '4px 0 0 0' }}>The day and time that suits you best</p>
                                        </div>
                                        <div className="step5-grid">
                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">Schedule Date *</label>
                                                <input type="date" required value={bookingForm.date} onChange={e => setBookingForm(prev => ({ ...prev, date: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full" />
                                            </div>
                                            
                                            <div className="form-group flex flex-col gap-1">
                                                <label className="font-bold text-slate-700">Assigned Crew / Team *</label>
                                                {currentUser.role === "team-leader" ? (
                                                    <input type="text" disabled value={currentUser.teamId} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-400 w-full" />
                                                ) : (
                                                    <select value={bookingForm.team} onChange={e => setBookingForm(prev => ({ ...prev, team: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 w-full">
                                                        <option value="">-- Choose Crew --</option>
                                                        {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                                    </select>
                                                )}
                                            </div>

                                            <div className="time-slots-wrapper">
                                                <label className="font-bold text-slate-700">Select Available Time Slot *</label>
                                                <div className="time-slots-scroll">
                                                    <div className="time-slot-grid">
                                                        {timeSlots.map(t => {
                                                            // Display: grey out only slots that fall DURING an existing booking's window
                                                            // This prevents early slots being blocked just because the new job is long
                                                            const isBooked = isSlotDuringExistingBooking(
                                                                bookingForm.date,
                                                                t,
                                                                bookingForm.team,
                                                                bookingForm.id
                                                            );
                                                            const isSelected = bookingForm.time === t;

                                                            return (
                                                                <button
                                                                    key={t}
                                                                    type="button"
                                                                    disabled={isBooked}
                                                                    onClick={() => setBookingForm(prev => ({ ...prev, time: t }))}
                                                                    className={`time-slot-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                                                                >
                                                                    {t}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 6: How Often? (Frequency) */}
                                {formStep === 6 && (
                                    <div className="flex flex-col gap-4 animate-fade">
                                        <div className="text-center">
                                            <h4 className="font-extrabold text-slate-800 text-sm">How Often?</h4>
                                            <p className="text-slate-400 text-[11px] max-w-sm mx-auto">It's all about matching you with the perfect cleaner for your home. Scheduling is flexible. Cancel or reschedule anytime.</p>
                                        </div>
                                        <div className="frequency-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                                            {Object.entries(pricingRates.frequencies).map(([key, freq]) => {
                                                const isSelected = bookingForm.frequency === key;
                                                const freqIcons = {
                                                    'One-Time': "🗓️",
                                                    'Weekly': "🌟",
                                                    'Bi-Weekly': "📅",
                                                    'Tri-Weekly': "📆",
                                                    'Monthly': "🗓️"
                                                };

                                                return (
                                                    <div
                                                        key={key}
                                                        onClick={() => setBookingForm(prev => ({ ...prev, frequency: key }))}
                                                        className={`frequency-card ${isSelected ? 'active' : ''}`}
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            border: isSelected ? '2.5px solid #0268b3' : '1.5px solid #cbd5e1',
                                                            borderRadius: '16px',
                                                            padding: '14px 20px',
                                                            backgroundColor: isSelected ? '#f0f7ff' : '#ffffff',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease',
                                                            userSelect: 'none',
                                                            boxSizing: 'border-box',
                                                            boxShadow: isSelected ? '0 0 0 4px rgba(2, 104, 179, 0.1)' : 'none'
                                                        }}
                                                    >
                                                        <div className="frequency-card-left" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '14px' }}>
                                                            {/* Custom Radio Button Circle */}
                                                            <div 
                                                                style={{
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    borderRadius: '50%',
                                                                    border: isSelected ? '2.5px solid #0268b3' : '2px solid #cbd5e1',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    backgroundColor: '#ffffff',
                                                                    transition: 'all 0.2s ease',
                                                                    flexShrink: 0
                                                                }}
                                                            >
                                                                {isSelected && (
                                                                    <div 
                                                                        style={{
                                                                            width: '9px',
                                                                            height: '9px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: '#0268b3'
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                            <span className="frequency-card-icon" style={{ fontSize: '22px' }}>{freqIcons[key] || "📅"}</span>
                                                            <div className="frequency-card-details" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                                                                <span className="frequency-card-title" style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#334155', lineHeight: '1.2' }}>{freq.name}</span>
                                                                <span className="frequency-card-sub" style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>Cancel or reschedule anytime</span>
                                                            </div>
                                                        </div>
                                                        {freq.discount > 0 ? (
                                                            <span className="frequency-card-discount save" style={{ fontSize: '10px', fontWeight: '800', padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase', display: 'inline-block', color: '#166534', backgroundColor: '#dcfce7', border: '1px solid #bbf7d0' }}>Save {(freq.discount * 100).toFixed(0)}%</span>
                                                        ) : (
                                                            <span className="frequency-card-discount standard" style={{ fontSize: '10px', fontWeight: '800', padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase', display: 'inline-block', color: '#64748b', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}>Standard</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Step 7: Additional Information */}
                                {formStep === 7 && (
                                    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 text-sm" style={{ margin: 0 }}>Additional Information</h4>
                                            <p className="text-slate-400 text-[11px]" style={{ margin: '4px 0 0 0' }}>Share with us more details about your home</p>
                                        </div>
                                        <div className="step7-container">
                                            {/* Pets */}
                                            <div className="form-group flex flex-col gap-1.5" style={{ textAlign: 'left' }}>
                                                <label className="font-bold text-slate-700">Do you have any pets?</label>
                                                <div className="step7-btn-row">
                                                    {[true, false].map(val => (
                                                        <button
                                                            key={String(val)}
                                                            type="button"
                                                            onClick={() => setBookingForm(prev => ({ ...prev, hasPets: val }))}
                                                            className={`step7-btn ${bookingForm.hasPets === val ? 'selected' : ''}`}
                                                        >
                                                            {val ? "Yes, I have pets 🐶" : "No pets 🚫"}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Access Mode */}
                                            <div className="form-group flex flex-col gap-1" style={{ textAlign: 'left' }}>
                                                <label className="font-bold text-slate-700">Will you be home, or is there a code for access?</label>
                                                <select value={bookingForm.accessMode} onChange={e => setBookingForm(prev => ({ ...prev, accessMode: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5">
                                                    <option value="Will be home">I will be home to let the cleaners in</option>
                                                    <option value="Access Code">Provide access / lockbox code</option>
                                                    <option value="Concierge">Leave key with concierge / front desk</option>
                                                    <option value="Other">Other access method</option>
                                                </select>
                                            </div>

                                            {/* Access Details details */}
                                            <div className="form-group flex flex-col gap-1" style={{ textAlign: 'left' }}>
                                                <label className="font-bold text-slate-700">Property Access Information, your dog's name, etc</label>
                                                <textarea
                                                    rows={2}
                                                    value={bookingForm.accessDetails}
                                                    onChange={e => setBookingForm(prev => ({ ...prev, accessDetails: e.target.value }))}
                                                    className="border border-slate-200 rounded-lg p-2.5 resize-none text-xs"
                                                    placeholder="Enter gate code, alarm code, dog's name, alarm details, or specific entry instructions..."
                                                />
                                            </div>

                                            {/* Parking */}
                                            <div className="form-group flex flex-col gap-1.5" style={{ textAlign: 'left' }}>
                                                <label className="font-bold text-slate-700">Is there free parking available for the cleaners?</label>
                                                <div className="step7-btn-row">
                                                    {[true, false].map(val => (
                                                        <button
                                                            key={String(val)}
                                                            type="button"
                                                            onClick={() => setBookingForm(prev => ({ ...prev, freeParking: val }))}
                                                            className={`step7-btn ${bookingForm.freeParking === val ? 'selected' : ''}`}
                                                        >
                                                            {val ? "Yes, Free Parking 🚗" : "No, Street/Paid Parking ⚠️"}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* First Pro Clean 30 Days */}
                                            <div className="form-group flex flex-col gap-1.5" style={{ textAlign: 'left' }}>
                                                <label className="font-bold text-slate-700">Is this your first pro clean in 30+ days?</label>
                                                <div className="step7-btn-row">
                                                    {[true, false].map(val => (
                                                        <button
                                                            key={String(val)}
                                                            type="button"
                                                            onClick={() => setBookingForm(prev => ({ ...prev, firstClean30: val }))}
                                                            className={`step7-btn ${bookingForm.firstClean30 === val ? 'selected' : ''}`}
                                                        >
                                                            {val ? "Yes, first time in 30+ days" : "No, cleaned recently"}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Special Instructions */}
                                            <div className="form-group flex flex-col gap-1" style={{ textAlign: 'left' }}>
                                                <label className="font-bold text-slate-700">Anything else we should know?</label>
                                                <textarea
                                                    rows={2}
                                                    value={bookingForm.specialNotes}
                                                    onChange={e => setBookingForm(prev => ({ ...prev, specialNotes: e.target.value }))}
                                                    className="border border-slate-200 rounded-lg p-2.5 resize-none text-xs"
                                                    placeholder="Describe specific cleaning requests, sensitive surfaces, areas to skip, or focus preferences..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 8: Review & Dynamic Receipt summary */}
                                {formStep === 8 && (() => {
                                    const calc = calculateBookingTotal(bookingForm);
                                    
                                    // Generate dynamic Quote Number
                                    const quoteNum = `STC-2026-${bookingForm.id ? bookingForm.id.replace('bk-', '').slice(-3) : Math.floor(Math.random() * 800) + 100}`;
                                    
                                    // Quote Validity Date (30 days from today)
                                    const nextMonth = new Date();
                                    nextMonth.setDate(nextMonth.getDate() + 30);
                                    const validityDate = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

                                    return (
                                        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                                            <div>
                                                <h4 className="font-extrabold text-slate-800 text-sm" style={{ margin: 0 }}>Review & Quote Preview</h4>
                                                <p className="text-slate-400 text-[11px]" style={{ margin: '4px 0 0 0' }}>Verify dispatch information and inspect the customer-facing invoice quote</p>
                                            </div>
                                            
                                            <div className="quote-review-container">
                                                {/* Left Panel: Invoice/Quote Sheet view (matching user design) */}
                                                <div className="quote-sheet">
                                                    {/* Company Header */}
                                                    <div className="quote-header-block">
                                                        <div>
                                                            <div className="quote-brand-title">
                                                                <span>SmarTouch</span>
                                                                <span className="quote-brand-clean">CLEAN</span>
                                                            </div>
                                                            <p className="quote-brand-subtitle">Professional Residential & Commercial Cleaning</p>
                                                            <div className="quote-company-details">
                                                                <p>SmarTouch Clean Inc.</p>
                                                                <p>Phone: (613) 416-5001</p>
                                                                <p>Email: sale@smartouchclean.com</p>
                                                                <p>Web: www.smartouchclean.com</p>
                                                            </div>
                                                        </div>
                                                        <div className="quote-meta-details">
                                                            <h4 className="quote-meta-number">{quoteNum}</h4>
                                                            <p style={{ margin: '2px 0 0 0' }}>Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                                            <p style={{ margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                Status:{' '}
                                                                <span style={{
                                                                    display: 'inline-block',
                                                                    padding: '1px 8px',
                                                                    borderRadius: '20px',
                                                                    fontSize: '8px',
                                                                    fontWeight: '800',
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.4px',
                                                                    background: bookingForm.status === 'Confirmed' ? '#dbeafe' : bookingForm.status === 'Completed' ? '#dcfce7' : bookingForm.status === 'Cancelled' ? '#fee2e2' : '#fef3c7',
                                                                    color: bookingForm.status === 'Confirmed' ? '#1d4ed8' : bookingForm.status === 'Completed' ? '#15803d' : bookingForm.status === 'Cancelled' ? '#b91c1c' : '#b45309',
                                                                }}>
                                                                    {bookingForm.status || 'Pending'}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Bill To */}
                                                    <div className="quote-billto-block">
                                                        <h4 className="quote-section-title">BILL TO</h4>
                                                        <div className="quote-billto-details">
                                                            <p className="quote-billto-name">{bookingForm.firstName} {bookingForm.lastName}</p>
                                                            <p style={{ margin: 0 }}>{bookingForm.address1} {bookingForm.address2 ? `, ${bookingForm.address2}` : ''}</p>
                                                            <p style={{ margin: 0 }}>{bookingForm.city}, {bookingForm.postalCode}</p>
                                                            <p style={{ margin: 0 }}>{bookingForm.email}</p>
                                                            <p style={{ margin: 0 }}>{bookingForm.phone}</p>
                                                        </div>
                                                    </div>

                                                    {/* Services Table */}
                                                    <div>
                                                        <h4 className="quote-section-title">SERVICES</h4>
                                                        <div className="quote-table-wrapper">
                                                            <table className="quote-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th style={{ width: '50%' }}>Service</th>
                                                                        <th style={{ width: '10%', textAlign: 'center' }}>Qty</th>
                                                                        <th style={{ width: '20%', textAlign: 'right' }}>Unit Price</th>
                                                                        <th style={{ width: '20%', textAlign: 'right' }}>Total</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    <tr>
                                                                        <td>
                                                                            <div style={{ fontWeight: '800', color: '#0f172a' }}>{bookingForm.service}</div>
                                                                            <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>{bookingForm.bathrooms}</div>
                                                                            {bookingForm.frequency && bookingForm.frequency !== 'One-Time' && (
                                                                                <div style={{ display: 'inline-block', marginTop: '4px', fontSize: '8px', fontWeight: '800', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                                                    {bookingForm.frequency} · {Math.round(calc.freqDiscountPercent * 100)}% off recurring
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ textAlign: 'center', fontWeight: '700' }}>1</td>
                                                                        <td style={{ textAlign: 'right' }}>${(calc.baseServicePrice + calc.bathroomsPrice).toFixed(2)}</td>
                                                                        <td style={{ textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>${(calc.baseServicePrice + calc.bathroomsPrice).toFixed(2)}</td>
                                                                    </tr>
                                                                    {Object.entries(bookingForm.extras).map(([key, qty]) => {
                                                                        const extra = pricingRates.extras[key];
                                                                        if (!extra || !qty) return null;
                                                                        const qtyVal = typeof qty === 'boolean' ? 1 : qty;
                                                                        return (
                                                                            <tr key={key}>
                                                                                <td style={{ paddingLeft: '16px', color: '#64748b' }}>• {extra.name}</td>
                                                                                <td style={{ textAlign: 'center' }}>{qtyVal}</td>
                                                                                <td style={{ textAlign: 'right' }}>${extra.price.toFixed(2)}</td>
                                                                                <td style={{ textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>${(extra.price * qtyVal).toFixed(2)}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                             </table>
                                                         </div>
                                                     </div>

                                                    {/* Totals Breakdown */}
                                                    <div className="quote-totals-row">
                                                        <div className="quote-totals-box">
                                                            <div className="quote-total-line">
                                                                <span>Subtotal:</span>
                                                                <span className="quote-total-value">${calc.subtotal.toFixed(2)}</span>
                                                            </div>
                                                            {calc.freqDiscountDeduction > 0 && (
                                                                <div className="quote-total-discount">
                                                                    <span>Discount ({bookingForm.frequency} — {Math.round(calc.freqDiscountPercent * 100)}% off):</span>
                                                                    <span style={{ color: '#16a34a', fontWeight: '800' }}>-${calc.freqDiscountDeduction.toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            <div className="quote-total-discount">
                                                                <span>Special Discount ($):</span>
                                                                <div className="quote-discount-input-box">
                                                                    <span>-$</span>
                                                                    <input 
                                                                        type="number" 
                                                                        min="0" 
                                                                        value={bookingForm.customDiscountAmount || ""} 
                                                                        placeholder="0.00"
                                                                        onChange={e => setBookingForm(prev => ({ ...prev, customDiscountAmount: Math.max(0, parseFloat(e.target.value || 0)) }))}
                                                                        className="quote-discount-field"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="quote-total-line">
                                                                <span>HST (13%):</span>
                                                                <span className="quote-total-value">${calc.hst.toFixed(2)}</span>
                                                            </div>
                                                            <div className="quote-total-final">
                                                                <span className="quote-total-final-label">TOTAL:</span>
                                                                <span className="quote-total-final-val">${calc.total.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Quote Validity tag */}
                                                    <div className="quote-validity-banner">
                                                        Quote Valid Until: {validityDate}
                                                    </div>

                                                    {/* Quote Footer Slogan */}
                                                    <div className="quote-footer-block">
                                                        <p style={{ margin: 0 }}><span className="quote-footer-company">SmarTouch Clean Inc.</span> | Professional Cleaning Services</p>
                                                        <p style={{ margin: '2px 0 0 0' }}>Thank you for choosing SmarTouch Clean!</p>
                                                    </div>
                                                </div>

                                                {/* Right Panel: Operations Details & Controls */}
                                                <div className="quote-sidebar">
                                                    {/* Live Custom Discount Modifier */}
                                                    <div className="quote-sidebar-card">
                                                        <h5 className="quote-sidebar-title">Quote Adjustments</h5>
                                                        <div className="quote-op-row">
                                                            <span className="quote-op-label">Special Discount ($):</span>
                                                            <div className="quote-discount-input-box" style={{ width: '100px' }}>
                                                                <span>$</span>
                                                                <input 
                                                                    type="number" 
                                                                    min="0" 
                                                                    value={bookingForm.customDiscountAmount} 
                                                                    onChange={e => setBookingForm(prev => ({ ...prev, customDiscountAmount: Math.max(0, parseFloat(e.target.value || 0)) }))}
                                                                    className="quote-discount-field" 
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Booking Status Selector */}
                                                    <div className="quote-sidebar-card">
                                                        <h5 className="quote-sidebar-title">Booking Status</h5>
                                                        <div className="status-selector-grid">
                                                            {[
                                                                { value: 'Pending',   label: 'Pending',   icon: '🕐', color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
                                                                { value: 'Confirmed', label: 'Confirmed', icon: '✅', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
                                                                { value: 'Completed', label: 'Completed', icon: '🏆', color: '#15803d', bg: '#dcfce7', border: '#86efac' },
                                                                { value: 'Cancelled', label: 'Cancelled', icon: '🚫', color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
                                                            ].map(s => {
                                                                const isActive = (bookingForm.status || 'Pending') === s.value;
                                                                return (
                                                                    <button
                                                                        key={s.value}
                                                                        type="button"
                                                                        onClick={() => setBookingForm(prev => ({ ...prev, status: s.value }))}
                                                                        style={{
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            gap: '3px',
                                                                            padding: '8px 4px',
                                                                            borderRadius: '10px',
                                                                            border: isActive ? `2px solid ${s.border}` : '1.5px solid #e2e8f0',
                                                                            background: isActive ? s.bg : '#f8fafc',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.15s ease',
                                                                            fontSize: '9px',
                                                                            fontWeight: '800',
                                                                            color: isActive ? s.color : '#94a3b8',
                                                                            textTransform: 'uppercase',
                                                                            letterSpacing: '0.3px',
                                                                            boxShadow: isActive ? `0 0 0 3px ${s.border}44` : 'none',
                                                                        }}
                                                                    >
                                                                        <span style={{ fontSize: '16px', lineHeight: 1 }}>{s.icon}</span>
                                                                        {s.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>


                                                    <div className="quote-sidebar-card">
                                                        <h5 className="quote-sidebar-title">Operational Dispatch</h5>
                                                        
                                                        <div className="quote-op-row">
                                                            <span className="quote-op-label">Assigned Team:</span>
                                                            <span className="quote-op-team-badge">{bookingForm.team || "Not Assigned"}</span>
                                                        </div>
                                                        <div className="quote-op-row">
                                                             <span className="quote-op-label">Schedule Date:</span>
                                                             <span className="quote-op-val">{bookingForm.date}</span>
                                                        </div>
                                                        <div className="quote-op-row">
                                                             <span className="quote-op-label">Arrival Time:</span>
                                                             <span className="quote-op-val">{bookingForm.time}</span>
                                                        </div>
                                                        <div className="quote-op-row">
                                                             <span className="quote-op-label">Estimated Work:</span>
                                                             <span className="quote-op-val">{bookingForm.duration} Hours</span>
                                                        </div>
                                                        <div className="quote-op-row">
                                                             <span className="quote-op-label">Pets in Home:</span>
                                                             <span className="quote-op-val">{bookingForm.hasPets ? "Yes 🐶" : "No 🚫"}</span>
                                                        </div>
                                                        <div className="quote-op-row">
                                                             <span className="quote-op-label">Cleaner Parking:</span>
                                                             <span className="quote-op-val">{bookingForm.freeParking ? "Free 🚗" : "Street/Paid ⚠️"}</span>
                                                        </div>

                                                        {bookingForm.accessDetails && (
                                                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '4px', fontSize: '10px', color: '#64748b', textAlign: 'left' }}>
                                                                <span style={{ fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '8px', display: 'block', marginBottom: '2px' }}>Access Instructions</span>
                                                                {bookingForm.accessDetails}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                            </div>
                            
                            {/* Live Price Preview Strip (Steps 3–7) */}
                            {formStep >= 3 && formStep <= 7 && (() => {
                                const liveCalc = calculateBookingTotal(bookingForm);
                                const freqLabel = bookingForm.frequency && bookingForm.frequency !== 'One-Time' ? bookingForm.frequency : null;
                                return (
                                    <div className="wizard-price-preview">
                                        <div className="wizard-price-preview-left">
                                            <span className="wizard-price-preview-label">Est. Total</span>
                                            <span className="wizard-price-preview-total">${liveCalc.total.toFixed(2)}</span>
                                            <span className="wizard-price-preview-tax">incl. HST</span>
                                        </div>
                                        <div className="wizard-price-preview-right">
                                            {freqLabel && liveCalc.freqDiscountDeduction > 0 && (
                                                <span className="wizard-price-preview-discount">
                                                    🏷️ {freqLabel} saves you ${liveCalc.freqDiscountDeduction.toFixed(2)} ({Math.round(liveCalc.freqDiscountPercent * 100)}% off)
                                                </span>
                                            )}
                                            {!freqLabel && (
                                                <span className="wizard-price-preview-hint">Choose a recurring frequency in Step 6 to unlock discounts</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Wizard Footer Buttons Controls */}
                            <div className="modal-footer flex justify-between items-center bg-slate-50 border-t border-slate-100 rounded-b-3xl" style={{ padding: "16px 24px" }}>
                                {formStep > 1 ? (
                                    <button type="button" onClick={handleBackStep} className="btn btn-secondary btn-sm rounded-lg font-bold">
                                        Back
                                    </button>
                                ) : (
                                    <button type="button" onClick={() => setBookingModalOpen(false)} className="btn btn-secondary btn-sm rounded-lg font-bold">
                                        Cancel
                                    </button>
                                )}

                                {formStep < 8 ? (
                                    <button type="button" onClick={handleNextStep} className="btn btn-primary btn-sm rounded-lg text-white font-bold">
                                        Next Step
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        onClick={handleBookingSubmit} 
                                        disabled={submitCooldown}
                                        className={`btn btn-primary btn-sm rounded-lg text-white font-bold transition-all ${submitCooldown ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >

                                        {bookingModalMode === "create" ? "Create Dispatch" : "Request Changes"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: DISPATCH CREW MODAL */}
            {teamModalOpen && currentUser.role === "admin" && (
                <div className="modal-backdrop show">
                    <div className="modal-content animate-pop" style={{ maxWidth: "500px" }}>
                        <div className="modal-header" style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-green))", borderBottom: "none" }}>
                            <h3 className="font-extrabold text-sm uppercase tracking-wider text-white" style={{ margin: 0 }}>Dispatch New Cleaning Crew</h3>
                            <button onClick={() => setTeamModalOpen(false)} className="modal-close-btn" aria-label="Close">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleTeamSubmit} style={{ display: "flex", flexDirection: "column", flexGrow: 1, overflowY: "auto" }}>
                            <div className="modal-body flex flex-col gap-4 text-xs" style={{ padding: "24px" }}>
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
