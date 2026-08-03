import PortalNav from "../components/portal/PortalNav";
import RegisterServiceWorker from "../components/shared/RegisterServiceWorker";
import InstallPrompt from "../components/shared/InstallPrompt";

export const metadata = {
    title: "My Smartouch Account",
    manifest: "/customer-manifest.json",
};

export const viewport = {
    width: "device-width",
    initialScale: 1.0,
    maximumScale: 1.0,
    userScalable: false,
    themeColor: "#0A6CB8",
};

export default function CustomerLayout({ children }) {
    return (
        <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100dvh", background: "#f8fafc", position: "relative", paddingBottom: 80 }}>
            {children}
            <PortalNav />
            <RegisterServiceWorker src="/sw-customer.js" scope="/customer/" />
            <InstallPrompt accentColor="#0A6CB8" appLabel="SmarTouch customer app" />
        </div>
    );
}
