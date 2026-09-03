"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Share, Plus, X, Download } from "lucide-react";

/** Chromium's install event, which is not in lib.dom. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED = "keeper.install-prompt.dismissed";

/** Already running as an installed app — iOS answers this its own way. */
function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone;
  return (
    iosStandalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

/**
 * iOS, including an iPad that reports itself as a Mac — it has done since
 * iPadOS 13, and the touch count is the only thing that gives it away.
 */
function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function remember(): void {
  try {
    localStorage.setItem(DISMISSED, "1");
  } catch {
    // Private browsing refuses to store; the prompt simply returns next visit.
  }
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}

/**
 * The one thing that turns this from a website into an app on someone's
 * phone, and the only step a user has to take themselves.
 *
 * Two paths, because the platforms differ in kind: Chromium hands the page an
 * install event it can fire on a tap, and iOS has no such thing at all — there
 * the only honest move is to say where the button is. Asked once. Answered
 * once, either way, and it does not come back.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<"none" | "prompt" | "ios">("none");
  const deferred = useRef<InstallEvent | null>(null);

  // Whether this device can be installed onto, and how, is a platform fact
  // that cannot be read during render without disagreeing with the server.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isInstalled() || wasDismissed()) return;

    const onAvailable = (event: Event) => {
      // Holding the event is what lets the browser's own dialog appear on a
      // tap of ours instead of whenever Chrome feels like it.
      event.preventDefault();
      deferred.current = event as InstallEvent;
      setMode("prompt");
    };
    const onInstalled = () => {
      remember();
      setMode("none");
    };

    window.addEventListener("beforeinstallprompt", onAvailable);
    window.addEventListener("appinstalled", onInstalled);

    // iOS never fires the event, so nothing arrives to wait for.
    if (isIos()) setMode("ios");

    return () => {
      window.removeEventListener("beforeinstallprompt", onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dismiss = useCallback(() => {
    remember();
    setMode("none");
  }, []);

  const install = useCallback(async () => {
    const event = deferred.current;
    if (!event) return;
    deferred.current = null;
    await event.prompt();
    await event.userChoice;
    // Either answer is an answer: accepted fires appinstalled, declined means
    // they were asked and said no.
    remember();
    setMode("none");
  }, []);

  if (mode === "none") return null;

  // Sits above the bottom nav on a phone and in the corner on a desktop —
  // never over the tab bar, which is the one thing that must stay reachable.
  return (
    <div className="install-dock">
      <PromptCard mode={mode} onInstall={install} onDismiss={dismiss} />
    </div>
  );
}

function PromptCard({
  mode,
  onInstall,
  onDismiss,
}: {
  mode: "prompt" | "ios";
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.12] border-t-white/[0.18] bg-[#111a27] p-3 shadow-[0_12px_32px_-12px_rgba(0,0,0,.8)]">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/15 text-blue-400">
        <Download size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-slate-50">Keep this on your home screen</p>
        {mode === "ios" ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] leading-relaxed text-slate-400">
            Tap
            <Share size={12} className="inline text-slate-300" aria-label="the Share button" />
            then
            <span className="inline-flex items-center gap-1 text-slate-300">
              <Plus size={12} aria-hidden />
              Add to Home Screen
            </span>
          </p>
        ) : (
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
            Opens full screen, without the browser bars.
          </p>
        )}
        {mode === "prompt" && (
          <button
            onClick={onInstall}
            className="mt-2.5 min-h-[36px] rounded-lg bg-blue-600 px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-blue-500"
          >
            Install
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
      >
        <X size={14} />
      </button>
    </div>
  );
}
