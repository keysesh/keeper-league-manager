import type { MetadataRoute } from "next";

/**
 * Without a manifest (and the Apple web-app metadata in the root layout),
 * "Add to Home Screen" on iOS produces a plain Safari bookmark — every open
 * is a normal browser tab, which is exactly the "Keeper keeps opening in a
 * browser window" complaint. `display: standalone` with scope "/" keeps all
 * internal Keeper routes (including the auth flow) inside the installed app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Keeper League Manager",
    short_name: "Keeper",
    description: "E Pluribus keeper league management — syncs with Sleeper",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#06090f",
    theme_color: "#06090f",
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
