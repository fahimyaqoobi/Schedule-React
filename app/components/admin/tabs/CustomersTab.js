"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import CustomerProfileModal from "../CustomerProfileModal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Search, X, ArrowUp, ArrowDown, ArrowUpDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function money(n) {
    return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function CustomersTab({ getAuthHeaders, currentUser }) {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortCol, setSortCol] = useState("lastBookingDate");
    const [sortDir, setSortDir] = useState("desc");
    const [selectedKey, setSelectedKey] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/customers", { headers });
            const data = await res.json();
            if (res.ok) setCustomers(data);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => { load(); }, [load]);

    const handleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir("desc"); }
    };

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        const filtered = !term ? customers : customers.filter(c =>
            (c.name || "").toLowerCase().includes(term) ||
            (c.phone || "").includes(term) ||
            (c.email || "").toLowerCase().includes(term)
        );
        return [...filtered].sort((a, b) => {
            const av = a[sortCol], bv = b[sortCol];
            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    }, [customers, search, sortCol, sortDir]);

    const SortArrow = ({ col }) => sortCol !== col
        ? <ArrowUpDown className="size-3 opacity-40" />
        : sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;

    const SortHead = ({ col, children, className }) => (
        <TableHead className={cn("cursor-pointer select-none", className)} onClick={() => handleSort(col)}>
            <span className="flex items-center gap-1">{children} <SortArrow col={col} /></span>
        </TableHead>
    );

    return (
        <div className="animate-fade flex flex-col gap-4">
            <Card>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">CRM</p>
                        <CardTitle className="text-xl">Customer Directory</CardTitle>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Every customer, matched automatically across bookings by phone (or email) — lifetime value, balance owed, service history, and support chat in one place.</p>
                    </div>
                    <Badge variant="secondary">{customers.length} Customers</Badge>
                </CardHeader>
            </Card>

            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, or email…" className="pl-8" />
                {search && (
                    <button onClick={() => setSearch("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="size-4" />
                    </button>
                )}
            </div>

            <Card className="p-0">
                <CardContent className="p-4">
                    {loading ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">Loading customers…</div>
                    ) : visible.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                            <Users className="size-6 opacity-50" />
                            No customers match.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <SortHead col="name">Name</SortHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Email</TableHead>
                                    <SortHead col="totalBookings">Bookings</SortHead>
                                    <SortHead col="totalRevenue">Lifetime Revenue</SortHead>
                                    <SortHead col="totalOwing">Balance Owing</SortHead>
                                    <SortHead col="promoUsageCount">Promo Uses</SortHead>
                                    <SortHead col="lastBookingDate">Last Booking</SortHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visible.map(c => (
                                    <TableRow key={c.key}>
                                        <TableCell>
                                            <div className="font-bold text-foreground">{c.name}</div>
                                            {c.isRecurringCustomer && <Badge variant="outline" className="mt-0.5 text-[9px] text-cyan-600">● Recurring</Badge>}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                                        <TableCell className="max-w-[180px] truncate text-muted-foreground">{c.email || "—"}</TableCell>
                                        <TableCell>{c.totalBookings}</TableCell>
                                        <TableCell className="font-bold text-cyan-600">{money(c.totalRevenue)}</TableCell>
                                        <TableCell className={cn("font-bold", c.totalOwing > 0 ? "text-destructive" : "text-emerald-600")}>{money(c.totalOwing)}</TableCell>
                                        <TableCell>{c.promoUsageCount}</TableCell>
                                        <TableCell>{c.lastBookingDate || "—"}</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="secondary" onClick={() => setSelectedKey(c.key)}>View Profile</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {selectedKey && (
                <CustomerProfileModal
                    customerKey={selectedKey}
                    getAuthHeaders={getAuthHeaders}
                    currentUser={currentUser}
                    onClose={() => setSelectedKey(null)}
                />
            )}
        </div>
    );
}
