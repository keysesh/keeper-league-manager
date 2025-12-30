import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/lib/notifications";

function createApiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, details, timestamp: new Date().toISOString() },
    { status }
  );
}

/**
 * GET /api/notifications
 * Get user's notifications
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return createApiError("Authentication required", 401);
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const { notifications, unreadCount, totalCount } = await getUserNotifications(
      session.user.id,
      { unreadOnly, limit, offset }
    );

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        isRead: n.isRead,
        entityType: n.entityType,
        entityId: n.entityId,
        metadata: n.metadata,
        createdAt: n.createdAt.toISOString(),
      })),
      pagination: {
        total: totalCount,
        unread: unreadCount,
        limit,
        offset,
        hasMore: offset + notifications.length < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    // If table doesn't exist, return empty results
    if (error instanceof Error && error.message.includes("does not exist")) {
      return NextResponse.json({
        notifications: [],
        pagination: { total: 0, unread: 0, limit: 50, offset: 0, hasMore: false },
      });
    }
    return createApiError(
      "Failed to fetch notifications",
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * POST /api/notifications
 * Mark notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return createApiError("Authentication required", 401);
    }

    const body = await request.json();
    const { action, notificationId } = body;

    if (action === "markAllRead") {
      await markAllNotificationsAsRead(session.user.id);
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (action === "markRead" && notificationId) {
      await markNotificationAsRead(notificationId, session.user.id);
      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    return createApiError("Invalid action", 400);
  } catch (error) {
    console.error("Error updating notifications:", error);
    return createApiError(
      "Failed to update notifications",
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * DELETE /api/notifications
 * Delete a notification
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return createApiError("Authentication required", 401);
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get("id");

    if (!notificationId) {
      return createApiError("Notification ID required", 400);
    }

    await deleteNotification(notificationId, session.user.id);
    return NextResponse.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return createApiError(
      "Failed to delete notification",
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}
