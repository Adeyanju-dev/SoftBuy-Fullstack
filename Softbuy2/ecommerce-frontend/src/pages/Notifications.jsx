import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { capitalizeWords, formatDateTime } from "../lib/formatters";
import softbuyApi from "../lib/softbuyApi";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await softbuyApi.listAllNotifications();
      setNotifications(softbuyApi.extractResults(response.data));
    } catch (loadError) {
      setError(loadError.response?.data?.error || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markRead = async (id) => {
    await softbuyApi.markNotificationRead(id);
    window.dispatchEvent(new Event("notificationsChanged"));
    await loadNotifications();
  };

  const markAllRead = async () => {
    await softbuyApi.markAllNotificationsRead();
    window.dispatchEvent(new Event("notificationsChanged"));
    await loadNotifications();
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Notifications</p>
            <h1 className="text-4xl font-black text-white">Notification inbox</h1>
            <p className="mt-2 text-sm text-slate-400">
              Connected to the notifications app.
            </p>
          </div>
          <button
            type="button"
            onClick={markAllRead}
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-slate-200"
          >
            Mark all as read
          </button>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="h-80 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-[2rem] border p-5 backdrop-blur-xl ${
                  notification.is_read
                    ? "border-white/10 bg-white/5"
                    : "border-cyan-400/30 bg-cyan-500/10"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{notification.title}</p>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                        {capitalizeWords(notification.notification_type)}
                      </span>
                    </div>
                    <p className="text-sm leading-7 text-slate-300">{notification.message}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(notification.created_at)}
                    </p>
                  </div>

                  {!notification.is_read ? (
                    <button
                      type="button"
                      onClick={() => markRead(notification.id)}
                      className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200"
                    >
                      Mark read
                    </button>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200">
                      Read
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center">
            <BellRing className="mx-auto h-10 w-10 text-slate-500" />
            <p className="mt-4 text-lg font-semibold text-white">No notifications yet</p>
            <p className="mt-2 text-sm text-slate-400">
              Order, payment, and system alerts will appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
