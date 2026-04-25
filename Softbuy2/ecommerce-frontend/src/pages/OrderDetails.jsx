import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { capitalizeWords, formatCurrency, formatDate, formatDateTime } from "../lib/formatters";
import { resolveMediaUrl } from "../lib/media";
import {
  extractPaystackUrl,
  getPaymentReference,
  isPendingPaymentStatus,
  writePendingPayment,
} from "../lib/payments";
import softbuyApi from "../lib/softbuyApi";

function getOrderId(order) {
  return Number(order?.id || order?.order_id || order?.pk || 0);
}

function buildReviewLink(item, order) {
  const productId = Number(
    item?.product || item?.product_id || item?.product_details?.id || item?.productId || 0
  );
  const productSlug = item?.product_slug || item?.product_details?.slug || item?.slug || "";

  if (!productId && !productSlug) {
    return "";
  }

  const params = new URLSearchParams();
  if (productSlug) {
    params.set("product", productSlug);
  }
  if (productId) {
    params.set("productId", String(productId));
  }

  const orderId = getOrderId(order);
  if (orderId) {
    params.set("order", String(orderId));
  }

  return `/reviews?${params.toString()}`;
}

export default function OrderDetails() {
  const location = useLocation();
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentActionLoading, setPaymentActionLoading] = useState(false);
  const [paymentActionError, setPaymentActionError] = useState("");
  const checkoutPaymentError = location.state?.paymentError || "";

  useEffect(() => {
    let active = true;

    const loadOrder = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await softbuyApi.getOrder(orderNumber);
        if (active) {
          setOrder(response.data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.response?.data?.error || "Could not load this order.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadOrder();

    return () => {
      active = false;
    };
  }, [orderNumber]);

  const paymentReference = getPaymentReference(order);

  const handleContinuePayment = async () => {
    const orderId = getOrderId(order);

    if (!orderId) {
      setPaymentActionError("This order is missing the data needed to restart Paystack checkout.");
      return;
    }

    setPaymentActionLoading(true);
    setPaymentActionError("");

    try {
      writePendingPayment({
        order,
        orderId,
        orderNumber: order?.order_number || "",
        paymentMethod: "card",
        reference: paymentReference,
        createdAt: Date.now(),
      });

      const response = await softbuyApi.initializePaystack(orderId);
      const redirectUrl = extractPaystackUrl(response.data);

      if (!redirectUrl) {
        throw new Error("Paystack did not return a payment link for this order.");
      }

      window.location.assign(redirectUrl);
    } catch (paymentError) {
      setPaymentActionError(
        paymentError.response?.data?.error ||
          paymentError.response?.data?.detail ||
          paymentError.message ||
          "Could not restart this Paystack payment."
      );
    } finally {
      setPaymentActionLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link to="/orders" className="inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
          Back to orders
        </Link>

        {loading ? (
          <div className="h-80 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : error || !order ? (
          <div className="rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-8 text-sm text-rose-100">
            {error || "Order not found."}
          </div>
        ) : (
          <>
            {checkoutPaymentError ? (
              <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
                {checkoutPaymentError}
              </div>
            ) : null}

            <div className="grid gap-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl lg:grid-cols-4">
              <div>
                <p className="text-sm text-slate-400">Order</p>
                <p className="text-2xl font-semibold text-white">{order.order_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Created</p>
                <p className="text-white">{formatDateTime(order.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Status</p>
                <p className="text-white">{capitalizeWords(order.status)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Total</p>
                <p className="text-cyan-200">
                  {formatCurrency(order.total_amount, order.currency || "NGN")}
                </p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
              <div className="space-y-4">
                {order.items?.map((item) => (
                  <article
                    key={item.id}
                    className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:grid-cols-[7rem_1fr_auto]"
                  >
                    <div className="overflow-hidden rounded-2xl bg-slate-900/60">
                      {resolveMediaUrl(item.product_image) ? (
                        <img
                          src={resolveMediaUrl(item.product_image)}
                          alt={item.product_title}
                          className="h-24 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-24 items-center justify-center text-xs text-slate-500">
                          No image
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">{item.product_title}</p>
                      <p className="text-sm text-slate-400">Quantity: {item.quantity}</p>
                      <p className="text-sm text-slate-400">SKU: {item.product_sku}</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {item.product_slug ? (
                          <Link
                            to={`/products/${item.product_slug}`}
                            className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-slate-200"
                          >
                            Open product
                          </Link>
                        ) : null}
                        {buildReviewLink(item, order) ? (
                          <Link
                            to={buildReviewLink(item, order)}
                            className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-100"
                          >
                            Write review
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Line total</p>
                      <p className="text-lg font-semibold text-cyan-200">
                        {formatCurrency(item.total_amount, order.currency || "NGN")}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div>
                  <p className="text-sm text-slate-400">Buyer email</p>
                  <p className="text-white">{order.buyer_email}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Shipping address</p>
                  <p className="text-sm leading-7 text-slate-200">{order.shipping_address || "N/A"}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Billing address</p>
                  <p className="text-sm leading-7 text-slate-200">{order.billing_address || "N/A"}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Shipping method</p>
                  <p className="text-sm text-slate-200">
                    {order.shipping_info?.shipping_method_name || "Not selected"}
                  </p>
                  {order.shipping_info?.estimated_delivery ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Estimated delivery: {formatDate(order.shipping_info.estimated_delivery)}
                    </p>
                  ) : null}
                </div>

                {paymentReference ? (
                  <div>
                    <p className="text-sm text-slate-400">Paystack reference</p>
                    <p className="break-all text-sm text-slate-200">{paymentReference}</p>
                  </div>
                ) : null}

                {isPendingPaymentStatus(order.status) ? (
                  <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-sm font-semibold text-amber-100">Payment is still pending</p>
                    <p className="mt-2 text-sm text-amber-100/80">
                      If you already paid on Paystack, verify the reference below. If checkout
                      closed early, continue the card payment for this order.
                    </p>
                    {paymentActionError ? (
                      <p className="mt-3 rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                        {paymentActionError}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-col gap-3">
                      {getOrderId(order) ? (
                        <button
                          type="button"
                          onClick={handleContinuePayment}
                          disabled={paymentActionLoading}
                          className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {paymentActionLoading ? "Opening Paystack..." : "Continue Paystack payment"}
                        </button>
                      ) : null}
                      {paymentReference ? (
                        <Link
                          to={`/verify-payment?reference=${encodeURIComponent(paymentReference)}`}
                          className="rounded-full border border-white/10 px-5 py-3 text-center text-sm font-semibold text-white"
                        >
                          Verify this payment
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
