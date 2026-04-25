import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { formatCurrency } from "../lib/formatters";
import {
  clearPendingPayment,
  getPaystackReferenceFromSearchParams,
  getVerificationMessage,
  getVerificationOrder,
  getVerificationStatus,
  isSuccessfulPaymentStatus,
  readPendingPayment,
} from "../lib/payments";
import softbuyApi from "../lib/softbuyApi";

export default function OrderSuccess() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const reference = getPaystackReferenceFromSearchParams(searchParams);
  const [verification, setVerification] = useState(null);
  const [verifying, setVerifying] = useState(Boolean(reference));
  const [pendingPayment] = useState(() => readPendingPayment());

  const order = location.state?.order || getVerificationOrder(verification) || pendingPayment?.order || null;
  const paymentMethod =
    location.state?.paymentMethod ||
    verification?.payment_method ||
    verification?.data?.payment_method ||
    pendingPayment?.paymentMethod ||
    "card";
  const verificationStatus = getVerificationStatus(verification);
  const verificationMessage = getVerificationMessage(verification);

  useEffect(() => {
    let active = true;

    const verifyPayment = async () => {
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
      } catch (error) {
        if (active) {
          setVerification({
            message:
              error.response?.data?.error ||
              error.response?.data?.detail ||
              "We could not verify this Paystack reference yet.",
          });
        }
      } finally {
        if (active) {
          setVerifying(false);
        }
      }
    };

    verifyPayment();

    return () => {
      active = false;
    };
  }, [reference]);

  useEffect(() => {
    if (!reference && paymentMethod !== "card") {
      clearPendingPayment();
    }
  }, [paymentMethod, reference]);

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <CheckCircle2 className="h-10 w-10" />
        </div>

        <h1 className="mt-6 text-4xl font-black text-white">Order received</h1>
        <p className="mt-3 text-slate-300">
          {verifying
            ? "We are verifying your Paystack payment reference."
            : "Your order flow completed and the next step is available in your account pages."}
        </p>

        <div className="mt-8 space-y-4 rounded-[2rem] border border-white/10 bg-slate-900/50 p-6 text-left">
          {order ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-400">Order number</span>
                <span className="font-semibold text-white">{order.order_number}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-400">Order total</span>
                <span className="font-semibold text-cyan-200">
                  {formatCurrency(order.total_amount, order.currency || "NGN")}
                </span>
              </div>
            </>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">Payment method</span>
            <span className="font-semibold text-white">{paymentMethod.replace(/_/g, " ")}</span>
          </div>

          {verificationStatus ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-400">Payment status</span>
              <span className="font-semibold text-white">{verificationStatus.replace(/_/g, " ")}</span>
            </div>
          ) : null}

          {reference ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-400">Paystack reference</span>
              <span className="break-all text-right font-semibold text-white">{reference}</span>
            </div>
          ) : null}

          {verificationMessage ? (
            <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300">
              {verificationMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/orders"
            className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950"
          >
            View my orders
          </Link>
          <Link
            to="/payments"
            className="rounded-full border border-white/10 px-6 py-3 font-semibold text-white"
          >
            Open payments
          </Link>
          <Link
            to="/products"
            className="rounded-full border border-white/10 px-6 py-3 font-semibold text-white"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </section>
  );
}
