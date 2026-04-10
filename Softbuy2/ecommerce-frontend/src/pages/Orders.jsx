import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "../lib/formatters";
import softbuyApi from "../lib/softbuyApi";

const statusStyles = {
  pending_payment: "bg-amber-500/15 text-amber-200",
  paid: "bg-emerald-500/15 text-emerald-200",
  processing: "bg-blue-500/15 text-blue-200",
  shipped: "bg-violet-500/15 text-violet-200",
  delivered: "bg-emerald-500/15 text-emerald-200",
  cancelled: "bg-rose-500/15 text-rose-200",
  refunded: "bg-slate-500/15 text-slate-200",
  returned: "bg-slate-500/15 text-slate-200",
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadOrders = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await softbuyApi.listAllOrders();
        if (active) {
          setOrders(softbuyApi.extractResults(response.data));
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.response?.data?.error || "Could not load your orders.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Orders</p>
          <h1 className="text-4xl font-black text-white">Your order history</h1>
          <p className="mt-2 text-sm text-slate-400">Track purchases and open each order for more details.</p>
        </div>

        {loading ? (
          <div className="h-80 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : error ? (
          <div className="rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-8 text-sm text-rose-100">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-xl font-semibold text-white">No orders yet</p>
            <p className="mt-2 text-sm text-slate-400">Place your first order from the catalog.</p>
            <Link
              to="/products"
              className="mt-6 inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <article
                key={order.order_number}
                className="grid gap-5 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl lg:grid-cols-[1.5fr_0.7fr_0.8fr_auto]"
              >
                <div>
                  <p className="text-sm text-slate-400">Order number</p>
                  <p className="text-xl font-semibold text-white">{order.order_number}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {order.items?.length || 0} item(s) • {formatDate(order.created_at)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Total</p>
                  <p className="text-lg font-semibold text-cyan-200">
                    {formatCurrency(order.total_amount, order.currency || "NGN")}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Status</p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      statusStyles[order.status] || "bg-slate-500/15 text-slate-200"
                    }`}
                  >
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="flex items-center justify-start lg:justify-end">
                  <Link
                    to={`/orders/${order.order_number}`}
                    className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-slate-200"
                  >
                    View details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
