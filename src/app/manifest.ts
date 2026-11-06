import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cali's Task",
    short_name: "Cali's Task",
    description: "Plan. Track. Complete.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef0ff",
    theme_color: "#4f6bff",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
