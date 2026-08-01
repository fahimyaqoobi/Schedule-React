"use client";
import { useEffect, useState } from "react";
import ChatHub from "../../components/shared/ChatHub";

// Dedicated Chat tab — previously job chat was buried inside a job's detail
// page and support chat was a button tucked in Profile, with no persistent
// "go here for every conversation" screen. This is that screen.
export default function CustomerChatPage() {
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("/api/customer/profile").then(r => r.json()),
            fetch("/api/customer/bookings").then(r => r.json()),
        ]).then(([p, b]) => {
            setPhone(p.profile?.phone || "");
            setName(p.profile?.name || "");
            setJobs((b.bookings || []).filter(bk => bk.status !== "Cancelled"));
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const jobThreads = jobs
        .slice()
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .map(b => ({
            id: b.id,
            name: b.service || "Cleaning",
            subtitle: [b.date, b.time].filter(Boolean).join(" · "),
            detail: b.address1,
            locked: b.status === "Completed",
        }));

    return (
        <div>
            <div className="border-b border-border px-5 pt-13 pb-5">
                <div className="text-xl font-extrabold text-foreground">Chat</div>
                <div className="mt-0.5 text-sm text-muted-foreground">Office support, and every job's conversation with your cleaner.</div>
            </div>
            <div className="p-4">
                {loading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
                ) : (
                    <ChatHub
                        currentActorId={phone}
                        supportType="customer"
                        supportRefId={phone}
                        supportRefName={name}
                        jobs={jobThreads}
                        emptyJobsHint="Chats for your bookings will show up here once you have an upcoming or recent job."
                    />
                )}
            </div>
        </div>
    );
}
