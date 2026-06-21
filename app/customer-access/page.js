import CustomerFlow from "./CustomerFlow";

function safe(v = "") { return String(v || "").trim(); }

export default async function CustomerAccessPage({ searchParams }) {
    const params = await searchParams;
    return (
        <CustomerFlow
            phone={safe(params?.phone)}
            bookingId={safe(params?.bookingId)}
            paid={safe(params?.paid) === "true"}
            cancelled={safe(params?.cancelled) === "true"}
        />
    );
}
