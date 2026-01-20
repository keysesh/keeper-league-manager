"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Image from "next/image";
import { Check, ExternalLink, Link2, Unlink, User } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

// Discord icon component
function DiscordIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

// Sleeper icon component
function SleeperIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" />
      <text x="12" y="16" textAnchor="middle" fill="black" fontSize="10" fontWeight="bold">
        S
      </text>
    </svg>
  );
}

interface AccountCardProps {
  provider: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  connected: boolean;
  username?: string | null;
  avatar?: string | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isPrimary?: boolean;
  isLoading?: boolean;
}

function AccountCard({
  icon,
  title,
  description,
  connected,
  username,
  avatar,
  onConnect,
  onDisconnect,
  isPrimary,
  isLoading,
}: AccountCardProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-[#2a2a2a] flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {isPrimary && (
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium">
                Primary
              </span>
            )}
            {connected && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">
                <Check className="w-3 h-3" />
                Connected
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>

          {connected && username && (
            <div className="flex items-center gap-3 mt-3 p-3 bg-[#222] rounded-lg">
              {avatar ? (
                <Image
                  src={avatar}
                  alt={username}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{username}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {connected ? (
            isPrimary ? (
              <div className="text-sm text-gray-500">Cannot disconnect</div>
            ) : (
              <button
                onClick={onDisconnect}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <Unlink className="w-4 h-4" />
                Disconnect
              </button>
            )
          ) : (
            <button
              onClick={onConnect}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountsSettingsPage() {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleConnectDiscord = async () => {
    setIsLoading(true);
    try {
      // Initiate Discord OAuth flow
      await signIn("discord", {
        callbackUrl: "/settings/accounts",
      });
    } catch {
      setMessage({ type: "error", text: "Failed to initiate Discord connection" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectDiscord = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/disconnect-discord", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to disconnect");
      }

      // Update session to reflect the change
      await update();
      setMessage({ type: "success", text: "Discord account disconnected" });
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect Discord account" });
    } finally {
      setIsLoading(false);
    }
  };

  const sleeperAvatar = session?.user?.image;
  const discordAvatar = session?.user?.discordId && session?.user?.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${session.user.discordId}/${session.user.discordAvatar}.png`
    : null;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Connected Accounts"
        subtitle="Manage your connected accounts and login methods"
      />

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* Sleeper Account (Primary) */}
        <AccountCard
          provider="sleeper"
          icon={<SleeperIcon className="w-6 h-6 text-blue-400" />}
          title="Sleeper"
          description="Your primary account for fantasy league data"
          connected={true}
          username={session?.user?.username}
          avatar={sleeperAvatar}
          isPrimary={true}
          isLoading={isLoading}
        />

        {/* Discord Account */}
        <AccountCard
          provider="discord"
          icon={<DiscordIcon className="w-6 h-6 text-[#5865F2]" />}
          title="Discord"
          description="Connect to sign in with Discord and sync with your league server"
          connected={!!session?.user?.discordId}
          username={session?.user?.discordUsername}
          avatar={discordAvatar}
          onConnect={handleConnectDiscord}
          onDisconnect={handleDisconnectDiscord}
          isLoading={isLoading}
        />
      </div>

      {/* Info Section */}
      <div className="mt-8 p-5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
        <h3 className="text-base font-semibold text-white mb-2">About Connected Accounts</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">1.</span>
            <span>
              Your <strong className="text-white">Sleeper</strong> account is your primary identity and cannot be disconnected.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">2.</span>
            <span>
              Connecting <strong className="text-white">Discord</strong> allows you to sign in with either account.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">3.</span>
            <span>
              League commissioners can see Discord usernames when setting up league integrations.
            </span>
          </li>
        </ul>

        <a
          href="https://discord.com/oauth2/authorize"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 text-sm text-blue-400 hover:text-blue-300"
        >
          Learn more about Discord OAuth
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
