import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCart } from "../context/CartContext";
import { formatAddress, formatCurrency } from "../lib/formatters";
import { clearPendingPayment, extractPaystackUrl, writePendingPayment } from "../lib/payments";
import softbuyApi from "../lib/softbuyApi";

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, subtotal, cartLoading, syncCart } = useCart();

  const [addresses, setAddresses] = useState([]);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [billingAddressId, setBillingAddressId] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  useEffect(() => {
    let active = true;

    const loadCheckoutData = async () => {
      setLoading(true);
      setError("");

      try {
        await syncCart();
        const [addressesResponse, shippingResponse] = await Promise.all([
          softbuyApi.listAllAddresses(),
          softbuyApi.listAllShippingMethods(),
        ]);

        if (!active) {
          return;
        }

        const nextAddresses = softbuyApi.extractResults(addressesResponse.data);
        const nextShippingMethods = softbuyApi.extractResults(shippingResponse.data);
        const defaultAddress = nextAddresses.find((address) => address.is_default) || nextAddresses[0];

        setAddresses(nextAddresses);
        setShippingMethods(nextShippingMethods);
        setShippingAddressId(defaultAddress ? String(defaultAddress.id) : "");
        setBillingAddressId(defaultAddress ? String(defaultAddress.id) : "");
        setShippingMethodId(nextShippingMethods[0] ? String(nextShippingMethods[0].id) : "");
      } catch (loadError) {
        if (active) {
          setError(loadError.response?.data?.error || "Could not prepare checkout.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadCheckoutData();

    return () => {
      active = false;
    };
  }, [syncCart]);

  const selectedShippingAddress = useMemo(
    () => addresses.find((address) => String(address.id) === shippingAddressId),
    [addresses, shippingAddressId]
  );
  const selectedBillingAddress = useMemo(
    () => addresses.find((address) => String(address.id) === billingAddressId),
    [addresses, billingAddressId]
  );
  const selectedShippingMethod = useMemo(
    () => shippingMethods.find((method) => String(method.id) === shippingMethodId),
    [shippingMethodId, shippingMethods]
  );

  const shippingAmount = Number(selectedShippingMethod?.price || 0);
  const total = subtotal + shippingAmount;

  const handlePlaceOrder = async () => {
    if (!selectedShippingAddress || !selectedBillingAddress) {
      setError("Select shipping and billing addresses before placing your order.");
      return;
    }

    setSubmitting(true);
    setError("");
    let createdOrder = null;

    try {
      const createOrderResponse = await softbuyApi.createOrder({
        shipping_address: formatAddress(selectedShippingAddress),
        billing_address: formatAddress(selectedBillingAddress),
        customer_note: customerNote,
        currency: "NGN",
        tax_amount: "0.00",
        shipping_amount: shippingAmount.toFixed(2),
        discount_amount: "0.00",
      });

      const order = createOrderResponse.data?.order || createOrderResponse.data;
      createdOrder = order;

        if (selectedShippingMethod) {
          await softbuyApi.updateOrderShipping(order.order_number, selectedShippingMethod.id);
        }

        if (paymentMethod === "card") {
        writePendingPayment({
          order,
          paymentMethod,
          orderId: order?.id || null,
          orderNumber: order?.order_number || "",
          createdAt: Date.now(),
        });

        const paystackResponse = await softbuyApi.initializePaystack(order.id);
        const redirectUrl = extractPaystackUrl(paystackResponse.data);

          if (redirectUrl) {
            window.location.assign(redirectUrl);
            return;
          }
          throw new Error("Paystack did not return a payment link for this order.");
        } else {
          await softbuyApi.createPayment({
            order: order.id,
            payment_method: paymentMethod,
            amount: order.total_amount,
            currency: order.currency || "NGN",
          });
          clearPendingPayment();
        }

      try {
        await syncCart();
      } catch (syncError) {
        console.warn("Could not refresh cart after checkout:", syncError);
      }

      navigate("/order-success", {
        state: {
          order,
          paymentMethod,
        },
      });
    } catch (submitError) {
      const message =
        submitError.response?.data?.error ||
        submitError.response?.data?.detail ||
        submitError.message ||
        "Could not place your order.";

      if (createdOrder?.order_number) {
        try {
          await syncCart();
        } catch (syncError) {
          console.warn("Could not refresh cart after payment initialization failed:", syncError);
        }

        navigate(`/orders/${createdOrder.order_number}`, {
          state: {
            paymentError: message,
          },
        });
        return;
      }

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (cartLoading || loading) {
    return (
      <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto h-[30rem] max-w-6xl animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
      </section>
    );
  }

  if (cart.length === 0 && !submitting) {
    return (
      <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-2xl font-semibold text-white">Your cart is empty</p>
          <p className="mt-2 text-sm text-slate-400">
            Add products to your cart before starting checkout.
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950"
          >
            Browse products
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link
          to="/cart"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to cart
        </Link>

        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Checkout</p>
          <h1 className="text-4xl font-black text-white">Create your order</h1>
          <p className="text-sm text-slate-400">
            Confirm your delivery details, choose a payment method, and place your order.
          </p>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {addresses.length === 0 ? (
          <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-8">
            <p className="text-lg font-semibold text-amber-100">You need an address to continue</p>
            <p className="mt-2 text-sm text-amber-100/80">
              Add at least one address from your account before placing an order.
            </p>
            <Link
              to="/addresses"
              className="mt-5 inline-flex rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-white"
            >
              Manage addresses
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
            <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="grid gap-6 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Shipping address</span>
                  <select
                    value={shippingAddressId}
                    onChange={(event) => setShippingAddressId(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                  >
                    {addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.address_type} - {formatAddress(address)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Billing address</span>
                  <select
                    value={billingAddressId}
                    onChange={(event) => setBillingAddressId(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                  >
                    {addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.address_type} - {formatAddress(address)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Shipping method</span>
                <select
                  value={shippingMethodId}
                  onChange={(event) => setShippingMethodId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                >
                  {shippingMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name} - {formatCurrency(method.price)}{" "}
                      {method.estimated_days ? `(${method.estimated_days} days)` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-200">Payment method</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    {
                      id: "card",
                      title: "Card / Paystack",
                      description: "Place the order and continue to secure card payment.",
                    },
                    {
                      id: "bank_transfer",
                      title: "Bank transfer",
                      description: "Creates the order without redirecting away.",
                    },
                    {
                      id: "digital_wallet",
                      title: "Digital wallet",
                      description: "Creates the order for wallet-style payment handling.",
                    },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPaymentMethod(option.id)}
                      className={`rounded-3xl border p-4 text-left transition ${
                        paymentMethod === option.id
                          ? "border-cyan-400 bg-cyan-500/10"
                          : "border-white/10 bg-slate-900/50"
                      }`}
                    >
                      <p className="font-semibold text-white">{option.title}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Customer note</span>
                <textarea
                  value={customerNote}
                  onChange={(event) => setCustomerNote(event.target.value)}
                  rows={4}
                  placeholder="Add delivery notes or special instructions"
                  className="w-full rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                />
              </label>
            </div>

            <aside className="h-fit rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-xl font-semibold text-white">Order summary</h2>
              <div className="mt-6 space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                    <div>
                      <p className="font-medium text-white">
                        {item.name} x{item.qty}
                      </p>
                      <p className="text-slate-400">{formatCurrency(item.price)}</p>
                    </div>
                    <p className="font-semibold text-cyan-200">
                      {formatCurrency(item.price * item.qty)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3 border-t border-white/10 pt-4 text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Shipping</span>
                  <span>{formatCurrency(shippingAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold text-white">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={submitting || addresses.length === 0}
                className="mt-6 w-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Placing order..." : "Place order"}
              </button>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
