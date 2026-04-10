import {
  ArrowRight,
  Bell,
  CreditCard,
  Heart,
  Package,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";

const categoryHighlights = [
  {
    title: "New arrivals",
    description: "Fresh releases, trending picks, and recently listed finds.",
    to: "/products",
  },
  {
    title: "Top-rated stores",
    description: "Discover trusted sellers with standout service and strong reviews.",
    to: "/reviews",
  },
  {
    title: "Fast checkout",
    description: "Move from product page to payment in a clean, simple flow.",
    to: "/cart",
  },
];

const featureCards = [
  {
    title: "Shop confidently",
    description: "Browse detailed product pages, seller ratings, and clear stock status.",
    icon: ShoppingBag,
    to: "/products",
  },
  {
    title: "Track every order",
    description: "Follow purchases, delivery progress, and past orders from one place.",
    icon: Package,
    to: "/orders",
  },
  {
    title: "Secure payments",
    description: "Review your payment history and complete checkout with ease.",
    icon: CreditCard,
    to: "/payments",
  },
  {
    title: "Saved favorites",
    description: "Keep products you love close so you can come back anytime.",
    icon: Heart,
    to: "/wishlist",
  },
  {
    title: "Real reviews",
    description: "Read customer feedback before you buy and share your own experience.",
    icon: Star,
    to: "/reviews",
  },
  {
    title: "Your account, organized",
    description: "Manage addresses, alerts, profile details, and shopping activity.",
    icon: User,
    to: "/settings",
  },
];

const trustPoints = [
  { label: "Verified sellers", icon: ShieldCheck },
  { label: "Delivery updates", icon: Truck },
  { label: "Live notifications", icon: Bell },
];

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),_transparent_25%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.16),_transparent_30%)]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:4rem_4rem]" />

      <section className="relative mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="grid items-center gap-10 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-8">
            <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1 text-sm font-medium text-cyan-100">
              Shop smarter with SoftBuy
            </span>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl">
                Modern shopping for customers who want speed, trust, and style.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                Explore standout products, save your favorites, place orders quickly, and
                keep everything from checkout to delivery updates in one polished space.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:opacity-90"
              >
                Start shopping
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/wishlist"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Open wishlist
              </Link>
            </div>

            <div className="flex flex-wrap gap-3">
              {trustPoints.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                  >
                    <Icon className="h-4 w-4 text-cyan-200" />
                    {item.label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-200">This week</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Make every click count</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Search products, compare prices, and move the best picks into your cart or
                wishlist in seconds.
              </p>
            </div>

            <div className="rounded-[2rem] border border-amber-400/20 bg-amber-500/10 p-6 backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.2em] text-amber-200">Why shoppers stay</p>
              <p className="mt-3 text-3xl font-black text-white">Smooth browsing. Cleaner checkout.</p>
              <p className="mt-3 text-sm leading-7 text-amber-50/80">
                Built for real buying moments, from first glance to final payment.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-6 pb-6">
        <div className="grid gap-4 md:grid-cols-3">
          {categoryHighlights.map((item) => (
            <Link
              key={item.title}
              to={item.to}
              className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-400/30"
            >
              <p className="text-lg font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Explore SoftBuy</p>
            <h2 className="mt-2 text-4xl font-black text-white">Everything shoppers need in one place</h2>
          </div>
          <Link to="/settings" className="text-sm font-medium text-cyan-200">
            Go to account
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                to={card.to}
                className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-400/30"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">{card.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
