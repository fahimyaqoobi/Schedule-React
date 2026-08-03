export default function manifest() {
  return {
    name: "SmarTouch Clean Scheduler",
    short_name: "SmarTouch",
    description: "Secure, real-time client booking and operational crew dispatch manager.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f9fd",
    theme_color: "#005691",
    icons: [
      { src: "/logo-icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-384.png", sizes: "384x384", type: "image/png", purpose: "maskable" },
    ],
  };
}
