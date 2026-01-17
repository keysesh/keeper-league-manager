"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Mail, User, AlertCircle, ArrowRight, UserPlus, LogIn } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_USERNAME: "Sleeper username not found. Check your spelling.",
  USERNAME_CLAIMED: "This Sleeper account is already registered. Try logging in instead.",
  EMAIL_IN_USE: "This email is already registered with a different account.",
  EMAIL_REQUIRED: "Email is required for registration.",
  NOT_REGISTERED: "This Sleeper account isn't registered yet. Sign up first.",
  EMAIL_MISMATCH: "Email doesn't match this account. Check your credentials.",
  CredentialsSignin: "Invalid credentials. Please try again.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        username: username.trim(),
        email: email.trim(),
        isRegistration: mode === "register" ? "true" : "false",
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        const errorKey = result.error;
        setError(ERROR_MESSAGES[errorKey] || "An error occurred. Please try again.");
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
      {/* Mode Toggle */}
      <div className="flex rounded-xl bg-gray-800/50 p-1 mb-6">
        <button
          type="button"
          onClick={() => { setMode("login"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "login"
              ? "bg-amber-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <LogIn className="w-4 h-4" />
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode("register"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "register"
              ? "bg-amber-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Sign Up
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-2">
            Sleeper Username
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your Sleeper username"
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
              required
              autoComplete="username"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === "register" ? "you@example.com" : "you@example.com (optional)"}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
              required={mode === "register"}
            />
          </div>
          {mode === "login" && (
            <p className="text-xs text-gray-500 mt-1.5">
              Optional for login - helps verify your identity
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !username.trim() || (mode === "register" && !email.trim())}
          className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
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

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
        <p className="text-gray-400 text-xs leading-relaxed">
          {mode === "register" ? (
            <>
              <strong className="text-gray-300">How it works:</strong> Your Sleeper username gets linked to your email.
              Only you can access your leagues and teams.
            </>
          ) : (
            <>
              <strong className="text-gray-300">First time?</strong> Click &quot;Sign Up&quot; to create your account with your Sleeper username and email.
            </>
          )}
        </p>
      </div>
    </>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-full bg-gray-700/50 rounded-xl animate-pulse" />
      <div className="space-y-4">
        <div className="h-[72px] w-full bg-gray-700/50 rounded-xl animate-pulse" />
        <div className="h-[72px] w-full bg-gray-700/50 rounded-xl animate-pulse" />
        <div className="h-12 w-full bg-gray-700/50 rounded-xl animate-pulse" />
      </div>
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

        {/* Footer */}
        <p className="text-gray-600 text-xs text-center mt-6 px-4">
          Don&apos;t have Sleeper?{" "}
          <a
            href="https://sleeper.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300"
          >
            Download it free
          </a>
        </p>
      </div>
    </div>
  );
}
