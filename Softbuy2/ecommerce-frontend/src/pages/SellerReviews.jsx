import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageSquareQuote, Star } from "lucide-react";
import toast from "react-hot-toast";
import SellerWorkspaceNav from "../components/SellerWorkspaceNav";
import { formatDateTime } from "../lib/formatters";
import softbuyApi from "../lib/softbuyApi";

function getAverageRating(reviews) {
  if (!reviews.length) {
    return 0;
  }

  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

export default function SellerReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await softbuyApi.listAllSellerReviews();
      setReviews(softbuyApi.extractResults(response.data));
    } catch (loadError) {
      setError(loadError.response?.data?.error || "Could not load seller reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const stats = useMemo(
    () => ({
      total: reviews.length,
      approved: reviews.filter((review) => review.is_approved).length,
      average: getAverageRating(reviews),
    }),
    [reviews]
  );

  const handleToggleApproval = async (review) => {
    setSavingId(review.id);
    setError("");

    try {
      await softbuyApi.updateSellerReview(review.id, {
        is_approved: !review.is_approved,
      });
      toast.success(review.is_approved ? "Review hidden" : "Review approved");
      await loadReviews();
    } catch (saveError) {
      setError(
        saveError.response?.data?.error || "Could not update seller review approval."
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <SellerWorkspaceNav
          title="Seller reviews and moderation"
          description="Review the latest store feedback and control what stays visible."
        />

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="h-96 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <p className="text-sm text-slate-400">Total seller reviews</p>
                <p className="mt-3 text-3xl font-black text-white">{stats.total}</p>
              </article>
              <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <p className="text-sm text-slate-400">Approved reviews</p>
                <p className="mt-3 text-3xl font-black text-white">{stats.approved}</p>
              </article>
              <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <p className="text-sm text-slate-400">Average rating</p>
                <p className="mt-3 text-3xl font-black text-white">{stats.average}/5</p>
              </article>
            </div>

            <div className="space-y-4">
              {reviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="inline-flex items-center gap-2 font-semibold text-white">
                        <MessageSquareQuote className="h-4 w-4 text-cyan-200" />
                        {review.user_name || "Marketplace customer"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">{review.user_email}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {formatDateTime(review.created_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-3 py-1 text-sm text-amber-200">
                        <Star className="h-4 w-4 fill-current" />
                        {review.rating}/5
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          review.is_approved
                            ? "bg-emerald-500/15 text-emerald-200"
                            : "bg-white/10 text-slate-200"
                        }`}
                      >
                        {review.is_approved ? "Approved" : "Pending approval"}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {review.comment || "No written comment was left for this seller review."}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleApproval(review)}
                      disabled={savingId === review.id}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {savingId === review.id
                        ? "Saving..."
                        : review.is_approved
                        ? "Hide review"
                        : "Approve review"}
                    </button>
                    <p className="text-xs text-slate-500">Order #{review.order || "N/A"}</p>
                  </div>
                </article>
              ))}

              {!reviews.length ? (
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-sm text-slate-400">
                  No seller reviews yet. Once customers leave feedback for your store, you
                  will be able to moderate it here.
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
