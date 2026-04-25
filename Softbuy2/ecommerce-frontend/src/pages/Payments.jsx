import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { capitalizeWords, formatCurrency, formatDateTime } from "../lib/formatters";
import {
  clearPendingPayment,
  getPaymentReference,
  getPaystackReferenceFromSearchParams,
  getVerificationMessage,
  getVerificationStatus,
  isPendingPaymentStatus,
  isSuccessfulPaymentStatus,
} from "../lib/payments";
import softbuyApi from "../lib/softbuyApi";

function formatVerificationStatus(verification) {
  return (
    getVerificationStatus(verification) ||
    getVerificationMessage(verification) ||
    "Verification complete"
  );
}

function formatVerificationReference(verification, fallbackReference) {
  return (
    getPaymentReference(verification) ||
    fallbackReference ||
    "N/A"
  );
}

export default function Payments() {
  const [searchParams] = useSearchParams();
  const reference = getPaystackReferenceFromSearchParams(searchParams);
  const [payments, setPayments] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadPayments = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await softbuyApi.listAllPayments();
        if (active) {
          setPayments(softbuyApi.extractResults(response.data));
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.response?.data?.error || "Could not load payments.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const verifyPaystack = async () => {
      if (!reference) {
        return;
      }

      try {
        const response = await softbuyApi.verifyPaystack(reference);
        if (active) {
          setVerification(response.data);
          if (isSuccessfulPaymentStatus(response.data)) {
            clearPendingPayment();
          }
        }
      } catch (verifyError) {
        if (active) {
          setVerification({
            message:
              verifyError.response?.data?.error ||
              verifyError.response?.data?.detail ||
              "Could not verify this reference.",
            reference,
          });
        }
      }
    };

    loadPayments();
    verifyPaystack();

    return () => {
      active = false;
    };
  }, [reference]);

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Payments</p>
          <h1 className="text-4xl font-black text-white">Payment history</h1>
          <p className="mt-2 text-sm text-slate-400">
            Review your completed payments and checkout updates.
          </p>
        </div>

        {verification ? (
          <div className="rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-5 text-sm text-cyan-100">
            <p className="font-semibold text-white">Paystack update</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Reference</p>
                <p className="mt-2 text-sm text-white">
                  {formatVerificationReference(verification, reference)}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Status</p>
                <p className="mt-2 text-sm text-white">{formatVerificationStatus(verification)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Message</p>
                <p className="mt-2 text-sm text-white">
                  {verification?.message || verification?.detail || "Payment status checked."}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="h-80 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : payments.length > 0 ? (
          <div className="space-y-4">
            {payments.map((payment) => (
              <article
                key={payment.id}
                className="grid gap-5 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl lg:grid-cols-[1fr_0.8fr_0.9fr]"
              >
                <div>
                  <p className="text-sm text-slate-400">Order number</p>
                  <p className="text-lg font-semibold text-white">{payment.order_number}</p>
                  <p className="mt-2 text-sm text-slate-400">{payment.buyer_email}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Created {formatDateTime(payment.created_at)}
                  </p>
                  {getPaymentReference(payment) ? (
                    <p className="mt-2 break-all text-xs text-slate-500">
                      Reference: {getPaymentReference(payment)}
                    </p>
                  ) : null}
                </div>

                <div>
                  <p className="text-sm text-slate-400">Amount</p>
                  <p className="text-lg font-semibold text-cyan-200">
                    {formatCurrency(payment.amount, payment.currency || "NGN")}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Net {formatCurrency(payment.net_amount, payment.currency || "NGN")}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Status</p>
                  <span className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                    {capitalizeWords(payment.status)}
                  </span>
                  <p className="mt-3 text-xs text-slate-500">
                    Method: {capitalizeWords(payment.payment_method)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {payment.order_number ? (
                      <Link
                        to={`/orders/${payment.order_number}`}
                        className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-slate-200"
                      >
                        Open order
                      </Link>
                    ) : null}
                    {isPendingPaymentStatus(payment.status) && getPaymentReference(payment) ? (
                      <Link
                        to={`/verify-payment?reference=${encodeURIComponent(
                          getPaymentReference(payment)
                        )}`}
                        className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-100"
                      >
                        Verify Paystack payment
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center text-slate-300">
            No payments recorded yet. Complete checkout to create one.
            <div className="mt-6">
              <Link
                to="/products"
                className="inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950"
              >
                Browse products
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
