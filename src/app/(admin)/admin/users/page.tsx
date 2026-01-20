"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

interface User {
  id: string;
  sleeperId: string;
  displayName: string | null;
  sleeperUsername: string | null;
  avatar: string | null;
  isAdmin: boolean;
  createdAt: string;
  _count: { teamMemberships: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, { status: "success" | "error"; message: string }>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncUser = async (userId: string, sleeperId: string) => {
    setSyncing(userId);
    setSyncStatus((prev) => ({ ...prev, [userId]: undefined as any }));

    try {
      const res = await fetch("/api/admin/sync-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, sleeperId }),
      });

      const data = await res.json();

      if (res.ok) {
        setSyncStatus((prev) => ({
          ...prev,
          [userId]: { status: "success", message: `Synced ${data.leagues || 0} leagues` },
        }));
        // Refresh user list to show updated team count
        fetchUsers();
      } else {
        setSyncStatus((prev) => ({
          ...prev,
          [userId]: { status: "error", message: data.error || "Sync failed" },
        }));
      }
    } catch (error) {
      setSyncStatus((prev) => ({
        ...prev,
        [userId]: { status: "error", message: "Sync failed" },
      }));
    } finally {
      setSyncing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <div className="text-gray-400">{users.length} users</div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-gray-400 font-medium">User</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Username</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Teams</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Role</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Joined</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-850">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.avatar ? (
                      <img
                        src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                        alt={user.displayName || ""}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
                        {user.displayName?.charAt(0) || "?"}
                      </div>
                    )}
                    <span className="text-white">{user.displayName || "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400">{user.sleeperUsername || "—"}</td>
                <td className="px-4 py-3 text-gray-400">{user._count.teamMemberships}</td>
                <td className="px-4 py-3">
                  {user.isAdmin ? (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                      Admin
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs font-medium">
                      User
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {syncStatus[user.id]?.status === "success" ? (
                      <div className="flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle className="w-4 h-4" />
                        <span>{syncStatus[user.id].message}</span>
                      </div>
                    ) : syncStatus[user.id]?.status === "error" ? (
                      <div className="flex items-center gap-1 text-red-400 text-xs">
                        <XCircle className="w-4 h-4" />
                        <span>{syncStatus[user.id].message}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSyncUser(user.id, user.sleeperId)}
                        disabled={syncing === user.id}
                        className="px-3 py-1.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncing === user.id ? "animate-spin" : ""}`} />
                        {syncing === user.id ? "Syncing..." : "Sync Leagues"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
