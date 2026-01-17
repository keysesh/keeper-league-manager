"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { logger } from "@/lib/logger";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.pagination.unread);
      }
    } catch (error) {
      logger.error("Failed to fetch notifications", error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", notificationId }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      logger.error("Failed to mark notification as read", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      setLoading(true);
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      logger.error("Failed to mark all as read", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications?id=${notificationId}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      const wasUnread = notifications.find((n) => n.id === notificationId && !n.isRead);
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      logger.error("Failed to delete notification", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClasses: Record<string, string> = {
      TRADE_PROPOSED: "bg-blue-500/20 text-blue-400",
      TRADE_ACCEPTED: "bg-green-500/20 text-green-400",
      TRADE_REJECTED: "bg-red-500/20 text-red-400",
      TRADE_COUNTERED: "bg-amber-500/20 text-amber-400",
      TRADE_EXPIRED: "bg-zinc-500/20 text-zinc-400",
      TRADE_VOTE: "bg-amber-500/20 text-amber-400",
      KEEPER_DEADLINE: "bg-orange-500/20 text-orange-400",
      KEEPER_LOCKED: "bg-emerald-500/20 text-emerald-400",
      LEAGUE_SYNC: "bg-amber-500/20 text-amber-400",
      SYSTEM: "bg-zinc-500/20 text-zinc-400",
    };
    return iconClasses[type] || iconClasses.SYSTEM;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-[#13111a]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <h3 className="font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={loading}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 disabled:opacity-50"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/[0.05] rounded"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors ${
                      !notification.isRead ? "bg-amber-500/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getNotificationIcon(
                          notification.type
                        )}`}
                      >
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {notification.link ? (
                          <Link
                            href={notification.link}
                            onClick={() => {
                              if (!notification.isRead) markAsRead(notification.id);
                              setIsOpen(false);
                            }}
                            className="block"
                          >
                            <p className="text-sm font-medium text-white truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-zinc-400 line-clamp-2">
                              {notification.message}
                            </p>
                          </Link>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-white truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-zinc-400 line-clamp-2">
                              {notification.message}
                            </p>
                          </>
                        )}
                        <p className="text-xs text-zinc-600 mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 hover:bg-white/[0.05] rounded"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3 text-zinc-500" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 hover:bg-white/[0.05] rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3 text-zinc-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-white/[0.06]">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
