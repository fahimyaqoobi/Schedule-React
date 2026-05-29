import "./globals.css";

export const metadata = {
  title: "SmarTouch Clean - Admin Client Scheduling System",
  description: "Secure, real-time client booking and operational crew dispatch manager.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#f4f6fa" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
