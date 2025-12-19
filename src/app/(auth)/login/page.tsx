"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-semibold text-gray-400 mb-2"
          >
            Sleeper Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your Sleeper username"
            className="w-full px-4 py-3.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
            required
            autoComplete="username"
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !username.trim()}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/40"
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
            "Continue"
          )}
        </button>
      </form>
    </>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-5 w-32 bg-gray-700 rounded mb-2 animate-pulse" />
        <div className="h-12 w-full bg-gray-700 rounded-lg animate-pulse" />
      </div>
      <div className="h-12 w-full bg-gray-700 rounded-lg animate-pulse" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0c0e] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-900/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-900/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md px-6 relative z-10">
        <div className="card-premium rounded-3xl shadow-2xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 mb-5 shadow-xl shadow-purple-500/30">
              <span className="text-4xl">🏈</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">E Pluribus</h1>
            <p className="text-purple-400 font-semibold text-sm mt-1">Keeper Tracker</p>
            <p className="text-gray-500 mt-4">
              Sign in with your Sleeper username
            </p>
          </div>

          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 text-sm">
              Don&apos;t have a Sleeper account?{" "}
              <a
                href="https://sleeper.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors font-semibold"
              >
                Download Sleeper
              </a>
            </p>
          </div>
        </div>

        {/* Info Text */}
        <p className="text-gray-600 text-xs text-center mt-6 px-4">
          We use your Sleeper username to access your public league data.
          No password is required or stored.
        </p>
      </div>
    </div>
  );
}
