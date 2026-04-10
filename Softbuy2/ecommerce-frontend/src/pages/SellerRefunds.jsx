import { useCallback, useEffect, useState } from "react";
import { CreditCard, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import SellerWorkspaceNav from "../components/SellerWorkspaceNav";
import {
  capitalizeWords,
  formatCurrency,
  formatDateTime,
} from "../lib/formatters";
import softbuyApi from "../lib/softbuyApi";

const initialForm = {
  payment: "",
  amount: "",
  reason: "",
  status: "requested",
};

export default function SellerRefunds() {
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      softbuyApi.listAllRefunds(),
      softbuyApi.listAllPayments(),
    ]);

    const nextWarnings = [];

    if (results[0].status === "rejected") {
      nextWarnings.push("Refund history could not be loaded.");
    }

    if (results[1].status === "rejected") {
      nextWarnings.push("Payment lookup could not be loaded for refund creation.");
    }

    setRefunds(
      results[0].status === "fulfilled" ? softbuyApi.extractResults(results[0].value.data) : []
    );
    setPayments(
      results[1].status === "fulfilled" ? softbuyApi.extractResults(results[1].value.data) : []
    );
    setWarnings(nextWarnings);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!form.payment) {
        throw new Error("A payment id is required before creating a refund request.");
      }

      await softbuyApi.createRefund({
        payment: Number(form.payment),
        amount: form.amount,
        reason: form.reason.trim() || null,
        status: form.status,
      });

      toast.success("Refund request submitted");
      setForm(initialForm);
      await loadPageData();
    } catch (saveError) {
      setError(
        saveError.response?.data?.error ||
          saveError.message ||
          "Could not create refund request."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <SellerWorkspaceNav
          title="Refund requests"
          description="Submit and review refund requests for qualifying payments."
        />

        {warnings.length ? (
          <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="h-96 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <form
              onSubmit={handleSubmit}
              className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
            >
              <h2 className="text-2xl font-semibold text-white">Create refund request</h2>
              <p className="mt-2 text-sm text-slate-400">
                Select a payment or enter its id manually if you already have it.
              </p>

              <div className="mt-6 space-y-4">
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Payment</span>
                  <select
                    name="payment"
                    value={form.payment}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                  >
                    <option value="">Select payment</option>
                    {payments.map((payment) => (
                      <option key={payment.id} value={payment.id}>
                        #{payment.id} • {payment.order_number} •{" "}
                        {formatCurrency(payment.amount, payment.currency || "NGN")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Payment ID</span>
                  <input
                    name="payment"
                    value={form.payment}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                    placeholder="Enter the payment id if needed"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Refund amount</span>
                  <input
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                    placeholder="25000.00"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Reason</span>
                  <textarea
                    name="reason"
                    value={form.reason}
                    onChange={handleChange}
                    rows={5}
                    className="w-full rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                    placeholder="Damaged item, duplicate charge, returned order..."
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-6 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Submitting..." : "Submit refund request"}
              </button>
            </form>

            <div className="space-y-4">
              {refunds.map((refund) => (
                <article
                  key={refund.id}
                  className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-2 text-lg font-semibold text-white">
                      <RotateCcw className="h-5 w-5 text-cyan-200" />
                      {formatCurrency(
                        refund.amount,
                        refund.payment_details?.currency || "NGN"
                      )}
                    </p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                      {capitalizeWords(refund.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-4">
                      <p className="text-sm text-slate-400">Order</p>
                      <p className="mt-1 font-medium text-white">
                        {refund.order_number || "No order number"}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Requested {formatDateTime(refund.created_at)}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-4">
                      <p className="inline-flex items-center gap-2 text-sm text-slate-400">
                        <CreditCard className="h-4 w-4" />
                        Payment
                      </p>
                      <p className="mt-1 font-medium text-white">
                        #{refund.payment_details?.id || refund.payment || "N/A"}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {capitalizeWords(refund.payment_details?.payment_method || "pending")}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {refund.reason || "No refund reason was recorded."}
                  </p>
                </article>
              ))}

              {!refunds.length ? (
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-sm text-slate-400">
                  No refund requests yet. Create one from the form when an order needs a refund.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
