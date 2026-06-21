import PortalNav from "../components/portal/PortalNav";

export const metadata = { title: "My Smartouch Account" };

export default function CustomerLayout({ children }) {
    return (
        <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100dvh", background: "#f8fafc", position: "relative", paddingBottom: 80 }}>
            {children}
            <PortalNav />
        </div>
    );
}
