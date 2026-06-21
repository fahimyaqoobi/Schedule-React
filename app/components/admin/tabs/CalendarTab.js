"use client";

export default function CalendarTab({
    monthNames,
    currentCalMonth,
    calendarDays,
    bookings,
    selectedCalDate,
    isCleanerSelfServiceView,
    teams,
    agendaBookings,
    Icons,
    changeMonth,
    setSelectedCalDate,
    getBookingCustomerFirstName,
    setSelectedBooking,
    setDetailsModalOpen,
    openEditBookingModal,
}) {
    return (
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

                            const dayBookings = bookings.filter(b => b.date === cell.dateStr && (isCleanerSelfServiceView ? true : b.status !== "Cancelled"));
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
                                                    title={`${isCleanerSelfServiceView ? getBookingCustomerFirstName(b) : b.clientName} - ${b.service}`}
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
                                        <span className="agenda-item-title">{isCleanerSelfServiceView ? getBookingCustomerFirstName(b) : b.clientName}</span>
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
    );
}
