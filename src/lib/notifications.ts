import { prisma } from "./prisma";
import { NotificationType, Prisma } from "@prisma/client";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

interface BulkNotificationParams {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
    },
  });
}

export async function createBulkNotifications(params: BulkNotificationParams) {
  const notifications = params.userIds.map((userId) => ({
    userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata,
  }));

  return prisma.notification.createMany({
    data: notifications,
    skipDuplicates: true,
  });
}

export async function getUserNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
) {
  const { unreadOnly = false, limit = 50, offset = 0 } = options;

  const where = unreadOnly ? { userId, isRead: false } : { userId };

  const [notifications, unreadCount, totalCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return { notifications, unreadCount, totalCount };
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function deleteNotification(notificationId: string, userId: string) {
  return prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  });
}

export async function notifyTradeProposed(params: {
  proposalId: string;
  proposerName: string;
  leagueId: string;
  leagueName: string;
  involvedUserIds: string[];
  leagueUserIds: string[];
}) {
  const link = `/league/${params.leagueId}/trade-proposals/${params.proposalId}`;

  // Notify involved parties
  await createBulkNotifications({
    userIds: params.involvedUserIds,
    type: "TRADE_PROPOSED",
    title: "New Trade Proposal",
    message: `${params.proposerName} proposed a trade involving your team in ${params.leagueName}`,
    link,
    entityType: "TradeProposal",
    entityId: params.proposalId,
  });

  // Notify other league members (excluding involved parties)
  const otherMembers = params.leagueUserIds.filter(
    (id) => !params.involvedUserIds.includes(id)
  );

  if (otherMembers.length > 0) {
    await createBulkNotifications({
      userIds: otherMembers,
      type: "TRADE_PROPOSED",
      title: "New Trade Proposal",
      message: `${params.proposerName} proposed a trade in ${params.leagueName}`,
      link,
      entityType: "TradeProposal",
      entityId: params.proposalId,
    });
  }
}

export async function notifyTradeStatusChanged(params: {
  proposalId: string;
  status: "ACCEPTED" | "REJECTED" | "COUNTERED" | "EXPIRED" | "VETOED";
  leagueId: string;
  leagueName: string;
  userIds: string[];
  actionByName?: string;
}) {
  const link = `/league/${params.leagueId}/trade-proposals/${params.proposalId}`;

  const statusMessages: Record<string, { title: string; message: string }> = {
    ACCEPTED: {
      title: "Trade Accepted",
      message: `A trade has been accepted in ${params.leagueName}`,
    },
    REJECTED: {
      title: "Trade Rejected",
      message: params.actionByName
        ? `${params.actionByName} rejected the trade in ${params.leagueName}`
        : `A trade was rejected in ${params.leagueName}`,
    },
    COUNTERED: {
      title: "Trade Countered",
      message: params.actionByName
        ? `${params.actionByName} countered the trade in ${params.leagueName}`
        : `A trade was countered in ${params.leagueName}`,
    },
    EXPIRED: {
      title: "Trade Expired",
      message: `A trade proposal has expired in ${params.leagueName}`,
    },
    VETOED: {
      title: "Trade Vetoed",
      message: `A trade has been vetoed by the league in ${params.leagueName}`,
    },
  };

  const { title, message } = statusMessages[params.status];
  const notificationType = `TRADE_${params.status}` as NotificationType;

  await createBulkNotifications({
    userIds: params.userIds,
    type: notificationType,
    title,
    message,
    link,
    entityType: "TradeProposal",
    entityId: params.proposalId,
  });
}

export async function notifyKeeperDeadline(params: {
  leagueId: string;
  leagueName: string;
  deadline: Date;
  userIds: string[];
  hoursRemaining: number;
}) {
  const link = `/league/${params.leagueId}`;

  await createBulkNotifications({
    userIds: params.userIds,
    type: "KEEPER_DEADLINE",
    title: "Keeper Deadline Approaching",
    message: `Only ${params.hoursRemaining} hours left to set your keepers in ${params.leagueName}`,
    link,
    entityType: "League",
    entityId: params.leagueId,
    metadata: { deadline: params.deadline.toISOString() },
  });
}
