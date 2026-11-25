"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronRight, Filter, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { adminFetch, displayDateTime } from "@/lib/admin/client";
import type { AdminNotification, ApiPage } from "@/lib/admin/types";
import { EmptyState, PageFooter, PageHeading } from "@/components/admin/ui";

export default function NotificationsPage({ onRead }: { onRead: () => void }) {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ notifications: AdminNotification[]; unreadCount: number; page: number; limit: number; total: number; pages: number }>({ notifications: [], unreadCount: 0, page: 1, limit: 10, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  async function load() {
    setLoading(true);
    try {
      const result = await adminFetch<{ notifications: AdminNotification[]; unreadCount: number; page: number; limit: number; total: number; pages: number }>(`/api/admin/notifications?page=${page}&limit=10&unread=${unreadOnly}`);
      setData(result);
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, unreadOnly]);
  async function markAll() {
    setBusyId("all");
    try {
      await adminFetch("/api/admin/notifications", { method: "PATCH", body: JSON.stringify({ markAllRead: true }) });
      await load();
      onRead();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not mark notifications as read."); }
    finally { setBusyId(""); }
  }
  async function openNotification(item: AdminNotification) {
    if (!item.readAt) {
      setBusyId(item.id);
      try { await adminFetch(`/api/admin/notifications/${item.id}`, { method: "PATCH", body: JSON.stringify({ read: true }) }); onRead(); }
      catch (problem) { setError(problem instanceof Error ? problem.message : "Could not update notification."); }
      finally { setBusyId(""); }
    }
    const paths: Record<string, string> = { registration: item.type.includes("registration") ? "/verifications" : "/volunteers", food_donation: "/donations", requirement: "/requirements", contribution: "/contributions" };
    const destination = item.targetType ? paths[item.targetType] : undefined;
    if (destination) router.push(destination);
    else if (!item.readAt) void load();
  }
  return <>
    <PageHeading eyebrow="Inbox" title="Notifications" description="New registrations, review decisions, donations, contributions, and other activity recorded for administrators." actions={<>
      <button className={`btn ${unreadOnly ? "btn-soft" : ""}`} onClick={() => { setUnreadOnly((value) => !value); setPage(1); }}><Filter size={14} /> {unreadOnly ? "Unread only" : "All activity"}</button>
      <button className="btn" onClick={() => void markAll()} disabled={data.unreadCount === 0 || busyId === "all"}><CheckCheck size={14} /> {busyId === "all" ? "Updating…" : "Mark all read"}</button>
    </>} />
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="card" style={{ maxWidth: 940 }}>
      <div className="card-header"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="stat-icon"><Bell size={15} /></div><div><h2 className="card-title">Activity inbox</h2><p className="card-subtitle">{data.unreadCount.toLocaleString()} unread · {data.total.toLocaleString()} notifications in this view</p></div></div><span className="chart-caption">Timestamps shown in local time</span></div>
      <div className="card-body">
        {loading ? <>{Array.from({ length: 5 }, (_, index) => <div key={index} className="loading-row" />)}</> : data.notifications.length ? data.notifications.map((item) => <button key={item.id} className="notification-item" onClick={() => void openNotification(item)} disabled={busyId === item.id} style={{ width: "100%", border: 0, background: "transparent", textAlign: "left" }}>
          <span className={`notification-mark${item.readAt ? " read" : ""}`} /><span style={{ flex: 1 }}><span className="notification-title">{item.title}</span><span className="notification-message">{item.message}</span><span className="notification-date">{displayDateTime(item.createdAt)} · {item.type.replaceAll("_", " ")}</span></span><ChevronRight size={15} style={{ alignSelf: "center", color: "#99938a" }} />
        </button>) : <EmptyState title={unreadOnly ? "No unread notifications" : "No notifications yet"} description="Notifications appear when new activity is recorded in the connected database." icon={<Inbox size={19} />} />}
      </div>
    </div>
    <PageFooter page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
  </>;
}
