import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Offline · Keeper",
};

/**
 * What the installed app shows when a page is asked for with no network.
 *
 * Deliberately outside every route group: it is precached by the service
 * worker at install time, so it has to render without a session, without the
 * database, and without a single request of its own.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#06090f] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.10] border-t-white/[0.16] bg-[#0c1219] p-7 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-400">
          <WifiOff size={24} strokeWidth={1.5} />
        </span>
        <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-white">
          No connection
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          Keeper needs the network to read your league. Your plan is saved on
          the server, so nothing here is lost — this screen goes away as soon
          as you are back.
        </p>
      </div>
    </div>
  );
}
