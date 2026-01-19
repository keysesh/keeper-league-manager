"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { EPluribusLogo } from "@/components/ui/Logo";
import { DiscordIcon } from "@/components/ui/Icons";
import { AlertCircle, Loader2 } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "This account is linked to a different sign-in method.",
  OAuthCallback: "There was a problem connecting to Discord. Please try again.",
  OAuthCreateAccount: "Could not create your account. Please try again.",
  OAuthSignin: "Error signing in with Discord. Please try again.",
  SessionRequired: "Please sign in to continue.",
  CredentialsSignin: "Invalid credentials. Please try again.",
  default: "An unexpected error occurred. Please try again.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = searchParams.get("callbackUrl") || "/leagues";
  const errorParam = searchParams.get("error");

  const displayError = error || (errorParam ? (ERROR_MESSAGES[errorParam] || ERROR_MESSAGES.default) : null);

  const handleDiscordSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await signIn("discord", { callbackUrl });
    } catch {
      setError("Failed to connect to Discord. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Error Message */}
      {displayError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{displayError}</p>
        </div>
      )}

      {/* Discord Sign In Button */}
      <button
        onClick={handleDiscordSignIn}
        disabled={isLoading}
        className="w-full min-h-[52px] py-4 px-6 rounded-xl font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3c45a5] active:scale-[0.98] flex items-center justify-center gap-3 transition-all duration-200 ease-out shadow-lg shadow-[#5865F2]/25 hover:shadow-xl hover:shadow-[#5865F2]/30 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 focus:ring-offset-2 focus:ring-offset-[#0d1420] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Connecting to Discord...
          </>
        ) : (
          <>
            <DiscordIcon className="w-5 h-5" />
            Continue with Discord
          </>
        )}
      </button>

      {/* Info Text */}
      <p className="text-sm text-slate-500 text-center mt-6">
        Sign in to verify identity and link your Sleeper account
      </p>

      {/* Divider */}
      <div className="my-6 border-t border-white/[0.06]" />

      {/* Sleeper Info */}
      <div className="text-center">
        <p className="text-slate-500 text-sm">
          Don&apos;t have Sleeper?{" "}
          <a
            href="https://sleeper.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            Download it free
          </a>
        </p>
      </div>
    </>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-6">
      <div className="h-[52px] w-full bg-white/[0.03] rounded-xl animate-pulse" />
      <div className="h-4 w-48 mx-auto bg-white/[0.03] rounded animate-pulse" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] relative overflow-hidden">
      {/* Gradient orbs for depth */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl shadow-2xl shadow-black/50 p-8">
            {/* Logo/Header */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-5">
                <EPluribusLogo size="xl" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">E Pluribus</h1>
              <p className="text-sm text-slate-400 font-medium mt-1">Keeper League Manager</p>
            </div>

            <Suspense fallback={<LoginFormFallback />}>
              <LoginContent />
            </Suspense>
          </div>

          {/* Footer */}
          <p className="text-slate-600 text-xs text-center mt-6">
            Out of Many, One Champion
          </p>
        </div>
      </div>
    </div>
  );
}
