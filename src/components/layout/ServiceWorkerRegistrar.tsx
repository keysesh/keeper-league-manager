"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production, and makes sure one is never
 * running in development.
 *
 * The second half matters as much as the first: a worker left registered on
 * localhost serves the last build's assets over the one you are editing, and
 * the symptom — a change that will not appear no matter how hard you reload —
 * looks like anything except a service worker.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => r.unregister()))
        .catch(() => {
          // Nothing to clean up, or the browser refused. Either is fine.
        });
      return;
    }

    // After load, so registration never competes with the first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unavailable worker costs a cache, not the app.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
