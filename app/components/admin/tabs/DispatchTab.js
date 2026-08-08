"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MapPin, Navigation, Users, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

function buildAddressString(personal) {
    if (!personal) return "";
    return [personal.address, personal.city, personal.province, personal.postalCode].filter(Boolean).join(", ");
}

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
    const todayKey = useMemo(() => getZonedDateKey(new Date(), branchTimezone), [branchTimezone]);
    const [selectedDateKey] = useState(todayKey);
    const [selectedJobId, setSelectedJobId] = useState(null);
    const [selectedStaffUid, setSelectedStaffUid] = useState(null);
    const [homeLocations, setHomeLocations] = useState({}); // uid -> {lat,lng}
    const geocodingRef = useRef(new Set());

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

    const sortedFieldStaff = useMemo(() => {
        const selectedJob = todayJobs.find(j => j.id === selectedJobId);
        const list = (fieldStaff || []).map(member => {
            const pin = staffPins.find(p => p.uid === member.uid);
            const jobsToday = jobsByStaffToday[member.uid] || [];
            const distanceMeters = selectedJob?.location && pin?.location ? haversineMeters(pin.location, selectedJob.location) : null;
            return { member, jobsToday, distanceMeters };
        });
        if (selectedJob) {
            return list.sort((a, b) => {
                if (a.distanceMeters == null) return 1;
                if (b.distanceMeters == null) return -1;
                return a.distanceMeters - b.distanceMeters;
            });
        }
        return list.sort((a, b) => (a.member.name || "").localeCompare(b.member.name || ""));
    }, [fieldStaff, staffPins, jobsByStaffToday, todayJobs, selectedJobId]);

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
    }, [fieldStaff, handleQuickBookingUpdate]);

    // Build the map once the script is loaded and the div exists.
    useEffect(() => {
        if (!googleMapsReady || !window.google?.maps || mapObjRef.current || !mapDivRef.current) return;
        mapObjRef.current = new window.google.maps.Map(mapDivRef.current, {
            center: OTTAWA_CENTER,
            zoom: 11,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
        });
    }, [googleMapsReady]);

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
            travelMode: window.google.maps.TravelMode.DRIVING,
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

    return (
        <div className="animate-fade flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {activeBranch?.name || "Ottawa"} · {sortedJobs.length} job{sortedJobs.length === 1 ? "" : "s"} today
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
                {(selectedJobId || selectedStaffUid) && (
                    <Button variant="outline" size="sm" onClick={() => { setSelectedJobId(null); setSelectedStaffUid(null); }}>Clear selection</Button>
                )}
            </div>

            <div className="grid gap-3 lg:grid-cols-[260px_1fr_300px]">
                <div className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-card p-2">
                    <p className="flex items-center gap-1.5 px-1 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <Users className="size-3.5" /> Field Staff
                    </p>
                    {sortedFieldStaff.length === 0 && (
                        <p className="px-1 py-4 text-center text-xs text-muted-foreground">No field staff loaded.</p>
                    )}
                    {sortedFieldStaff.map(({ member, jobsToday, distanceMeters }) => {
                        const isAssignedToSelected = selectedJob ? (selectedJob.assignedStaffIds || []).includes(member.uid) : false;
                        const isSelectedForRoute = !selectedJob && selectedStaffUid === member.uid;
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
                                        {jobsToday.length} job{jobsToday.length === 1 ? "" : "s"} today
                                        {distanceMeters != null && ` · ${(distanceMeters / 1000).toFixed(1)} km away`}
                                    </p>
                                </div>
                                {isAssignedToSelected && <span className="text-[10px] font-bold text-primary">✓</span>}
                            </button>
                        );
                    })}
                </div>

                <div ref={mapDivRef} className="h-[70vh] min-h-100 w-full rounded-lg border border-border" />

                <div className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-card p-2">
                    <p className="flex items-center gap-1.5 px-1 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <CalendarIcon className="size-3.5" /> Today's Jobs
                    </p>
                    {sortedJobs.length === 0 && (
                        <p className="px-1 py-4 text-center text-xs text-muted-foreground">No jobs with a mapped address today.</p>
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
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
