import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Clock, User, FileText, Search } from "lucide-react";

interface SearchParams {
  entity?: string;
  action?: string;
  page?: string;
}

async function getAuditLogs(searchParams: SearchParams) {
  const page = parseInt(searchParams.page || "1");
  const limit = 50;
  const skip = (page - 1) * limit;

  const where: {
    entity?: string;
    action?: string;
  } = {};

  if (searchParams.entity) {
    where.entity = searchParams.entity;
  }
  if (searchParams.action) {
    where.action = searchParams.action;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Fetch user info separately since AuditLog doesn't have a user relation
  const userIds = logs.map((l) => l.userId).filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, sleeperUsername: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return { logs, total, page, limit, userMap };
}

async function getEntityTypes() {
  const entities = await prisma.auditLog.findMany({
    distinct: ["entity"],
    select: { entity: true },
  });
  return entities.map((e) => e.entity).filter(Boolean);
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { logs, total, page, limit, userMap } = await getAuditLogs(params);
  const entityTypes = await getEntityTypes();
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Audit Log</h1>
        <p className="text-gray-400 mt-1">View all system activity and changes</p>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <form className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Entity Type</label>
            <select
              name="entity"
              defaultValue={params.entity || ""}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white min-w-40"
            >
              <option value="">All Entities</option>
              {entityTypes.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Action</label>
            <select
              name="action"
              defaultValue={params.action || ""}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white min-w-40"
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-white font-medium transition-colors"
            >
              <Search className="w-4 h-4" />
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-400">
        <span>Total: {total.toLocaleString()} entries</span>
        <span>Page {page} of {totalPages}</span>
      </div>

      {/* Logs Table */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Timestamp</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">User</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Action</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Entity</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Clock className="w-4 h-4" />
                      {formatDate(log.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-white">
                        {log.userId ? (userMap.get(log.userId)?.displayName || userMap.get(log.userId)?.sleeperUsername || "Unknown") : "System"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-300 font-mono text-sm">{log.entity}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <LogDetails log={log} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/audit?page=${page - 1}&entity=${params.entity || ""}&action=${params.action || ""}`}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2 text-gray-400">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/audit?page=${page + 1}&entity=${params.entity || ""}&action=${params.action || ""}`}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    CREATE: "bg-green-500/20 text-green-400",
    UPDATE: "bg-blue-500/20 text-blue-400",
    DELETE: "bg-red-500/20 text-red-400",
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${colors[action] || "bg-gray-500/20 text-gray-400"}`}
    >
      {action}
    </span>
  );
}

function LogDetails({ log }: { log: { newValue: unknown; oldValue: unknown; entityId: string | null } }) {
  const changes: string[] = [];

  if (log.newValue && typeof log.newValue === "object") {
    const value = log.newValue as Record<string, unknown>;
    if (value.title) changes.push(`Title: ${value.title}`);
    if (value.status) changes.push(`Status: ${value.status}`);
    if (value.type) changes.push(`Type: ${value.type}`);
  }

  return (
    <div className="text-sm text-gray-400 max-w-xs truncate">
      {changes.length > 0 ? changes.join(" | ") : log.entityId ? `ID: ${log.entityId}` : "—"}
    </div>
  );
}
