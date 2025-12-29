import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AlertTriangle, Clock, Globe, User, Code } from "lucide-react";

async function getErrorStats() {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [errorsLast24h, errorsLast7d, recentErrors] = await Promise.all([
    prisma.auditLog.count({
      where: {
        action: "ERROR",
        entity: "ErrorLog",
        createdAt: { gte: last24Hours },
      },
    }),
    prisma.auditLog.count({
      where: {
        action: "ERROR",
        entity: "ErrorLog",
        createdAt: { gte: last7Days },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        action: "ERROR",
        entity: "ErrorLog",
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  // Group by error type
  const errorsByType = await prisma.auditLog.groupBy({
    by: ["entityId"],
    where: {
      action: "ERROR",
      entity: "ErrorLog",
      createdAt: { gte: last7Days },
    },
    _count: { id: true },
  });

  return {
    errorsLast24h,
    errorsLast7d,
    recentErrors,
    errorsByType,
  };
}

export default async function ErrorsPage() {
  const stats = await getErrorStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Error Monitoring</h1>
        <p className="text-gray-400 mt-1">Track and analyze application errors</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Last 24 Hours</p>
              <p className="text-2xl font-bold text-white">{stats.errorsLast24h}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Last 7 Days</p>
              <p className="text-2xl font-bold text-white">{stats.errorsLast7d}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">By Type</h3>
          <div className="space-y-2">
            {stats.errorsByType.map((e) => (
              <div key={e.entityId} className="flex justify-between text-sm">
                <span className="text-gray-300">{e.entityId}</span>
                <span className="text-white font-medium">{e._count.id}</span>
              </div>
            ))}
            {stats.errorsByType.length === 0 && (
              <p className="text-gray-500 text-sm">No errors in the last 7 days</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Recent Errors</h2>
        </div>

        {stats.recentErrors.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p>No errors recorded</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {stats.recentErrors.map((error) => {
              const data = error.newValue as Record<string, unknown> | null;
              return (
                <div key={error.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <Code className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          error.entityId === "client_error"
                            ? "bg-red-500/20 text-red-400"
                            : error.entityId === "api_error"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}>
                          {error.entityId}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {formatDate(error.createdAt)}
                        </span>
                      </div>
                      <p className="text-white font-medium truncate">
                        {data?.message ? String(data.message) : "Unknown error"}
                      </p>
                      {data?.url && typeof data.url === "string" ? (
                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                          <Globe className="w-3 h-3" />
                          <span className="truncate">{data.url}</span>
                        </div>
                      ) : null}
                      {error.userId && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                          <User className="w-3 h-3" />
                          <span>User: {error.userId.slice(0, 8)}...</span>
                        </div>
                      )}
                      {data?.stack && typeof data.stack === "string" ? (
                        <details className="mt-2">
                          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                            Stack trace
                          </summary>
                          <pre className="mt-2 text-xs text-gray-500 bg-gray-800/50 rounded p-2 overflow-auto max-h-32">
                            {data.stack.slice(0, 500)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-center">
        <Link
          href="/admin/audit?entity=ErrorLog"
          className="text-amber-400 hover:text-amber-300 text-sm font-medium"
        >
          View all in Audit Log &rarr;
        </Link>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
