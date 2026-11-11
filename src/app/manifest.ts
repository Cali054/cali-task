import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cali's Task",
    short_name: "Cali's Task",
    description: "Plan. Track. Complete.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#111211",
    theme_color: "#e8b96f",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
