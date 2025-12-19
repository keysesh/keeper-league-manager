import { prisma } from "@/lib/prisma";

async function getUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      sleeperUsername: true,
      email: true,
      avatar: true,
      isAdmin: true,
      createdAt: true,
      _count: {
        select: { teamMemberships: true },
      },
    },
  });
}

export default async function AdminUsersPage() {
  const users = await getUsers();

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
