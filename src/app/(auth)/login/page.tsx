"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { EPluribusLogo } from "@/components/ui/Logo";
import { DiscordIcon } from "@/components/ui/Icons";
import { AlertCircle, Loader2, User, Mail, ArrowRight, LogIn, UserPlus } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "This account is linked to a different sign-in method.",
  OAuthCallback: "Discord is not configured. Use Sleeper login below.",
  OAuthCreateAccount: "Could not create your account. Please try again.",
  OAuthSignin: "Discord is not configured. Use Sleeper login below.",
  SessionRequired: "Please sign in to continue.",
  CredentialsSignin: "Invalid credentials. Please try again.",
  INVALID_USERNAME: "Sleeper username not found. Check your spelling.",
  USERNAME_CLAIMED: "This Sleeper account is already registered. Try logging in instead.",
  EMAIL_IN_USE: "This email is already registered with a different account.",
  EMAIL_REQUIRED: "Email is required for registration.",
  NOT_REGISTERED: "This Sleeper account isn't registered yet. Sign up first.",
  EMAIL_MISMATCH: "Email doesn't match this account. Check your credentials.",
  default: "An unexpected error occurred. Please try again.",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSleeperLogin, setShowSleeperLogin] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const callbackUrl = searchParams.get("callbackUrl") || "/leagues";
  const errorParam = searchParams.get("error");

  // Show Sleeper login if Discord fails
  const hasDiscordError = errorParam === "OAuthSignin" || errorParam === "OAuthCallback";
  const displayError = error || (errorParam && !hasDiscordError ? (ERROR_MESSAGES[errorParam] || ERROR_MESSAGES.default) : null);

  const handleDiscordSignIn = async () => {
    setIsDiscordLoading(true);
    setError(null);
    try {
      await signIn("discord", { callbackUrl });
    } catch {
      setError("Failed to connect to Discord. Please try again.");
      setIsDiscordLoading(false);
    }
  };

  const handleSleeperSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        username: username.trim(),
        email: email.trim(),
        isRegistration: mode === "register" ? "true" : "false",
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(ERROR_MESSAGES[result.error] || "An error occurred. Please try again.");
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
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
      {!showSleeperLogin && !hasDiscordError && (
        <>
          <button
            onClick={handleDiscordSignIn}
            disabled={isDiscordLoading}
            className="w-full min-h-[52px] py-4 px-6 rounded-xl font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3c45a5] active:scale-[0.98] flex items-center justify-center gap-3 transition-all duration-200 ease-out shadow-lg shadow-[#5865F2]/25 hover:shadow-xl hover:shadow-[#5865F2]/30 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 focus:ring-offset-2 focus:ring-offset-[#0d1420] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isDiscordLoading ? (
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

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 border-t border-white/[0.06]" />
            <span className="text-xs text-slate-500 font-medium">or</span>
            <div className="flex-1 border-t border-white/[0.06]" />
          </div>

          <button
            onClick={() => setShowSleeperLogin(true)}
            className="w-full min-h-[44px] py-3 px-4 rounded-xl font-medium text-slate-300 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12] flex items-center justify-center gap-2 transition-all"
          >
            <User className="w-4 h-4" />
            Sign in with Sleeper Username
          </button>
        </>
      )}

      {/* Sleeper Username Login */}
      {(showSleeperLogin || hasDiscordError) && (
        <>
          {/* Mode Toggle */}
          <div className="flex rounded-lg bg-white/[0.03] p-1 mb-6 border border-white/[0.06]">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                mode === "login"
                  ? "bg-blue-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                mode === "register"
                  ? "bg-blue-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSleeperSignIn} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-400 mb-2">
                Sleeper Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your Sleeper username"
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === "register" ? "you@example.com" : "you@example.com (optional)"}
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  required={mode === "register"}
                />
              </div>
              {mode === "login" && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Optional for login - helps verify your identity
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !username.trim() || (mode === "register" && !email.trim())}
              className="w-full min-h-[48px] py-3 px-4 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {mode === "register" ? "Creating account..." : "Signing in..."}
                </>
              ) : (
                <>
                  {mode === "register" ? "Create Account" : "Sign In"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {!hasDiscordError && (
            <button
              onClick={() => setShowSleeperLogin(false)}
              className="w-full mt-4 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Back to Discord login
            </button>
          )}
        </>
      )}

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
      <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl" />

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
