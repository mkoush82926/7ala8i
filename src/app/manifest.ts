import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Halaqy — Barbershop booking & management",
    short_name: "Halaqy",
    description:
      "Book your next haircut, or run your barbershop's bookings, team and clients from one place. احجز موعدك القادم أو أدِر صالونك من مكان واحد.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1c1611",
    categories: ["business", "lifestyle", "productivity"],
    lang: "en",
    dir: "auto",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
