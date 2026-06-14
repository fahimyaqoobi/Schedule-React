import "./globals.css";

export const metadata = {
  title: "SmarTouch Clean - Admin Client Scheduling System",
  description: "Secure, real-time client booking and operational crew dispatch manager.",
  manifest: "/manifest.json",
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
      </body>
    </html>
  );
}
