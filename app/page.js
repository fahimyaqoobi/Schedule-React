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

const SERVICE_PRICES = {
    'Standard Clean': 120.00,
    'Deep Clean': 250.00,
    'Move-in/Move-out': 320.00,
    'Window Cleaning': 90.00,
    'Commercial Clean': 480.00
};

const SERVICE_DURATIONS = {
    'Standard Clean': 2,
    'Deep Clean': 3,
    'Move-in/Move-out': 4,
    'Window Cleaning': 1.5,
    'Commercial Clean': 4
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
    const [selectedCalDate, setSelectedCalDate] = useState("2026-05-28");
    const [currentCalMonth, setCurrentCalMonth] = useState(new Date(2026, 4, 1)); // May 2026

    // Form inputs for scheduling modal
    const [bookingForm, setBookingForm] = useState({
        id: "",
        clientName: "",
        phone: "",
        email: "",
        address1: "",
        address2: "",
        city: "",
        state: "Ontario",
        postalCode: "",
        country: "Canada",
        service: "Standard Clean",
        price: 120.00,
        duration: 2,
        date: "2026-05-28",
        time: "09:00 AM",
        team: teams[0]?.name || "",
        status: "Pending"
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

    // Handle authentication state changes & read client-side user document
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    // Let's read user document directly from serverless API /api/bookings?profile=true or standard fetches
                    const token = await firebaseUser.getIdToken();
                    
                    // We will fetch users collection from API or read client side.
                    // Wait, let's write a small client side fetch using Modular SDK!
                    // In modular SDK:
                    const { doc, getDoc, getFirestore } = await import("firebase/firestore");
                    const clientDb = getFirestore();
                    
                    let userDoc = await getDoc(doc(clientDb, "users", firebaseUser.uid));
                    let retries = 0;
                    
                    // Polling in case of registrations
                    while (!userDoc.exists() && retries < 5) {
                        await new Promise(res => setTimeout(res, 500));
                        userDoc = await getDoc(doc(clientDb, "users", firebaseUser.uid));
                        retries++;
                    }
                    
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setCurrentUser(userData);
                        
                        if (userData.status === "approved") {
                            syncDatabaseData(userData);
                        }
                    } else {
                        // Safe fallback for console-registered cleaners
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
                    console.error("Failed to load user profile", err);
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
        setBookingForm(prev => ({
            ...prev,
            service: serv,
            price: SERVICE_PRICES[serv] || 120.00,
            duration: SERVICE_DURATIONS[serv] || 2
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

    // ----------------------------------------------------
    // Booking Form Submit Actions
    // ----------------------------------------------------
    const openCreateBookingModal = () => {
        setBookingModalMode("create");
        setBookingForm({
            id: "",
            clientName: "",
            phone: "",
            email: "",
            address1: "",
            address2: "",
            city: "",
            state: "Ontario",
            postalCode: "",
            country: "Canada",
            service: "Standard Clean",
            price: 120.00,
            duration: 2,
            date: selectedCalDate,
            time: "09:00 AM",
            team: currentUser ? (currentUser.role === "team-leader" ? currentUser.teamId : (teams[0]?.name || "")) : (teams[0]?.name || ""),
            status: "Pending"
        });
        setAddressQuery("");
        setBookingModalOpen(true);
    };

    const openEditBookingModal = (b) => {
        setBookingModalMode("edit");
        setBookingForm({
            id: b.id,
            clientName: b.clientName,
            phone: b.phone || "",
            email: b.email || "",
            address1: b.address1 || "",
            address2: b.address2 || "",
            city: b.city || "",
            state: b.state || "Ontario",
            postalCode: b.postalCode || "",
            country: b.country || "Canada",
            service: b.service || "Standard Clean",
            price: b.price || 120.00,
            duration: b.duration || 2,
            date: b.date,
            time: b.time,
            team: b.team,
            status: b.status
        });
        setAddressQuery(b.address1 || "");
        setBookingModalOpen(true);
    };

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        
        // Ensure values are numbers
        const priceNum = parseFloat(bookingForm.price || 0);
        const durationNum = parseFloat(bookingForm.duration || 2);
        
        // Validate collision
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
            const headers = await getAuthHeaders();
            const payload = {
                ...bookingForm,
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

            const { doc, updateDoc, getFirestore } = await import("firebase/firestore");
            const clientDb = getFirestore();
            await updateDoc(doc(clientDb, "users", currentUser.uid), { name: profileName });

            setCurrentUser(prev => ({ ...prev, name: profileName }));
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
        const counts = { 'Standard Clean': 0, 'Deep Clean': 0, 'Move-in/Move-out': 0, 'Window Cleaning': 0, 'Commercial Clean': 0 };
        let validJobs = 0;

        bookings.forEach(b => {
            if (b.status !== "Cancelled") {
                const s = b.service;
                if (counts[s] !== undefined) counts[s]++;
                else counts['Standard Clean']++;
                validJobs++;
            }
        });

        return { counts, total: validJobs };
    }, [bookings]);

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
            <div className="auth-fullscreen flex items-center justify-center min-h-screen bg-[#f4f6fa] p-4">
                {authMode === "login" ? (
                    <div className="auth-card w-full max-w-[420px] bg-white border border-slate-200 rounded-2xl shadow-xl p-8 animate-pop">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-extrabold text-[#0268b3]">SmarTouch Clean</h2>
                            <p className="text-xs font-bold tracking-widest text-[#39a93e] uppercase mt-1">Operational Scheduler</p>
                        </div>
                        <form onSubmit={handleLogin} className="flex flex-col gap-4">
                            <div className="form-group flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-700">Email Address</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="cleaner@smartouch.com" className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#0268b3]" />
                            </div>
                            <div className="form-group flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-700">Password</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#0268b3]" />
                            </div>
                            <button type="submit" className="btn btn-primary w-full h-[46px] rounded-lg text-white font-bold transition mt-2">Sign In</button>
                            <p className="text-xs text-center text-slate-500 mt-3">
                                Need an operational account? <span onClick={() => setAuthMode("signup")} className="text-[#0268b3] font-bold cursor-pointer hover:underline">Register Here</span>
                            </p>
                        </form>
                    </div>
                ) : (
                    <div className="auth-card w-full max-w-[440px] bg-white border border-slate-200 rounded-2xl shadow-xl p-8 animate-pop">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-extrabold text-[#0268b3]">Register Account</h2>
                            <p className="text-xs font-bold tracking-widest text-[#39a93e] uppercase mt-1">SmarTouch Crew Portal</p>
                        </div>
                        <form onSubmit={handleSignup} className="flex flex-col gap-4">
                            <div className="form-group flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-700">Full Name</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Fahim Yaqoobi" className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#0268b3]" />
                            </div>
                            <div className="form-group flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-700">Email Address</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="cleaner@smartouchclean.com" className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#0268b3]" />
                            </div>
                            <div className="form-group flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-700">Password</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min 6 characters" className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#0268b3]" />
                            </div>
                            <div className="form-group flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-700">Assigned crew/team</label>
                                <select value={signupTeam} onChange={e => setSignupTeam(e.target.value)} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#0268b3]">
                                    {teams.length === 0 ? <option value="">No Crews Dispatched Yet</option> : teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary w-full h-[46px] rounded-lg text-white font-bold transition mt-2">Register Account</button>
                            <p className="text-xs text-center text-slate-500 mt-3">
                                Already registered? <span onClick={() => setAuthMode("login")} className="text-[#0268b3] font-bold cursor-pointer hover:underline">Sign In</span>
                            </p>
                        </form>
                    </div>
                )}
            </div>
        );
    }

    // ----------------------------------------------------
    // "Awaiting Activation" Pending approval blocked screen
    // ----------------------------------------------------
    if (currentUser.status === "pending_approval") {
        return (
            <div className="auth-fullscreen flex flex-col items-center justify-center min-h-screen bg-[#f4f6fa] p-4">
                <div className="auth-card max-w-[450px] bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center animate-pop">
                    <div className="bg-[#fef3c7] text-[#b45309] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#fde68a]">
                        {Icons.Alert()}
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-800">Awaiting Operational Activation</h2>
                    <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                        Welcome to <strong>SmarTouch Clean</strong>! Your account has been registered successfully and is currently <strong>Pending Admin Approval</strong>.
                    </p>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        Please contact management or wait for an administrator to review and activate your crew role.
                    </p>
                    <div className="border-t border-slate-100 mt-6 pt-6">
                        <button type="button" onClick={handleSignout} className="btn btn-secondary w-full h-[44px] flex items-center justify-center gap-2 rounded-lg font-bold">
                            {Icons.Logout()}
                            <span>Sign Out / Return</span>
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
                    <div className="brand-info">
                        <h1 className="text-base font-extrabold text-[#0268b3] tracking-tight">SmarTouch</h1>
                        <span className="text-[10px] font-bold tracking-widest text-[#39a93e] uppercase mt-0.5 block">CLEAN</span>
                    </div>
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
                                        {Object.keys(SERVICE_PRICES).map(serv => {
                                            const count = serviceCounts.counts[serv] || 0;
                                            const percentage = serviceCounts.total > 0 ? Math.round((count / serviceCounts.total) * 100) : 0;
                                            const fillClass = serv === "Deep Clean" ? "fill-deep" :
                                                              serv === "Move-in/Move-out" ? "fill-move" :
                                                              serv === "Window Cleaning" ? "fill-window" :
                                                              serv === "Commercial Clean" ? "fill-commercial" : "fill-standard";
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
                                    {Object.keys(SERVICE_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
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
                                         const isToday = cell.dateStr === "2026-05-28";
                                         
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
            {detailsModalOpen && selectedBooking && (
                <div className="modal-backdrop show">
                    <div className="modal-content animate-pop detail-modal-content" style={{ maxWidth: "500px" }}>
                        <div className="modal-header" style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-green))", borderBottom: "none" }}>
                            <h3 className="font-extrabold text-sm uppercase tracking-wider text-white" style={{ margin: 0 }}>Scheduled dispatch Details</h3>
                            <button onClick={() => setDetailsModalOpen(false)} className="text-white hover:text-slate-200 text-sm font-bold bg-none border-none cursor-pointer">✕</button>
                        </div>
                        <div className="modal-body flex flex-col gap-3.5 text-xs text-slate-700" style={{ overflowY: "auto", padding: "24px" }}>
                            <div><strong>Client Name:</strong> <span className="text-slate-900 font-bold">{selectedBooking.clientName}</span></div>
                            <div><strong>Phone Number:</strong> {selectedBooking.phone || "Not provided"}</div>
                            <div><strong>Email Address:</strong> {selectedBooking.email || "Not provided"}</div>
                            <div className="border-t border-slate-100 pt-3"><strong>Street Address 1:</strong> {selectedBooking.address1}</div>
                            <div><strong>Apartment / Unit 2:</strong> {selectedBooking.address2 || "None"}</div>
                            <div><strong>City Location:</strong> {selectedBooking.city || "Not provided"} • {selectedBooking.postalCode || "N/A"}</div>
                            <div><strong>State / Country:</strong> {selectedBooking.state} • {selectedBooking.country}</div>
                            <div className="border-t border-slate-100 pt-3"><strong>Service Category:</strong> <span className="font-bold text-[#0268b3]">{selectedBooking.service}</span></div>
                            <div><strong>Duration / Timeframe:</strong> {selectedBooking.duration} hours ({formatTimeWindow(selectedBooking.time, selectedBooking.duration)})</div>
                            <div><strong>Total Price / Cost:</strong> <span className="font-extrabold text-slate-900">${parseFloat(selectedBooking.price || 0).toFixed(2)}</span></div>
                            <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                                <div><strong>Assigned Team:</strong>
                                    <div className="team-pill mt-1">
                                        <span className={`dot dot-${teams.find(t => t.name === selectedBooking.team)?.color || "sparkle"}`}></span>
                                        <span>{selectedBooking.team}</span>
                                    </div>
                                </div>
                                <span className={`status-badge status-${selectedBooking.status.toLowerCase()}`}>{selectedBooking.status}</span>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-100">
                            <button onClick={() => setDetailsModalOpen(false)} className="btn btn-secondary btn-sm">Close</button>
                            <button onClick={() => { setDetailsModalOpen(false); openEditBookingModal(selectedBooking); }} className="btn btn-primary btn-sm">Edit Dispatch</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: SCHEDULING FORM MODAL */}
            {bookingModalOpen && (
                <div className="modal-backdrop show">
                    <div className="modal-content animate-pop" style={{ maxWidth: "650px" }}>
                        <div className="modal-header" style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-green))", borderBottom: "none" }}>
                            <h3 className="font-extrabold text-sm uppercase tracking-wider text-white" style={{ margin: 0 }}>{bookingModalMode === "create" ? "Schedule New dispatch" : "Request Modification review"}</h3>
                            <button onClick={() => setBookingModalOpen(false)} className="text-white hover:text-slate-200 text-sm font-bold bg-none border-none cursor-pointer">✕</button>
                        </div>
                        <form onSubmit={handleBookingSubmit} style={{ display: "flex", flexDirection: "column", flexGrow: 1, overflowY: "auto" }}>
                            <div className="modal-body grid grid-cols-1 md:grid-cols-2 gap-4 text-xs" style={{ padding: "24px" }}>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Client Name *</label>
                                    <input type="text" required value={bookingForm.clientName} onChange={e => setBookingForm(prev => ({ ...prev, clientName: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5" placeholder="Jane Jenkins" />
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Phone Number *</label>
                                    <input type="tel" required value={bookingForm.phone} onChange={e => setBookingForm(prev => ({ ...prev, phone: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5" placeholder="555-0199" />
                                </div>
                                <div className="form-group flex flex-col gap-1 md:col-span-2">
                                    <label className="font-bold text-slate-700">Email Address *</label>
                                    <input type="email" required value={bookingForm.email} onChange={e => setBookingForm(prev => ({ ...prev, email: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5" placeholder="jane@jenkins.com" />
                                </div>
                                
                                {/* Ontario Google/OSM autocomplete input */}
                                <div ref={autocompleteRef} className="form-group flex flex-col gap-1 md:col-span-2 relative">
                                    <label className="font-bold text-slate-700">Client Street Address (Ontario, Canada restricted) *</label>
                                    <div className="search-input-wrapper">
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
                                    <label className="font-bold text-slate-700">Apartment / Unit / Suite</label>
                                    <input type="text" value={bookingForm.address2} onChange={e => setBookingForm(prev => ({ ...prev, address2: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5" placeholder="Suite 404" />
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">City *</label>
                                    <input type="text" required value={bookingForm.city} onChange={e => setBookingForm(prev => ({ ...prev, city: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5" placeholder="Toronto" />
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">State / Province</label>
                                    <input type="text" disabled value={bookingForm.state} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-400" />
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Postal Code *</label>
                                    <input type="text" required value={bookingForm.postalCode} onChange={e => setBookingForm(prev => ({ ...prev, postalCode: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5" placeholder="M5B 1S1" />
                                </div>

                                <div className="form-group flex flex-col gap-1 md:col-span-2 border-t border-slate-100 pt-3">
                                    <label className="font-bold text-slate-700">Service Category *</label>
                                    <select value={bookingForm.service} onChange={handleServiceChange} className="border border-slate-200 rounded-lg p-2.5">
                                        {Object.keys(SERVICE_PRICES).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Estimated Price ($) *</label>
                                    <input type="number" required value={bookingForm.price} onChange={e => setBookingForm(prev => ({ ...prev, price: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 font-bold" />
                                </div>
                                <div className="form-group flex flex-col gap-1">
                                    <label className="font-bold text-slate-700">Job Duration (Hours) *</label>
                                    <input type="number" step="0.5" required value={bookingForm.duration} onChange={e => setBookingForm(prev => ({ ...prev, duration: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5 font-bold" />
                                </div>

                                <div className="form-group flex flex-col gap-1 border-t border-slate-100 pt-3">
                                    <label className="font-bold text-slate-700">Schedule Date *</label>
                                    <input type="date" required value={bookingForm.date} onChange={e => setBookingForm(prev => ({ ...prev, date: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5" />
                                </div>
                                <div className="form-group flex flex-col gap-1 border-t border-slate-100 pt-3">
                                    <label className="font-bold text-slate-700">Arrival Time Slot *</label>
                                    <select value={bookingForm.time} onChange={e => setBookingForm(prev => ({ ...prev, time: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5">
                                        {timeSlots.map(t => {
                                            const isBooked = checkScheduleCollisions(
                                                bookingForm.date,
                                                t,
                                                bookingForm.duration,
                                                bookingForm.team,
                                                bookingForm.id
                                            );
                                            return (
                                                <option key={t} value={t} disabled={isBooked} style={isBooked ? { color: "#94a3b8", textDecoration: "line-through" } : {}}>
                                                    {isBooked ? `${t} (Booked / Collision)` : t}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                <div className="form-group flex flex-col gap-1 md:col-span-2">
                                    <label className="font-bold text-slate-700">Assigned crew / team *</label>
                                    {currentUser.role === "team-leader" ? (
                                        <input type="text" disabled value={currentUser.teamId} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-400" />
                                    ) : (
                                        <select value={bookingForm.team} onChange={e => setBookingForm(prev => ({ ...prev, team: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5">
                                            {teams.length === 0 ? <option value="">No crews available</option> : teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                        </select>
                                    )}
                                </div>

                                {bookingModalMode === "edit" && (currentUser.role === "admin" || currentUser.role === "team-leader") && (
                                    <div className="form-group flex flex-col gap-1 md:col-span-2">
                                        <label className="font-bold text-slate-700">Job Status</label>
                                        <select value={bookingForm.status} onChange={e => setBookingForm(prev => ({ ...prev, status: e.target.value }))} className="border border-slate-200 rounded-lg p-2.5">
                                            <option value="Pending">Pending</option>
                                            <option value="Confirmed">Confirmed</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-100">
                                <button type="button" onClick={() => setBookingModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                                <button type="submit" className="btn btn-primary btn-sm">{bookingModalMode === "create" ? "Create Dispatch" : "Request Changes"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: DISPATCH CREW MODAL */}
            {teamModalOpen && currentUser.role === "admin" && (
                <div className="modal-backdrop show">
                    <div className="modal-content animate-pop" style={{ maxWidth: "500px" }}>
                        <div className="modal-header" style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-green))", borderBottom: "none" }}>
                            <h3 className="font-extrabold text-sm uppercase tracking-wider text-white" style={{ margin: 0 }}>Dispatch New Cleaning Crew</h3>
                            <button onClick={() => setTeamModalOpen(false)} className="text-white hover:text-slate-200 text-sm font-bold bg-none border-none cursor-pointer">✕</button>
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
                            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-100">
                                <button type="button" onClick={() => setTeamModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                                <button type="submit" className="btn btn-primary btn-sm">Dispatch Crew</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
