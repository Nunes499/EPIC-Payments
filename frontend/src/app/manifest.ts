import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EPIC Payments",
    short_name: "EPIC Payments",
    description: "Sistema EPIC Payments",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b4f7c",
    theme_color: "#0b4f7c",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
