"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { LogoFull } from "@/components/ui/Logo";
import { ArrowLeft, Link2, User, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";

function LinkSleeperContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const discordId = searchParams.get("discordId");
  const discordUsername = searchParams.get("discordUsername");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"link" | "register">("link");

  if (!discordId) {
    return (
      <div className="min-h-screen bg-[#0F0B1A] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <LogoFull size="md" className="mx-auto mb-8" />
          <div className="bg-[#1a1a1a] border border-red-500/20 rounded-lg p-6">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Invalid Request</h2>
            <p className="text-gray-400 mb-4">
              Missing Discord information. Please try signing in again.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Try to link existing account
      const res = await fetch("/api/auth/link-discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sleeperUsername: username,
          discordId,
          discordUsername,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "NOT_REGISTERED") {
          // User doesn't have an account, show registration step
          setStep("register");
          setError(null);
        } else {
          setError(data.error || "Failed to link account");
        }
        setIsLoading(false);
        return;
      }

      // Account linked successfully, sign in
      const signInResult = await signIn("credentials", {
        username,
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Account linked but sign-in failed. Please try logging in.");
      } else {
        router.push("/leagues");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Register new account with Discord link
      const res = await fetch("/api/auth/register-with-discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sleeperUsername: username,
          email,
          discordId,
          discordUsername,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setIsLoading(false);
        return;
      }

      // Account created, sign in
      const signInResult = await signIn("credentials", {
        username,
        email,
        isRegistration: "true",
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Account created but sign-in failed. Please try logging in.");
      } else {
        router.push("/leagues");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0B1A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LogoFull size="md" className="mx-auto mb-8" />

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
          {/* Discord Info */}
          <div className="flex items-center gap-4 p-4 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-lg mb-6">
            <div className="w-12 h-12 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-400">Discord Account</p>
              <p className="text-base font-semibold text-white">{discordUsername}</p>
            </div>
            <CheckCircle className="w-5 h-5 text-[#5865F2] ml-auto" />
          </div>

          {step === "link" ? (
            <>
              <div className="text-center mb-6">
                <Link2 className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-white">Link Your Sleeper Account</h2>
                <p className="text-gray-400 mt-1">
                  Enter your Sleeper username to connect your accounts
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleLinkAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sleeper Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your Sleeper username"
                      className="w-full bg-[#222] border border-[#333] rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !username}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition-colors"
                >
                  {isLoading ? "Linking..." : "Link Account"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <User className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-white">Create Your Account</h2>
                <p className="text-gray-400 mt-1">
                  No account found for that username. Create one now.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleRegisterAndLink} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sleeper Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    disabled
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-semibold rounded-lg transition-colors"
                >
                  {isLoading ? "Creating Account..." : "Create Account & Link"}
                </button>

                <button
                  type="button"
                  onClick={() => setStep("link")}
                  className="w-full py-2 text-sm text-gray-400 hover:text-white"
                >
                  Try a different username
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-[#2a2a2a] text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0F0B1A] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <LogoFull size="md" className="mx-auto mb-8" />
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8">
          <Loader2 className="w-8 h-8 text-blue-400 mx-auto animate-spin mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default function LinkSleeperPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LinkSleeperContent />
    </Suspense>
  );
}
