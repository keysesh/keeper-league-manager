"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Mail, Link as LinkIcon, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUsernameForm, setShowUsernameForm] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        username: username.trim(),
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Invalid Sleeper username. Please try again.");
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
      {/* Invite Link Notice */}
      <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <LinkIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-semibold text-sm">Invite-Only Access</p>
            <p className="text-gray-400 text-sm mt-1">
              Team owners need an invite link from their league commissioner to access this app.
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Primary CTA - Got an invite */}
      <div className="text-center mb-6">
        <p className="text-gray-400 text-sm mb-4">
          Got an invite link? Click it to join your league.
        </p>
        <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
          <p className="text-gray-500 text-xs">
            Invite links look like:
          </p>
          <code className="text-amber-400 text-xs mt-1 block">
            keeper-league-manager.vercel.app/invite/abc123...
          </code>
        </div>
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-700/50"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-[#161514] text-gray-500">or</span>
        </div>
      </div>

      {/* Commissioner Login */}
      {!showUsernameForm ? (
        <button
          onClick={() => setShowUsernameForm(true)}
          className="w-full py-3 px-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-gray-300 font-medium rounded-xl transition-all text-sm"
        >
          Commissioner? Sign in with Sleeper username
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-400 mb-2"
            >
              Sleeper Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your Sleeper username"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowUsernameForm(false)}
            className="w-full py-2 text-gray-500 hover:text-gray-400 text-sm transition-colors"
          >
            Cancel
          </button>
        </form>
      )}
    </>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-6">
      <div className="h-24 w-full bg-gray-700/50 rounded-xl animate-pulse" />
      <div className="h-12 w-full bg-gray-700/50 rounded-lg animate-pulse" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0c0a] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-amber-900/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-orange-900/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md px-6 relative z-10">
        <div className="card-premium rounded-3xl shadow-2xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <Logo size="xl" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">E Pluribus</h1>
            <p className="text-amber-400 font-semibold text-sm mt-1">Keeper Tracker</p>
          </div>

          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Info Text */}
        <p className="text-gray-600 text-xs text-center mt-6 px-4">
          Commissioners can log in with their Sleeper username to set up leagues and generate invite links for team owners.
        </p>
      </div>
    </div>
  );
}
