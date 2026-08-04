"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, CalendarDays, Calendar as CalendarIcon } from "lucide-react";
import BoardView from "./BoardView";
import TimelineView from "./TimelineView";
import MonthView from "./MonthView";

// Root of the admin scheduling Calendar — a Board (Kanban status) view, a
// Timeline (staff × day) view, and a big-month Calendar browse view,
// switchable via the tabs below. A cleaner's self-service view only ever
// gets Board (their own jobs, read-only) — Timeline's whole value is
// comparing across staff, and Calendar's month browse isn't a dispatch
// need either, so neither is relevant to someone looking only at their own
// schedule, and there's no reason to hand a field cleaner free-form
// dispatch controls.
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
            branchTimezone={branchTimezone}
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
                    <TabsTrigger value="month"><CalendarIcon className="size-3.5" /> Calendar</TabsTrigger>
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
                    branchTimezone={branchTimezone}
                />
            )}
            {view === "month" && (
                <MonthView
                    bookings={bookings}
                    isCleanerSelfServiceView={isCleanerSelfServiceView}
                    currentUser={currentUser}
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
