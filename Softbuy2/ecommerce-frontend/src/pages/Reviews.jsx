import { useCallback, useEffect, useMemo, useState } from "react";
import { Star, ThumbsUp } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatDateTime } from "../lib/formatters";
import softbuyApi from "../lib/softbuyApi";

const initialForm = {
  rating: 5,
  title: "",
  comment: "",
  order: "",
};

function normalizeProductId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function orderIncludesProduct(order, productSlug, productId) {
  const normalizedProductId = normalizeProductId(productId);

  return Array.isArray(order?.items)
    ? order.items.some((item) => {
        return (
          (productSlug && item?.product_slug === productSlug) ||
          (normalizedProductId > 0 &&
            Number(item?.product || item?.product_id || 0) === normalizedProductId)
        );
      })
    : false;
}

function reviewMatchesProduct(review, productSlug, productId) {
  const normalizedProductId = normalizeProductId(productId);

  return (
    (productSlug && review?.product_slug === productSlug) ||
    (normalizedProductId > 0 &&
      Number(review?.product || review?.product_id || review?.product_details?.id || 0) ===
        normalizedProductId)
  );
}

function getOrderId(order) {
  return String(order?.id || order?.order_id || order?.pk || "");
}

export default function Reviews() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const productFilter = searchParams.get("product");
  const requestedProductId = searchParams.get("productId") || searchParams.get("product_id");
  const requestedOrderId = searchParams.get("order") || searchParams.get("orderId") || "";
  const redirectTo = `${location.pathname}${location.search}`;

  const [reviews, setReviews] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [resolvedProductId, setResolvedProductId] = useState(requestedProductId || "");

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await softbuyApi.listAllReviews();
      setReviews(softbuyApi.extractResults(response.data));
    } catch (loadError) {
      setError(loadError.response?.data?.error || "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    let active = true;

    const resolveProductId = async () => {
      if (requestedProductId) {
        setResolvedProductId(requestedProductId);
        return;
      }

      if (!productFilter) {
        setResolvedProductId("");
        return;
      }

      try {
        const response = await softbuyApi.getProduct(productFilter);
        const nextId = String(response.data?.id || response.data?.product_id || "");

        if (active) {
          setResolvedProductId(nextId);
        }
      } catch {
        if (active) {
          setResolvedProductId("");
        }
      }
    };

    resolveProductId();

    return () => {
      active = false;
    };
  }, [productFilter, requestedProductId]);

  useEffect(() => {
    let active = true;

    const loadOrders = async () => {
      if ((!resolvedProductId && !productFilter) || !isLoggedIn) {
        if (active) {
          setOrders([]);
        }
        return;
      }

      setOrderLoading(true);

      try {
        const response = await softbuyApi.listAllOrders();
        const nextOrders = softbuyApi
          .extractResults(response.data)
          .filter((order) => orderIncludesProduct(order, productFilter, resolvedProductId));

        if (active) {
          setOrders(nextOrders);
          const matchingRequestedOrder = nextOrders.find(
            (order) => getOrderId(order) === String(requestedOrderId)
          );

          setForm((current) => ({
            ...current,
            order:
              (matchingRequestedOrder && getOrderId(matchingRequestedOrder)) ||
              (nextOrders.length === 1 ? getOrderId(nextOrders[0]) : current.order),
          }));
        }
      } catch (loadError) {
        if (active) {
          setOrders([]);
          setError(loadError.response?.data?.error || "Could not load your eligible orders.");
        }
      } finally {
        if (active) {
          setOrderLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      active = false;
    };
  }, [isLoggedIn, productFilter, requestedOrderId, resolvedProductId]);

  const filteredReviews = useMemo(() => {
    if (!productFilter && !resolvedProductId) {
      return reviews;
    }
    return reviews.filter((review) =>
      reviewMatchesProduct(review, productFilter, resolvedProductId)
    );
  }, [productFilter, resolvedProductId, reviews]);

  const handleHelpfulToggle = async (reviewId) => {
    if (!isLoggedIn) {
      navigate("/login", { state: { from: redirectTo } });
      return;
    }

    await softbuyApi.markReviewHelpful(reviewId);
    await loadReviews();
  };

  const handleCreateReview = async (event) => {
    event.preventDefault();

    if (!resolvedProductId) {
      setError("Open this page from a product to submit a review.");
      return;
    }

    if (!isLoggedIn) {
      navigate("/login", { state: { from: redirectTo } });
      return;
    }

    if (!form.order) {
      setError("Select the order you bought this product from before submitting your review.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await softbuyApi.createReview({
        product: Number(resolvedProductId),
        order: Number(form.order),
        rating: Number(form.rating),
        title: form.title.trim(),
        comment: form.comment.trim(),
      });
      setForm((current) => ({ ...initialForm, order: current.order }));
      await loadReviews();
    } catch (saveError) {
      setError(saveError.response?.data?.error || "Review creation failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Reviews</p>
          <h1 className="text-4xl font-black text-white">
            {productFilter ? `Reviews for ${productFilter}` : "Customer reviews"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Read customer feedback and share your own experience after purchase.
          </p>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {resolvedProductId || productFilter ? (
          <form
            onSubmit={handleCreateReview}
            className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
          >
            <h2 className="text-xl font-semibold text-white">Write a review</h2>
            <p className="mt-2 text-sm text-slate-400">
              Reviews can only be submitted for orders that include this product.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="space-y-2 md:col-span-3">
                <span className="text-sm text-slate-300">Order</span>
                <select
                  value={form.order}
                  onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))}
                  disabled={orderLoading || !orders.length}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {orderLoading
                      ? "Loading your orders..."
                      : orders.length
                      ? "Select your order"
                      : "No matching order found yet"}
                  </option>
                  {orders.map((order) => (
                    <option key={getOrderId(order) || order.order_number} value={getOrderId(order)}>
                      {order.order_number} • {order.items?.length || 0} item(s)
                    </option>
                  ))}
                </select>
              </label>

              <input
                type="number"
                min="1"
                max="5"
                value={form.rating}
                onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                placeholder="Rating"
              />
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none md:col-span-2"
                placeholder="Review title"
              />
            </div>
            <textarea
              value={form.comment}
              onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
              rows={4}
              className="mt-4 w-full rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
              placeholder="Share your experience"
            />
            <button
              type="submit"
              disabled={saving || orderLoading || !orders.length}
              className="mt-4 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Submitting..." : "Submit review"}
            </button>
          </form>
        ) : null}

        {loading ? (
          <div className="h-80 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : filteredReviews.length > 0 ? (
          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <article
                key={review.id}
                className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{review.title || "Customer review"}</p>
                    <p className="text-sm text-slate-400">
                      {review.user_name} • {review.product_title}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(review.created_at)}</p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-3 py-1 text-sm text-amber-200">
                    <Star className="h-4 w-4 fill-current" />
                    {review.rating}/5
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {review.comment || "No comment provided."}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleHelpfulToggle(review.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-slate-200"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Helpful ({review.helpful_count})
                  </button>
                  <Link
                    to={`/products/${review.product_slug}`}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-200"
                  >
                    Open product
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center text-slate-400">
            No reviews found for this view.
          </div>
        )}
      </div>
    </section>
  );
}
