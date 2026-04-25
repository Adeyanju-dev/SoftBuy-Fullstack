import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BriefcaseBusiness,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShoppingBag,
  UserCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatAddress, formatDate } from "../lib/formatters";
import softbuyApi from "../lib/softbuyApi";

export default function ProfilePage() {
  const { user, refreshProfile, isSeller, enableSellerAccess } = useAuth();
  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [sellerLoading, setSellerLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPageData = async () => {
      try {
        await refreshProfile();
      } catch (error) {
        console.warn("Could not refresh profile:", error);
      }

      try {
        const ordersResponse = await softbuyApi.listOrders(1);
        if (active) {
          setRecentOrders(softbuyApi.extractResults(ordersResponse.data).slice(0, 3));
        }
      } catch {
        if (active) {
          setRecentOrders([]);
        }
      } finally {
        if (active) {
          setLoadingOrders(false);
        }
      }
    };

    loadPageData();

    return () => {
      active = false;
    };
  }, [refreshProfile]);

  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.trim() || "SB";

  const handleEnableSellerAccess = async () => {
    setSellerLoading(true);

    try {
      await enableSellerAccess();
    } finally {
      setSellerLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Profile</p>
            <h1 className="text-4xl font-black text-white">Your SoftBuy account</h1>
            <p className="mt-2 text-sm text-slate-400">Manage your personal details and recent activity.</p>
          </div>
          <button
            type="button"
            onClick={() => refreshProfile()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh profile
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-5 border-b border-white/10 pb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-2xl font-black text-slate-950">
                {initials}
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-white">
                  {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || "SoftBuy User"}
                </h2>
                <p className="text-sm text-slate-400">
                  {isSeller ? "Seller" : "Buyer"} account
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                <h3 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-white">
                  <UserCircle2 className="h-5 w-5 text-cyan-200" />
                  Personal info
                </h3>
                <div className="space-y-3 text-sm text-slate-300">
                  <p className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-500" />
                    {user?.email}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-500" />
                    {user?.phone_number || "No phone number added"}
                  </p>
                  <p className="text-slate-400">
                    Email verified: {user?.email_verified ? "Yes" : "No"}
                  </p>
                  <p className="text-slate-400">
                    Preferred currency: {user?.profile?.preferred_currency || "NGN"}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                <h3 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-white">
                  <MapPin className="h-5 w-5 text-cyan-200" />
                  Saved addresses
                </h3>
                <div className="space-y-3 text-sm text-slate-300">
                  {user?.addresses?.slice(0, 2).map((address) => (
                    <div key={address.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="font-medium text-white">{address.address_type}</p>
                      <p className="mt-1 text-slate-400">{formatAddress(address)}</p>
                    </div>
                  ))}
                  {!user?.addresses?.length ? (
                    <p className="text-slate-400">No addresses saved yet.</p>
                  ) : null}
                  <Link to="/addresses" className="inline-flex text-cyan-200">
                    Manage addresses
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div>
              <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
                <ShoppingBag className="h-5 w-5 text-cyan-200" />
                Recent orders
              </h3>
              <div className="mt-4 space-y-3">
                {loadingOrders ? (
                  <div className="h-28 animate-pulse rounded-3xl border border-white/10 bg-slate-900/50" />
                ) : recentOrders.length > 0 ? (
                  recentOrders.map((order) => (
                    <Link
                      key={order.order_number}
                      to={`/orders/${order.order_number}`}
                      className="block rounded-3xl border border-white/10 bg-slate-900/50 p-4"
                    >
                      <p className="font-medium text-white">{order.order_number}</p>
                      <p className="mt-1 text-sm text-slate-400">{formatDate(order.created_at)}</p>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">You have not placed any orders yet.</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {isSeller ? (
                <Link
                  to="/seller"
                  className="block rounded-full border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-center text-sm font-medium text-cyan-100"
                >
                  <span className="inline-flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4" />
                    Open seller dashboard
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableSellerAccess}
                  disabled={sellerLoading}
                  className="block w-full rounded-full border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-center text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4" />
                    {sellerLoading ? "Enabling seller access..." : "Start selling on SoftBuy"}
                  </span>
                </button>
              )}
              <Link
                to="/settings"
                className="block rounded-full border border-white/10 px-5 py-3 text-center text-sm font-medium text-white"
              >
                Open account center
              </Link>
              <Link
                to="/payments"
                className="block rounded-full border border-white/10 px-5 py-3 text-center text-sm font-medium text-white"
              >
                View payments
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
