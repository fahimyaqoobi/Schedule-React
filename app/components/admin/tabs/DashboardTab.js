"use client";

export default function DashboardTab({
    currentUser,
    bookings,
    customerRewards,
    promotionRules,
    adminCommandMetrics,
    catalogServiceCards,
    adminServiceCart,
    adminCartTotals,
    activeBranch,
    todayBookings,
    pendingUsers,
    fieldStaff,
    canManagePermissions,
    Icons,
    serviceCatalogRef,
    getPersonalReferralCode,
    getCustomerEligiblePromotions,
    openNewBookingCommand,
    openServiceConfigurator,
    editAdminCartItem,
    removeAdminCartItem,
    checkoutAdminCart,
    setSelectedBooking,
    setDetailsModalOpen,
    setActiveTab,
    setFilterStatus,
    handleResolveUserApproval,
    getRoleLabel,
}) {
    return (
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
                            {(() => {
                                const myBookings = bookings.filter(b => b.email === currentUser.email);
                                const usage = myBookings.filter(b => b.promoCode).map(b => ({ code: b.promoCode }));
                                const referralCode = customerRewards?.referralCode || getPersonalReferralCode({ email: currentUser.email, phone: currentUser.phone, name: currentUser.name });
                                const availableCredit = Number(customerRewards?.rewards?.availableCredit || 0);
                                const qualifying = Number(customerRewards?.rewards?.qualifyingReferrals || 0);
                                const perReferral = Number(customerRewards?.rewards?.perReferral || 30);
                                const eligible = customerRewards?.eligiblePromotions || getCustomerEligiblePromotions({ promotions: promotionRules, customerUsage: usage, referralCredits: availableCredit });
                                const copy = (text, label) => { try { navigator.clipboard?.writeText(text); } catch { /* clipboard unavailable */ } alert(`${label} copied${label === referralCode ? "" : " — apply it at checkout"}.`); };
                                return (
                                    <>
                                        <div className="rewards-card">
                                            <span className="rewards-kicker">Rewards Wallet</span>
                                            <div className="rewards-balance">
                                                <span>Available credit</span>
                                                <strong>${availableCredit.toFixed(2)}</strong>
                                                <small>{qualifying > 0 ? `${qualifying} friend${qualifying > 1 ? "s" : ""} booked · $${perReferral} each` : `Earn $${perReferral} when a friend completes their first booking`}</small>
                                            </div>
                                            <div className="rewards-referral">
                                                <span className="rewards-referral-label">Your referral code</span>
                                                <button type="button" className="rewards-code" onClick={() => copy(referralCode, referralCode)}>
                                                    <code>{referralCode}</code>
                                                    <span className="rewards-copy">Copy</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="rewards-promos panel-card">
                                            <div className="panel-header"><h4>Available Promos</h4></div>
                                            <div className="rewards-promo-list">
                                                {eligible.length === 0 && <p className="rewards-empty">No promotions available right now.</p>}
                                                {eligible.map(p => (
                                                    <div key={p.id} className={`rewards-promo ${p.eligible ? "" : "locked"}`}>
                                                        <div className="rewards-promo-main">
                                                            <code>{p.code}</code>
                                                            <span className="rewards-promo-name">{p.name}</span>
                                                            {p.description && <small>{p.description}</small>}
                                                        </div>
                                                        {p.eligible
                                                            ? <button type="button" className="rewards-promo-copy" onClick={() => copy(p.code, p.code)}>Copy</button>
                                                            : <span className="rewards-promo-locked" title={p.lockedReason}>Locked</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
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
                            <div className="admin-metric-card warning" style={{cursor: adminCommandMetrics.awaitingApproval > 0 ? "pointer" : "default"}} onClick={() => { if (adminCommandMetrics.awaitingApproval > 0) { setActiveTab("bookings"); setFilterStatus("awaiting_approval"); } }}>
                                <span>Pending Work</span>
                                <strong>{adminCommandMetrics.pending}</strong>
                                <small>{adminCommandMetrics.awaitingApproval > 0 ? `⏳ ${adminCommandMetrics.awaitingApproval} need approval` : `${adminCommandMetrics.confirmed} confirmed jobs`}</small>
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
                                        {adminServiceCart.map(item => {
                                            const basePrice = Number(item.basePrice || 0);
                                            const bathroomPrice = Number(item.bathroomPrice || 0);
                                            const addons = item.addons || [];
                                            return (
                                                <div key={item.cartId} className="admin-cart-item">
                                                    <div>
                                                        <strong>{item.name}</strong>
                                                        <span>
                                                            {item.optionName}
                                                            {item.bathroomKey ? ` • ${item.bathroomKey}` : ""}
                                                            {` • ${Number(item.durationHrs || 0).toFixed(1)} hrs`}
                                                        </span>
                                                        <div className="admin-cart-breakdown">
                                                            <div>
                                                                <span>Base service / tier</span>
                                                                <strong>${basePrice.toFixed(2)}</strong>
                                                            </div>
                                                            {bathroomPrice > 0 && (
                                                                <div>
                                                                    <span>{item.bathroomKey || "Bathroom adjustment"}</span>
                                                                    <strong>${bathroomPrice.toFixed(2)}</strong>
                                                                </div>
                                                            )}
                                                            {addons.length > 0 ? addons.map(addon => {
                                                                const qty = Number(addon.qty || 1);
                                                                const addonLineTotal = Number(addon.total ?? Number(addon.price || 0) * qty);
                                                                return (
                                                                    <div key={addon.id}>
                                                                        <span>{addon.name}{qty > 1 ? ` x${qty}` : ""}</span>
                                                                        <strong>${addonLineTotal.toFixed(2)}</strong>
                                                                    </div>
                                                                );
                                                            }) : (
                                                                <div>
                                                                    <span>Add-ons</span>
                                                                    <strong>$0.00</strong>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="admin-cart-price">
                                                        <strong>${Number(item.price || 0).toFixed(2)}</strong>
                                                        <button onClick={() => editAdminCartItem(item)} type="button" className="admin-cart-edit" aria-label={`Edit ${item.name}`}>
                                                            {Icons.Edit()}
                                                        </button>
                                                        <button onClick={() => removeAdminCartItem(item.cartId)} type="button" aria-label={`Remove ${item.name}`}>
                                                            {Icons.Trash()}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
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
    );
}
