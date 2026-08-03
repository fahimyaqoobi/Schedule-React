"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, CalendarDays } from "lucide-react";
import BoardView from "./BoardView";
import TimelineView from "./TimelineView";

// Root of the admin scheduling Calendar — a Board (Kanban status) view and
// a Timeline (staff × day) view, switchable via the tabs below. A cleaner's
// self-service view only ever gets Board (their own jobs, read-only) —
// Timeline's whole value is comparing across staff, which isn't relevant
// to someone looking only at their own schedule, and there's no reason to
// hand a field cleaner free-form dispatch controls.
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
    branchTimezone,
}) {
    const [view, setView] = useState("board");

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
        />
    );

    if (isCleanerSelfServiceView) {
        return <div className="animate-fade">{boardView}</div>;
    }

    return (
        <div className="animate-fade flex flex-col gap-4">
            <Tabs value={view} onValueChange={setView}>
                <TabsList>
                    <TabsTrigger value="board"><LayoutGrid className="size-3.5" /> Status Board</TabsTrigger>
                    <TabsTrigger value="timeline"><CalendarDays className="size-3.5" /> Staff Timeline</TabsTrigger>
                </TabsList>
            </Tabs>

            {view === "board" ? boardView : (
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
                    branchTimezone={branchTimezone}
                />
            )}
        </div>
    );
}
