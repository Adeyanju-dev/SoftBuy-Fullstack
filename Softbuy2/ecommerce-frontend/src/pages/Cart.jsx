import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { formatCurrency } from "../lib/formatters";

export default function Cart() {
  const { isLoggedIn } = useAuth();
  const { cart, cartLoading, subtotal, updateQty, removeFromCart, clearCart } = useCart();

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Cart</p>
            <h1 className="text-4xl font-black text-white">Your shopping cart</h1>
            <p className="mt-2 text-sm text-slate-400">
              {isLoggedIn
                ? "Your cart stays linked to your account while you shop."
                : "You are using a guest cart. Sign in to sync it with your account."}
            </p>
          </div>
          {!isLoggedIn ? (
            <Link
              to="/login"
              className="rounded-full border border-cyan-400/30 px-5 py-3 text-sm font-medium text-cyan-200"
            >
              Login to sync cart
            </Link>
          ) : null}
        </div>

        {cartLoading ? (
          <div className="h-80 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : cart.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-xl font-semibold text-white">Your cart is empty</p>
            <p className="mt-2 text-sm text-slate-400">
              Browse the catalog and add a few products to get started.
            </p>
            <Link
              to="/products"
              className="mt-6 inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-4">
              {cart.map((item, index) => (
                <motion.article
                  key={`${item.id}-${item.variantId || "default"}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:grid-cols-[7rem_1fr_auto]"
                >
                  <div className="overflow-hidden rounded-2xl bg-slate-900/60">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-28 w-full object-cover" />
                    ) : (
                      <div className="flex h-28 items-center justify-center text-xs text-slate-500">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-lg font-semibold text-white">{item.name}</p>
                      {item.slug ? (
                        <Link to={`/products/${item.slug}`} className="text-sm text-cyan-200">
                          View product
                        </Link>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-400">
                      Unit price: {formatCurrency(item.price)}
                    </p>
                    {item.variantId ? (
                      <p className="text-xs text-slate-500">Variant #{item.variantId}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-start gap-4 sm:items-end">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/70">
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        className="px-4 py-2 text-lg"
                      >
                        -
                      </button>
                      <span className="min-w-12 text-center text-sm font-semibold">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="px-4 py-2 text-lg"
                      >
                        +
                      </button>
                    </div>

                    <p className="text-right text-lg font-semibold text-cyan-200">
                      {formatCurrency(item.price * item.qty)}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="text-sm text-rose-300 transition hover:text-rose-200"
                    >
                      Remove
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>

            <aside className="h-fit rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-xl font-semibold text-white">Summary</h2>
              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Items</span>
                  <span>{cart.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Link
                  to="/checkout"
                  className="block rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 text-center font-semibold text-slate-950"
                >
                  Proceed to checkout
                </Link>
                <button
                  type="button"
                  onClick={clearCart}
                  className="w-full rounded-full border border-rose-500/20 bg-rose-500/10 px-5 py-3 text-sm font-medium text-rose-200"
                >
                  Clear cart
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
