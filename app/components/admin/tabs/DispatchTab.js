"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MapPin, Navigation, Users, Calendar as CalendarIcon, Moon, Sun, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { getStatusMeta } from "@/lib/bookingStatus";
import { getZonedDateKey, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { timeSortKey } from "@/lib/bookingTime";
import { haversineMeters } from "@/lib/geo";
import { StaffAvatar } from "./calendar/StaffAvatarStack";

// Fallback map center — Ottawa. Every branch this app serves today is
// Ottawa; if a second branch is ever added this should key off the branch
// record instead of a hardcoded constant.
const OTTAWA_CENTER = { lat: 45.4215, lng: -75.6972 };

const STAFF_PIN_COLOR = "#7c3aed";
const STAFF_PIN_LIVE_COLOR = "#16a34a";
const HOME_PIN_OPACITY = 0.55;
// A liveLocation ping older than this is treated as stale (cleaner clocked
// out or lost signal) and the pin falls back to the static first-job/home
// rule below, rather than showing a frozen "last seen" dot indefinitely.
const LIVE_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;

// Local Y/M/D construction (not UTC parsing) — matches the exact pattern
// MonthView.js already uses to move between a "YYYY-MM-DD" booking-date key
// and a plain calendar-grid Date, so a date picked here always lands on the
// same day regardless of the viewer's own timezone offset.
function dateKeyToDate(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function dateToDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function addDays(key, n) {
    const d = dateKeyToDate(key);
    d.setDate(d.getDate() + n);
    return dateToDateKey(d);
}

// No explicit timeZone here on purpose — d is a LOCAL-midnight grid Date
// (see dateKeyToDate above), so formatting it with the browser's own
// ambient zone reproduces the same calendar day the key represents. Passing
// an explicit IANA timeZone (the way formatZonedDate does for real
// timestamps) would re-interpret this local-midnight instant and can shift
// it a day in either direction depending on the viewer's own offset.
function formatDateKeyLabel(key, options) {
    return dateKeyToDate(key).toLocaleDateString("en-US", options);
}

function buildAddressString(personal) {
    if (!personal) return "";
    return [personal.address, personal.city, personal.province, personal.postalCode].filter(Boolean).join(", ");
}

// Whether a cleaner drives themselves or gets there by public transit —
// reuses the existing eligibility.hasVehicle flag (lib/staffProfiles.js)
// rather than adding a new field. Determines both the Directions travel
// mode used for ETA/route and the label shown next to it.
function travelModeFor(member) {
    return member?.staffProfile?.eligibility?.hasVehicle ? "DRIVING" : "TRANSIT";
}

function formatDurationSeconds(seconds) {
    if (seconds == null) return null;
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const DARK_MAP_STORAGE_KEY = "stc_dispatch_dark_map";

// Standard dark-mode Google Maps style — muted slate/charcoal base with
// desaturated feature colors, matching the dark dispatch-map look the user
// pointed to as a reference. Scoped to just this map canvas via
// map.setOptions({styles}) — not a site-wide theme change.
const MAP_DARK_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
    { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
    { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
];

// Dispatch Map — full-screen day view of a branch: today's confirmed jobs
// and field staff, both pinned on one map, with click-to-assign. Staff pin
// position rule (per the "cleaner goes job to job, not home" requirement):
// if they have any job today, pin at that day's EARLIEST job's location;
// otherwise pin at their (lazily geocoded, cached) home address. Live GPS
// while clocked in is a later phase — this is the static-pin baseline.
export default function DispatchTab({
    bookings,
    fieldStaff,
    handleQuickBookingUpdate,
    getAuthHeaders,
    googleMapsReady,
    activeBranch,
    branchTimezone = DEFAULT_TIMEZONE,
}) {
    const isMobile = useIsMobile();
    const todayKey = useMemo(() => getZonedDateKey(new Date(), branchTimezone), [branchTimezone]);
    const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState(null);
    const [selectedStaffUid, setSelectedStaffUid] = useState(null);

    // A job/staff selection belongs to whichever date it was made on — jump
    // to a new date with a clean slate rather than carrying over a
    // "Assigning: ..." banner that no longer refers to anything visible.
    const changeDate = useCallback((nextKey) => {
        setSelectedDateKey(nextKey);
        setSelectedJobId(null);
        setSelectedStaffUid(null);
    }, []);
    // Reads localStorage lazily (useState initializer) so it's correct on
    // first paint rather than flashing light-then-dark; guarded for SSR
    // since this component only ever renders client-side ("use client").
    const [isDarkMap, setIsDarkMap] = useState(() => {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem(DARK_MAP_STORAGE_KEY) === "1";
    });
    const [homeLocations, setHomeLocations] = useState({}); // uid -> {lat,lng}
    const geocodingRef = useRef(new Set());
    // { [staffUid]: { [jobId]: { text, seconds } } } — real travel time per
    // staff→job pair, DRIVING or TRANSIT depending on that cleaner's own
    // eligibility.hasVehicle flag. Covers both the candidate list for a
    // selected job and the inline ETA shown on already-assigned jobs.
    const [etaMatrix, setEtaMatrix] = useState({});

    const mapDivRef = useRef(null);
    const mapObjRef = useRef(null);
    const markersRef = useRef([]);
    const directionsRendererRef = useRef(null);

    const todayJobs = useMemo(() => {
        return (bookings || []).filter(b =>
            b.date === selectedDateKey &&
            b.status !== "Cancelled" &&
            !b.archived &&
            b.location?.lat && b.location?.lng
        );
    }, [bookings, selectedDateKey]);

    const jobsByStaffToday = useMemo(() => {
        const map = {};
        todayJobs.forEach(b => {
            (b.assignedStaffIds || []).forEach(uid => {
                (map[uid] = map[uid] || []).push(b);
            });
        });
        Object.values(map).forEach(list => list.sort((a, c) => timeSortKey(a.time) - timeSortKey(c.time)));
        return map;
    }, [todayJobs]);

    // Lazily geocode any staff member's home address that's missing a cached
    // lat/lng — client-side Geocoder, same pattern app/page.js already uses
    // for booking addresses. Best-effort persist back to their profile so
    // it's a one-time cost; a permission failure there just means it
    // re-geocodes next visit, which is fine.
    useEffect(() => {
        if (!googleMapsReady || !window.google?.maps?.Geocoder) return;
        const geocoder = new window.google.maps.Geocoder();
        (fieldStaff || []).forEach(member => {
            const cached = member.staffProfile?.personal?.homeLocation;
            const addressStr = buildAddressString(member.staffProfile?.personal);
            if (!addressStr) return;
            if (cached?.lat && cached?.lng && cached?.geocodedAddress === addressStr) return;
            if (homeLocations[member.uid] || geocodingRef.current.has(member.uid)) return;
            geocodingRef.current.add(member.uid);
            geocoder.geocode({ address: addressStr }, async (results, status) => {
                if (status === "OK" && results?.[0]?.geometry?.location) {
                    const loc = { lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() };
                    setHomeLocations(prev => ({ ...prev, [member.uid]: loc }));
                    try {
                        const headers = await getAuthHeaders();
                        await fetch("/api/users", {
                            method: "PUT",
                            headers,
                            body: JSON.stringify({
                                updateStaffProfileDirect: true,
                                targetUid: member.uid,
                                staffProfile: {
                                    ...member.staffProfile,
                                    personal: { ...member.staffProfile?.personal, homeLocation: { ...loc, geocodedAddress: addressStr } },
                                },
                            }),
                        });
                    } catch {
                        // Best-effort cache write — a permission failure or
                        // network error here just means we re-geocode next visit.
                    }
                }
            });
        });
    }, [fieldStaff, googleMapsReady, getAuthHeaders, homeLocations]);

    const staffPins = useMemo(() => {
        return (fieldStaff || []).map(member => {
            const jobsToday = jobsByStaffToday[member.uid] || [];
            const live = member.liveLocation;
            const liveIsFresh = live?.lat && live?.lng && live?.updatedAt &&
                (Date.now() - new Date(live.updatedAt).getTime()) < LIVE_LOCATION_MAX_AGE_MS;
            if (liveIsFresh) {
                return { uid: member.uid, member, location: { lat: live.lat, lng: live.lng }, source: "live", jobsToday };
            }
            if (jobsToday.length > 0 && jobsToday[0].location) {
                return { uid: member.uid, member, location: jobsToday[0].location, source: "first-job", jobsToday };
            }
            const cached = member.staffProfile?.personal?.homeLocation;
            const loc = homeLocations[member.uid] || (cached?.lat && cached?.lng ? cached : null);
            return { uid: member.uid, member, location: loc, source: "home", jobsToday };
        }).filter(p => p.location);
    }, [fieldStaff, jobsByStaffToday, homeLocations]);

    // Real travel time (not straight-line distance) for every staff→job pair
    // that's actually needed right now: every staff member to the currently
    // selected job (for the candidate/assign list), plus every already-
    // assigned staff to their own job (for the inline ETA in the jobs
    // panel). Batched into at most 2 requests total — one DistanceMatrix
    // call per travel mode (DRIVING/TRANSIT), each covering every relevant
    // origin×destination pair in one shot — rather than one call per staff.
    useEffect(() => {
        if (!googleMapsReady || !window.google?.maps?.DistanceMatrixService) return;
        const selectedJob = todayJobs.find(j => j.id === selectedJobId);
        const assignedJobs = todayJobs.filter(j => (j.assignedStaffIds || []).length > 0);

        const neededPairs = []; // {uid, job}
        if (selectedJob) {
            (fieldStaff || []).forEach(member => neededPairs.push({ uid: member.uid, job: selectedJob }));
        }
        assignedJobs.forEach(job => {
            const uid = job.assignedStaffIds[0];
            const member = (fieldStaff || []).find(m => m.uid === uid);
            if (member) neededPairs.push({ uid, job });
        });
        if (neededPairs.length === 0) return;

        const service = new window.google.maps.DistanceMatrixService();
        ["DRIVING", "TRANSIT"].forEach(mode => {
            const pairs = neededPairs.filter(p => {
                const member = (fieldStaff || []).find(m => m.uid === p.uid);
                return travelModeFor(member) === mode;
            });
            if (pairs.length === 0) return;
            const uids = [...new Set(pairs.map(p => p.uid))];
            const jobIds = [...new Set(pairs.map(p => p.job.id))];
            const origins = uids.map(uid => staffPins.find(sp => sp.uid === uid)?.location).filter(Boolean);
            const destinations = jobIds.map(id => todayJobs.find(j => j.id === id)?.location).filter(Boolean);
            if (origins.length !== uids.length || destinations.length !== jobIds.length) return;

            service.getDistanceMatrix({
                origins, destinations, travelMode: window.google.maps.TravelMode[mode],
            }, (response, status) => {
                if (status !== "OK") return;
                setEtaMatrix(prev => {
                    const next = { ...prev };
                    uids.forEach((uid, i) => {
                        const row = response.rows[i]?.elements || [];
                        next[uid] = { ...next[uid] };
                        jobIds.forEach((jobId, j) => {
                            const el = row[j];
                            if (el?.status === "OK") {
                                next[uid][jobId] = { text: el.duration.text, seconds: el.duration.value };
                            }
                        });
                    });
                    return next;
                });
            });
        });
    }, [googleMapsReady, fieldStaff, staffPins, todayJobs, selectedJobId]);

    const sortedFieldStaff = useMemo(() => {
        const selectedJob = todayJobs.find(j => j.id === selectedJobId);
        const list = (fieldStaff || []).map(member => {
            const pin = staffPins.find(p => p.uid === member.uid);
            const jobsToday = jobsByStaffToday[member.uid] || [];
            const distanceMeters = selectedJob?.location && pin?.location ? haversineMeters(pin.location, selectedJob.location) : null;
            const eta = selectedJob ? etaMatrix[member.uid]?.[selectedJob.id] : null;
            return { member, jobsToday, distanceMeters, eta, travelMode: travelModeFor(member) };
        });
        if (selectedJob) {
            return list.sort((a, b) => {
                // Prefer real travel time once it's back; fall back to
                // straight-line distance while the Distance Matrix request
                // is still in flight, so the list isn't empty-sorted.
                const aKey = a.eta?.seconds ?? (a.distanceMeters != null ? a.distanceMeters / 10 : null);
                const bKey = b.eta?.seconds ?? (b.distanceMeters != null ? b.distanceMeters / 10 : null);
                if (aKey == null) return 1;
                if (bKey == null) return -1;
                return aKey - bKey;
            });
        }
        return list.sort((a, b) => (a.member.name || "").localeCompare(b.member.name || ""));
    }, [fieldStaff, staffPins, jobsByStaffToday, todayJobs, selectedJobId, etaMatrix]);

    const sortedJobs = useMemo(() => {
        return [...todayJobs].sort((a, b) => {
            const aUnassigned = (a.assignedStaffIds || []).length === 0;
            const bUnassigned = (b.assignedStaffIds || []).length === 0;
            if (aUnassigned !== bUnassigned) return aUnassigned ? -1 : 1;
            return timeSortKey(a.time) - timeSortKey(b.time);
        });
    }, [todayJobs]);

    const toggleAssign = useCallback((booking, staffMember) => {
        const currentIds = booking.assignedStaffIds || [];
        const isAssigned = currentIds.includes(staffMember.uid);
        const nextIds = isAssigned ? currentIds.filter(id => id !== staffMember.uid) : [...currentIds, staffMember.uid];
        const nextStaff = (fieldStaff || [])
            .filter(m => nextIds.includes(m.uid))
            .map(m => ({ uid: m.uid, name: m.name || m.displayName || "", email: m.email || "", photoURL: m.photoURL || "" }));
        handleQuickBookingUpdate(booking.id, { assignedStaffIds: nextIds, assignedStaff: nextStaff });
        // The actual fix for "the cleaner just jumps onto the job with no
        // ETA or route": on a fresh assignment (not an un-assign), drop the
        // job selection and switch straight into route mode for that
        // cleaner, so the pin/route/ETA update together instead of
        // requiring a second manual click on their pin.
        if (!isAssigned) {
            setSelectedJobId(null);
            setSelectedStaffUid(staffMember.uid);
        }
    }, [fieldStaff, handleQuickBookingUpdate]);

    // Build the map once the script is loaded and the div exists. Also
    // re-runs when `isMobile` flips, because the mobile/desktop layouts
    // below render two DIFFERENT map <div>s (stacked vs 3-column) — if the
    // viewport crosses the breakpoint, the old div unmounts and the map
    // instance tied to it would otherwise be left orphaned on a detached
    // node, showing blank. The cleanup nulls the ref so the effect always
    // rebuilds against whichever div is currently mounted.
    useEffect(() => {
        if (!googleMapsReady || !window.google?.maps || !mapDivRef.current) return;
        mapObjRef.current = new window.google.maps.Map(mapDivRef.current, {
            center: OTTAWA_CENTER,
            zoom: 11,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            styles: isDarkMap ? MAP_DARK_STYLE : [],
        });
        return () => { mapObjRef.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [googleMapsReady, isMobile]);

    // Restyle in place on toggle (after initial creation above) and persist
    // the choice per-browser — this is a display preference, not account
    // data, so localStorage rather than a backend write is the right home.
    useEffect(() => {
        if (!mapObjRef.current) return;
        mapObjRef.current.setOptions({ styles: isDarkMap ? MAP_DARK_STYLE : [] });
        window.localStorage.setItem(DARK_MAP_STORAGE_KEY, isDarkMap ? "1" : "0");
    }, [isDarkMap]);

    // Redraw pins whenever the underlying data changes.
    useEffect(() => {
        if (!mapObjRef.current || !window.google?.maps) return;
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        todayJobs.forEach(job => {
            const meta = getStatusMeta(job.status);
            const isUnassigned = (job.assignedStaffIds || []).length === 0;
            const marker = new window.google.maps.Marker({
                position: job.location,
                map: mapObjRef.current,
                title: `${job.clientName || "Job"} — ${job.time || ""}`,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    fillColor: meta.fill,
                    fillOpacity: 1,
                    strokeColor: isUnassigned ? "#dc2626" : "#ffffff",
                    strokeWeight: isUnassigned ? 3 : 2,
                    scale: selectedJobId === job.id ? 12 : 9,
                },
                zIndex: selectedJobId === job.id ? 999 : 1,
            });
            marker.addListener("click", () => setSelectedJobId(job.id));
            markersRef.current.push(marker);
        });

        staffPins.forEach(pin => {
            const sourceLabel = pin.source === "live" ? "live" : pin.source === "first-job" ? "on route" : "home";
            const marker = new window.google.maps.Marker({
                position: pin.location,
                map: mapObjRef.current,
                title: `${pin.member.name || pin.member.displayName || "Staff"} (${sourceLabel})`,
                icon: {
                    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                    fillColor: pin.source === "live" ? STAFF_PIN_LIVE_COLOR : STAFF_PIN_COLOR,
                    fillOpacity: pin.source === "home" ? HOME_PIN_OPACITY : 1,
                    strokeColor: pin.uid === selectedStaffUid ? "#000000" : "#ffffff",
                    strokeWeight: pin.uid === selectedStaffUid ? 2.5 : 1.5,
                    scale: pin.uid === selectedStaffUid ? 1.6 : 1.3,
                    anchor: new window.google.maps.Point(12, 22),
                },
                zIndex: pin.uid === selectedStaffUid ? 999 : 500,
            });
            marker.addListener("click", () => !selectedJobId && setSelectedStaffUid(prev => prev === pin.uid ? null : pin.uid));
            markersRef.current.push(marker);
        });
    }, [todayJobs, staffPins, selectedJobId, selectedStaffUid]);

    // Route line for a selected staff member's remaining jobs today —
    // computed on demand for just that one person, not for everyone at
    // once, to keep Directions API usage bounded. Only makes sense with 2+
    // stops; clears itself the moment the selection drops below that.
    useEffect(() => {
        if (!mapObjRef.current || !window.google?.maps) return;
        if (!directionsRendererRef.current) {
            directionsRendererRef.current = new window.google.maps.DirectionsRenderer({ suppressMarkers: true, preserveViewport: true });
            directionsRendererRef.current.setMap(mapObjRef.current);
        }
        const pin = staffPins.find(p => p.uid === selectedStaffUid);
        const stops = (pin?.jobsToday || []).filter(j => j.location);
        if (!pin || stops.length < 2) {
            directionsRendererRef.current.setDirections({ routes: [] });
            return;
        }
        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route({
            origin: pin.location,
            destination: stops[stops.length - 1].location,
            waypoints: stops.slice(0, -1).map(j => ({ location: j.location, stopover: true })),
            travelMode: window.google.maps.TravelMode[travelModeFor(pin.member)],
        }, (result, status) => {
            if (status === "OK") directionsRendererRef.current.setDirections(result);
        });
    }, [selectedStaffUid, staffPins]);

    if (!googleMapsReady) {
        return (
            <div className="flex h-100 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                Loading map…
            </div>
        );
    }

    const selectedJob = todayJobs.find(j => j.id === selectedJobId);
    const isToday = selectedDateKey === todayKey;

    // Shared between the mobile (stacked, collapsible) and desktop
    // (fixed 3-column) layouts below so the row-rendering logic exists
    // exactly once.
    const staffPanelContent = (
        <>
            {sortedFieldStaff.length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">No field staff loaded.</p>
            )}
            {sortedFieldStaff.map(({ member, jobsToday, distanceMeters, eta, travelMode }) => {
                const isAssignedToSelected = selectedJob ? (selectedJob.assignedStaffIds || []).includes(member.uid) : false;
                const isSelectedForRoute = !selectedJob && selectedStaffUid === member.uid;
                const etaLabel = selectedJob
                    ? (eta?.text ? `${eta.text} ${travelMode === "DRIVING" ? "drive" : "transit"}` : (distanceMeters != null ? "calculating…" : null))
                    : null;
                return (
                    <button
                        key={member.uid}
                        type="button"
                        onClick={() => {
                            if (selectedJob) toggleAssign(selectedJob, member);
                            else setSelectedStaffUid(prev => prev === member.uid ? null : member.uid);
                        }}
                        className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md border border-transparent p-1.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                            (isAssignedToSelected || isSelectedForRoute) && "border-primary bg-primary/10"
                        )}
                    >
                        <StaffAvatar member={member} size={28} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-foreground">{member.name || member.displayName}</p>
                            <p className="text-[10px] text-muted-foreground">
                                {jobsToday.length} job{jobsToday.length === 1 ? "" : "s"} {isToday ? "today" : "that day"}
                                {etaLabel && ` · ${etaLabel}`}
                            </p>
                        </div>
                        {isAssignedToSelected && <span className="text-[10px] font-bold text-primary">✓</span>}
                    </button>
                );
            })}
        </>
    );

    const jobsPanelContent = (
        <>
            {sortedJobs.length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">No jobs with a mapped address {isToday ? "today" : "on this date"}.</p>
            )}
            {sortedJobs.map(job => {
                const meta = getStatusMeta(job.status);
                const isUnassigned = (job.assignedStaffIds || []).length === 0;
                return (
                    <button
                        key={job.id}
                        type="button"
                        onClick={() => { setSelectedJobId(job.id === selectedJobId ? null : job.id); setSelectedStaffUid(null); }}
                        className={cn(
                            "flex flex-col gap-1 rounded-md border p-2 text-left transition-colors",
                            job.id === selectedJobId ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
                            isUnassigned && job.id !== selectedJobId && "border-destructive/40"
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-bold text-foreground">{job.clientName}</span>
                            <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{job.time}</span>
                        </div>
                        <span
                            className="inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                            style={{ background: meta.fill, color: meta.fillText }}
                        >
                            {meta.label}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">{job.address1}</span>
                        </div>
                        {isUnassigned ? (
                            <span className="text-[10px] font-bold text-destructive">Unassigned</span>
                        ) : (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Navigation className="size-3" /> {(job.assignedStaff || []).map(s => s.name).join(", ")}
                                {etaMatrix[job.assignedStaffIds?.[0]]?.[job.id]?.text && (
                                    <span className="font-semibold text-primary">
                                        · ETA {etaMatrix[job.assignedStaffIds[0]][job.id].text}
                                    </span>
                                )}
                            </span>
                        )}
                    </button>
                );
            })}
        </>
    );

    return (
        <div className="animate-fade flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="icon-sm" onClick={() => changeDate(addDays(selectedDateKey, -1))} aria-label="Previous day">
                        <ChevronLeft className="size-3.5" />
                    </Button>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger
                            render={
                                <Button variant={isToday ? "outline" : "secondary"} size="sm" className="gap-1.5 text-xs">
                                    <CalendarIcon className="size-3.5" />
                                    {isToday ? "Today" : formatDateKeyLabel(selectedDateKey, { weekday: "short", month: "short", day: "numeric" })}
                                </Button>
                            }
                        />
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={dateKeyToDate(selectedDateKey)}
                                onSelect={(d) => { if (d) changeDate(dateToDateKey(d)); setDatePickerOpen(false); }}
                            />
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" size="icon-sm" onClick={() => changeDate(addDays(selectedDateKey, 1))} aria-label="Next day">
                        <ChevronRight className="size-3.5" />
                    </Button>
                    {!isToday && (
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => changeDate(todayKey)}>Jump to today</Button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {(selectedJobId || selectedStaffUid) && (
                        <Button variant="outline" size="sm" onClick={() => { setSelectedJobId(null); setSelectedStaffUid(null); }}>Clear selection</Button>
                    )}
                    <Button
                        variant="outline" size="icon-sm"
                        onClick={() => setIsDarkMap(v => !v)}
                        title={isDarkMap ? "Switch to light map" : "Switch to dark map"}
                    >
                        {isDarkMap ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                    </Button>
                </div>
            </div>

            <p className="text-sm text-muted-foreground">
                {activeBranch?.name || "Ottawa"} · {sortedJobs.length} job{sortedJobs.length === 1 ? "" : "s"} {isToday ? "today" : `on ${formatDateKeyLabel(selectedDateKey, { weekday: "long", month: "long", day: "numeric" })}`}
                {selectedJob && (
                    <span className="ml-2 font-semibold text-foreground">
                        Assigning: {selectedJob.clientName} — click a cleaner to toggle assignment
                    </span>
                )}
                {!selectedJob && selectedStaffUid && (
                    <span className="ml-2 font-semibold text-foreground">
                        Showing route — click the cleaner again, or a job, to change selection
                    </span>
                )}
            </p>

            {isMobile ? (
                <div className="flex flex-col gap-3">
                    <details className="rounded-lg border border-border bg-card" open>
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            <CalendarIcon className="size-3.5" /> Jobs ({sortedJobs.length})
                        </summary>
                        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto p-2 pt-0">{jobsPanelContent}</div>
                    </details>
                    <div ref={mapDivRef} className="h-[50vh] min-h-80 w-full rounded-lg border border-border" />
                    <details className="rounded-lg border border-border bg-card">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            <Users className="size-3.5" /> Field Staff ({sortedFieldStaff.length})
                        </summary>
                        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto p-2 pt-0">{staffPanelContent}</div>
                    </details>
                </div>
            ) : (
            <div className="grid gap-3 lg:grid-cols-[260px_1fr_300px]">
                <div className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-card p-2">
                    <p className="flex items-center gap-1.5 px-1 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <Users className="size-3.5" /> Field Staff
                    </p>
                    {staffPanelContent}
                </div>

                <div ref={mapDivRef} className="h-[70vh] min-h-100 w-full rounded-lg border border-border" />

                <div className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-card p-2">
                    <p className="flex items-center gap-1.5 px-1 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <CalendarIcon className="size-3.5" /> Jobs
                    </p>
                    {jobsPanelContent}
                </div>
            </div>
            )}
        </div>
    );
}
