import {
  Bell,
  BriefcaseBusiness,
  CreditCard,
  MapPinned,
  Package,
  Settings as SettingsIcon,
  ShoppingBag,
  Star,
  Store,
  UserCircle2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const accountCards = [
  {
    title: "Profile",
    description: "Update your personal details and account information.",
    icon: UserCircle2,
    to: "/profile",
  },
  {
    title: "Addresses",
    description: "Manage your delivery and billing addresses.",
    icon: MapPinned,
    to: "/addresses",
  },
  {
    title: "Orders",
    description: "Review purchases and track each order.",
    icon: Package,
    to: "/orders",
  },
  {
    title: "Payments",
    description: "See your payment activity and checkout updates.",
    icon: CreditCard,
    to: "/payments",
  },
  {
    title: "Notifications",
    description: "Stay on top of important alerts and shopping updates.",
    icon: Bell,
    to: "/notifications",
  },
  {
    title: "Reviews",
    description: "Read feedback and write reviews for products you bought.",
    icon: Star,
    to: "/reviews",
  },
];

const sellerCards = [
  {
    title: "Seller dashboard",
    description: "Track your store performance and latest activity.",
    icon: Store,
    to: "/seller",
  },
  {
    title: "Seller profile",
    description: "Manage business details, verification, and payout information.",
    icon: BriefcaseBusiness,
    to: "/seller/profile",
  },
  {
    title: "Products",
    description: "Create products, update listings, and upload product images.",
    icon: ShoppingBag,
    to: "/seller/products",
  },
  {
    title: "Payouts",
    description: "Request payouts and review store transactions.",
    icon: CreditCard,
    to: "/seller/payouts",
  },
  {
    title: "Seller reviews",
    description: "Moderate store feedback and manage approval.",
    icon: Star,
    to: "/seller/reviews",
  },
];

function SettingsCard({ title, description, icon: Icon, to }) {
  return (
    <Link
      to={to}
      className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-400/30"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </Link>
  );
}

export default function Settings() {
  const { user, isSeller, enableSellerAccess } = useAuth();
  const firstName = user?.first_name || "There";
  const [sellerLoading, setSellerLoading] = useState(false);

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
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Account center</p>
          <h1 className="mt-3 text-4xl font-black text-white">Welcome back, {firstName}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Keep your profile, orders, payments, reviews, and saved details organized from one
            place.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accountCards.map((card) => (
            <SettingsCard key={card.title} {...card} />
          ))}
        </div>

        {isSeller ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Seller tools</p>
              <h2 className="mt-2 text-3xl font-black text-white">Manage your store</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sellerCards.map((card) => (
                <SettingsCard key={card.title} {...card} />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
              <SettingsIcon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">Your shopping account is ready</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
              This account is currently set up for shopping only, so seller-only actions like
              refunds and store tools stay hidden until seller access is enabled for you.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleEnableSellerAccess}
                disabled={sellerLoading}
                className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sellerLoading ? "Enabling seller access..." : "Become a seller"}
              </button>
              <Link
                to="/profile"
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white"
              >
                Back to profile
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
