"use client";
import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, CalendarDays, Calendar as CalendarIcon } from "lucide-react";
import BoardView from "./BoardView";
import TimelineView from "./TimelineView";
import MonthView from "./MonthView";

// Root of the admin scheduling Calendar — a Board (Kanban status) view, a
// Timeline (staff × day) view, and a big-month Calendar browse view,
// switchable via the tabs below. A cleaner's self-service view gets Board
// and Calendar (both scoped to their own jobs) but not Timeline — Timeline's
// whole value is comparing across staff, which isn't relevant to someone
// looking only at their own schedule, and there's no reason to hand a field
// cleaner free-form dispatch controls either way (neither Board nor
// Calendar allow drag in self-service mode).
export default function CalendarTab({
    bookings,
    fieldStaff,
    isCleanerSelfServiceView,
    currentUser,
    handleQuickBookingUpdate,
    getBookingCustomerFirstName,
    setSelectedBooking,
    setDetailsModalOpen,
    openEditBookingModal,
    openNewBookingCommand,
    branchTimezone,
}) {
    const [view, setView] = useState("month");
    // Set by MonthView's "Go to Day" context-menu item so Staff Timeline
    // opens anchored on that date instead of wherever it was last left.
    // TimelineView consumes and clears it via useEffect.
    const [pendingTimelineAnchor, setPendingTimelineAnchor] = useState(null);
    // Stable identities — MonthView threads onGoToDay into react-day-picker's
    // `components.DayButton`, which remounts every day cell whenever that
    // object's contents change reference, killing any open context menu.
    const handleGoToDay = useCallback((dateKey) => { setPendingTimelineAnchor(dateKey); setView("timeline"); }, []);
    const clearPendingTimelineAnchor = useCallback(() => setPendingTimelineAnchor(null), []);

    const boardView = (
        <BoardView
            bookings={bookings}
            isCleanerSelfServiceView={isCleanerSelfServiceView}
            currentUser={currentUser}
            handleQuickBookingUpdate={handleQuickBookingUpdate}
            getBookingCustomerFirstName={getBookingCustomerFirstName}
            setSelectedBooking={setSelectedBooking}
            setDetailsModalOpen={setDetailsModalOpen}
            openEditBookingModal={openEditBookingModal}
            branchTimezone={branchTimezone}
        />
    );

    const monthView = (
        <MonthView
            bookings={bookings}
            isCleanerSelfServiceView={isCleanerSelfServiceView}
            currentUser={currentUser}
            getBookingCustomerFirstName={getBookingCustomerFirstName}
            setSelectedBooking={setSelectedBooking}
            setDetailsModalOpen={setDetailsModalOpen}
            openEditBookingModal={openEditBookingModal}
            openNewBookingCommand={openNewBookingCommand}
            onGoToDay={!isCleanerSelfServiceView ? handleGoToDay : undefined}
            branchTimezone={branchTimezone}
        />
    );

    if (isCleanerSelfServiceView) {
        return (
            <div className="animate-fade flex flex-col gap-4">
                <Tabs value={view} onValueChange={setView}>
                    <TabsList>
                        <TabsTrigger value="month"><CalendarIcon className="size-3.5" /> Calendar</TabsTrigger>
                        <TabsTrigger value="board"><LayoutGrid className="size-3.5" /> My Jobs</TabsTrigger>
                    </TabsList>
                </Tabs>
                {view === "month" ? monthView : boardView}
            </div>
        );
    }

    return (
        <div className="animate-fade flex flex-col gap-4">
            <Tabs value={view} onValueChange={setView}>
                <TabsList>
                    <TabsTrigger value="month"><CalendarIcon className="size-3.5" /> Calendar</TabsTrigger>
                    <TabsTrigger value="board"><LayoutGrid className="size-3.5" /> Status Board</TabsTrigger>
                    <TabsTrigger value="timeline"><CalendarDays className="size-3.5" /> Staff Timeline</TabsTrigger>
                </TabsList>
            </Tabs>

            {view === "board" && boardView}
            {view === "timeline" && (
                <TimelineView
                    bookings={bookings}
                    fieldStaff={fieldStaff}
                    isCleanerSelfServiceView={isCleanerSelfServiceView}
                    currentUser={currentUser}
                    handleQuickBookingUpdate={handleQuickBookingUpdate}
                    getBookingCustomerFirstName={getBookingCustomerFirstName}
                    setSelectedBooking={setSelectedBooking}
                    setDetailsModalOpen={setDetailsModalOpen}
                    openEditBookingModal={openEditBookingModal}
                    openNewBookingCommand={openNewBookingCommand}
                    pendingTimelineAnchor={pendingTimelineAnchor}
                    clearPendingTimelineAnchor={clearPendingTimelineAnchor}
                    branchTimezone={branchTimezone}
                />
            )}
            {view === "month" && monthView}
        </div>
    );
}
