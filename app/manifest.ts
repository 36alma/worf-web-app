import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WORF",
    short_name: "WORF",
    description:
      "WORF – Intelligens csoportkezelő és feladatkezelő rendszer",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#09090b",
    background_color: "#09090b",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
