import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CreditCard,
  MessageSquareQuote,
  PackageSearch,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import SellerWorkspaceNav from "../components/SellerWorkspaceNav";
import { capitalizeWords, formatCurrency, formatDateTime } from "../lib/formatters";
import softbuyApi from "../lib/softbuyApi";

function sumBy(items, predicate) {
  return items.reduce((total, item) => {
    if (!predicate(item)) {
      return total;
    }

    return total + Number(item.amount || 0);
  }, 0);
}

function averageRating(reviews) {
  if (!reviews.length) {
    return 0;
  }

  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

function isOwnedProduct(product, sellerProfile, user) {
  if (!product) {
    return false;
  }

  if (sellerProfile?.id && Number(product.seller) === Number(sellerProfile.id)) {
    return true;
  }

  if (sellerProfile?.user && Number(product.seller_id) === Number(sellerProfile.user)) {
    return true;
  }

  if (
    sellerProfile?.business_name &&
    product.seller_business_name === sellerProfile.business_name
  ) {
    return true;
  }

  if (user?.seller_profile?.business_name) {
    return product.seller_business_name === user.seller_profile.business_name;
  }

  return false;
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState([]);
  const [sellerProfile, setSellerProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);

      const results = await Promise.allSettled([
        softbuyApi.getSellerProfile(),
        softbuyApi.listAllSellerProducts(),
        softbuyApi.listAllPayouts(),
        softbuyApi.listAllRefunds(),
        softbuyApi.listAllTransactions(),
        softbuyApi.listAllSellerReviews(),
      ]);

      if (!active) {
        return;
      }

      const nextWarnings = [];
      const nextSellerProfile =
        results[0].status === "fulfilled" ? results[0].value.data : null;

      if (!nextSellerProfile) {
        nextWarnings.push("Seller profile could not be loaded.");
      }

      if (results[1].status === "rejected") {
        nextWarnings.push("Product metrics are partially unavailable.");
      }

      if (results[2].status === "rejected") {
        nextWarnings.push("Payout metrics are partially unavailable.");
      }

      if (results[3].status === "rejected") {
        nextWarnings.push("Refund metrics are partially unavailable.");
      }

      if (results[4].status === "rejected") {
        nextWarnings.push("Transaction metrics are partially unavailable.");
      }

      if (results[5].status === "rejected") {
        nextWarnings.push("Seller review metrics are partially unavailable.");
      }

      setSellerProfile(nextSellerProfile);
      setProducts(
        results[1].status === "fulfilled" ? softbuyApi.extractResults(results[1].value.data) : []
      );
      setPayouts(
        results[2].status === "fulfilled" ? softbuyApi.extractResults(results[2].value.data) : []
      );
      setRefunds(
        results[3].status === "fulfilled" ? softbuyApi.extractResults(results[3].value.data) : []
      );
      setTransactions(
        results[4].status === "fulfilled" ? softbuyApi.extractResults(results[4].value.data) : []
      );
      setReviews(
        results[5].status === "fulfilled" ? softbuyApi.extractResults(results[5].value.data) : []
      );
      setWarnings(nextWarnings);
      setLoading(false);
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const sellerProducts = useMemo(
    () => products.filter((product) => isOwnedProduct(product, sellerProfile, user)),
    [products, sellerProfile, user]
  );

  const stats = useMemo(() => {
    const publishedProducts = sellerProducts.filter(
      (product) => product.status === "published"
    ).length;
    const pendingPayouts = payouts.filter((payout) => payout.status === "pending");
    const pendingRefunds = refunds.filter((refund) => refund.status === "requested");
    const grossSales = sumBy(transactions, (item) => item.transaction_type === "sale");
    const totalFees = sumBy(transactions, (item) => item.transaction_type === "fee");

    return [
      {
        label: "Published products",
        value: publishedProducts,
        note: `${sellerProducts.length} seller products loaded`,
      },
      {
        label: "Pending payouts",
        value: formatCurrency(
          sumBy(pendingPayouts, () => true),
          pendingPayouts[0]?.currency || "NGN"
        ),
        note: `${pendingPayouts.length} payout requests`,
      },
      {
        label: "Gross sales",
        value: formatCurrency(grossSales, transactions[0]?.currency || "NGN"),
        note: `Fees tracked: ${formatCurrency(totalFees, transactions[0]?.currency || "NGN")}`,
      },
      {
        label: "Seller rating",
        value: `${averageRating(reviews) || 0}/5`,
        note: `${reviews.length} reviews, ${pendingRefunds.length} refund requests`,
      },
    ];
  }, [payouts, refunds, reviews, sellerProducts, transactions]);

  const sellerName =
    sellerProfile?.business_name ||
    user?.seller_profile?.business_name ||
    user?.email ||
    "SoftBuy seller";

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <SellerWorkspaceNav
          title="Seller command center"
          description="Track store performance, recent payouts, customer feedback, and your latest listings."
          action={
            <Link
              to="/seller/products"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Manage products
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        />

        {warnings.length ? (
          <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
            <p className="font-semibold text-white">Some seller data is only partially loaded</p>
            <div className="mt-3 space-y-1 text-amber-100/90">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="h-96 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <article
                  key={stat.label}
                  className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
                >
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="mt-3 text-3xl font-black text-white">{stat.value}</p>
                  <p className="mt-2 text-xs text-slate-500">{stat.note}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="text-sm text-slate-400">Seller profile snapshot</p>
                    <h2 className="text-2xl font-semibold text-white">{sellerName}</h2>
                  </div>
                  <Link
                    to="/seller/profile"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200"
                  >
                    Edit seller profile
                  </Link>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      <ShieldCheck className="h-4 w-4 text-cyan-200" />
                      Verification
                    </p>
                    <p className="mt-3 text-sm text-slate-300">
                      Business verified: {sellerProfile?.verified ? "Yes" : "No"}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      KYC status: {capitalizeWords(sellerProfile?.kyc_status || "pending")}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Updated {formatDateTime(sellerProfile?.updated_at)}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      <BriefcaseBusiness className="h-4 w-4 text-cyan-200" />
                      Business details
                    </p>
                    <p className="mt-3 text-sm text-slate-300">
                      {sellerProfile?.business_address || "No business address saved yet."}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {sellerProfile?.business_phone || "No business phone added"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {sellerProfile?.user_email || user?.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <h2 className="text-2xl font-semibold text-white">Quick links</h2>
                <div className="mt-6 grid gap-3">
                  <Link
                    to="/seller/products"
                    className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-200"
                  >
                    <span className="inline-flex items-center gap-2">
                      <PackageSearch className="h-4 w-4 text-cyan-200" />
                      Product management
                    </span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/seller/payouts"
                    className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-200"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-cyan-200" />
                      Payouts and transactions
                    </span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/seller/reviews"
                    className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-200"
                  >
                    <span className="inline-flex items-center gap-2">
                      <MessageSquareQuote className="h-4 w-4 text-cyan-200" />
                      Seller reviews
                    </span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-white">Latest products</h2>
                  <Link to="/seller/products" className="text-sm text-cyan-200">
                    View all
                  </Link>
                </div>
                <div className="mt-5 space-y-3">
                  {sellerProducts.slice(0, 4).map((product) => (
                    <article
                      key={product.slug}
                      className="rounded-3xl border border-white/10 bg-slate-900/50 p-4"
                    >
                      <p className="font-medium text-white">{product.title}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {formatCurrency(product.price, product.currency || "NGN")}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {capitalizeWords(product.status)} • Stock {product.stock}
                      </p>
                    </article>
                  ))}
                  {!sellerProducts.length ? (
                    <p className="text-sm text-slate-400">
                      No seller products were matched yet. Add your first item to start building your catalog.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-white">Recent payouts</h2>
                  <Link to="/seller/payouts" className="text-sm text-cyan-200">
                    Open finance
                  </Link>
                </div>
                <div className="mt-5 space-y-3">
                  {payouts.slice(0, 4).map((payout) => (
                    <article
                      key={payout.id}
                      className="rounded-3xl border border-white/10 bg-slate-900/50 p-4"
                    >
                      <p className="font-medium text-white">
                        {formatCurrency(payout.amount, payout.currency || "NGN")}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {capitalizeWords(payout.status)} • {capitalizeWords(payout.payment_method)}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {formatDateTime(payout.created_at)}
                      </p>
                    </article>
                  ))}
                  {!payouts.length ? (
                    <p className="text-sm text-slate-400">
                      No payout requests yet. When you request one, it will show here.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-white">Seller reviews</h2>
                  <Link to="/seller/reviews" className="text-sm text-cyan-200">
                    Moderate
                  </Link>
                </div>
                <div className="mt-5 space-y-3">
                  {reviews.slice(0, 4).map((review) => (
                    <article
                      key={review.id}
                      className="rounded-3xl border border-white/10 bg-slate-900/50 p-4"
                    >
                      <p className="font-medium text-white">
                        {review.user_name || "Customer"} • {review.rating}/5
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {review.comment || "No comment left for this review."}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {review.is_approved ? "Approved" : "Pending approval"} •{" "}
                        {formatDateTime(review.created_at)}
                      </p>
                    </article>
                  ))}
                  {!reviews.length ? (
                    <p className="text-sm text-slate-400">
                      Seller reviews will appear here when customers leave marketplace
                      feedback.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
