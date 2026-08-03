import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import RegisterServiceWorker from "./components/shared/RegisterServiceWorker";
import InstallPrompt from "./components/shared/InstallPrompt";

export const metadata = {
  title: "SmarTouch Clean - Admin Client Scheduling System",
  description: "Secure, real-time client booking and operational crew dispatch manager.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  themeColor: "#005691",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-center" richColors />
        <RegisterServiceWorker src="/sw-staff.js" scope="/" />
        <InstallPrompt accentColor="#005691" appLabel="SmarTouch app" />
      </body>
    </html>
  );
}
