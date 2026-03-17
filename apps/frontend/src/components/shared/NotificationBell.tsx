"use client";

/**
 * @file src/components/shared/NotificationBell.tsx
 * @description 헤더 벨 아이콘 + 읽지 않은 알림 건수 뱃지 + 드롭다운 목록.
 *   60초 간격 폴링으로 알림 건수를 갱신하고, 클릭 시 최근 알림 목록을 표시한다.
 *
 * 초보자 가이드:
 * 1. 벨 아이콘을 클릭하면 최근 알림 드롭다운이 열린다.
 * 2. 각 알림을 클릭하면 읽음 처리된다.
 * 3. "모두 읽음" 버튼으로 일괄 처리 가능.
 * 4. 60초마다 읽지 않은 건수를 자동 갱신한다.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Check } from "lucide-react";
import api from "@/services/api";

/** 알림 항목 타입 */
interface Notification {
  notiId: number;
  company: string;
  jobCode: string;
  notiType: string;
  message: string;
  isRead: string;
  createdAt: string;
}

/** 폴링 간격 (ms) */
const POLL_INTERVAL = 60_000;

export default function NotificationBell() {
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /** 읽지 않은 건수 조회 */
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get("/scheduler/notifications/unread-count");
      setUnreadCount(res.data?.data ?? 0);
    } catch {
      /* 실패 시 무시 — 스케줄러 미설치 환경 호환 */
    }
  }, []);

  /** 알림 목록 조회 */
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/scheduler/notifications");
      setNotifications(res.data?.data ?? []);
    } catch {
      /* 실패 시 무시 */
    }
  }, []);

  /** 60초 폴링 */
  useEffect(() => {
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchUnreadCount]);

  /** 드롭다운 열기 시 목록 갱신 */
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  /** 외부 클릭 닫기 */
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  /** 단건 읽음 처리 */
  const handleMarkRead = async (notiId: number) => {
    try {
      await api.patch(`/scheduler/notifications/${notiId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.notiId === notiId ? { ...n, isRead: "Y" } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      /* 실패 시 무시 */
    }
  };

  /** 모두 읽음 처리 */
  const handleMarkAllRead = async () => {
    try {
      await api.patch("/scheduler/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: "Y" })));
      setUnreadCount(0);
    } catch {
      /* 실패 시 무시 */
    }
  };

  /** 알림 유형별 색상 */
  const typeColor = (type: string) => {
    switch (type) {
      case "FAIL": return "text-error";
      case "TIMEOUT": return "text-warning";
      default: return "text-success";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 벨 아이콘 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md hover:bg-background transition-colors"
        aria-label={t("scheduler.notification")}
      >
        <Bell className="w-5 h-5 text-text-muted" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-error rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-[var(--radius)] shadow-lg z-50 animate-slide-down">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-text">
              {t("scheduler.notification")}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {t("scheduler.markAllRead")}
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">
                {t("scheduler.noUnread")}
              </div>
            ) : (
              notifications.map((noti) => (
                <button
                  key={noti.notiId}
                  onClick={() => noti.isRead === "N" && handleMarkRead(noti.notiId)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-background transition-colors ${
                    noti.isRead === "N" ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 text-xs font-bold ${typeColor(noti.notiType)}`}>
                      {noti.notiType}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{noti.message}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {noti.jobCode} · {new Date(noti.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    {noti.isRead === "N" && (
                      <span className="w-2 h-2 mt-1.5 bg-primary rounded-full flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
