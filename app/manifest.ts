import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Expense Manager",
    description: "Track personal expenses by month and category",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#0F766E",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
