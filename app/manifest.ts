import type { MetadataRoute } from "next";

/**
 * Web app manifest.
 *
 * Required for iPhone: iOS only delivers web push to a site installed to
 * the Home Screen and running standalone, and it only offers a proper
 * install when a manifest declares `display: "standalone"`. Without this,
 * "Add to Home Screen" produces a plain shortcut and the push API never
 * becomes available.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KonveksiTracker",
    short_name: "KonveksiTracker",
    description: "Shared team order tracker",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
