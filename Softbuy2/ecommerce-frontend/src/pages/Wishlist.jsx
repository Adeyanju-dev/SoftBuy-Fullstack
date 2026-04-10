import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Trash } from "lucide-react";
import { useWishlist } from "../context/WishlistContext";
import { useCart } from "../context/CartContext";
import { formatCurrency } from "../lib/formatters";

export default function Wishlist() {
  const { wishlist, wishlistLoading, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Wishlist</p>
          <h1 className="text-4xl font-black text-white">Saved for later</h1>
          <p className="mt-2 text-sm text-slate-400">
            Keep an eye on your favorite products and move them into your cart when you are ready.
          </p>
        </div>

        {wishlistLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-[24rem] animate-pulse rounded-[2rem] border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : wishlist.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-slate-400">
              <Heart className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-white">Your wishlist is empty</h2>
            <p className="mt-2 text-sm text-slate-400">Save products you love and they will show up here.</p>
            <Link
              to="/products"
              className="mt-6 inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950"
            >
              Browse products
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {wishlist.map((item, index) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-900/70">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      No image available
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFromWishlist(item.id)}
                    className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-950/80 p-2 text-rose-200 backdrop-blur"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 p-6">
                  <div>
                    <Link
                      to={item.slug ? `/products/${item.slug}` : "/products"}
                      className="text-xl font-semibold text-white"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-2 text-2xl font-bold text-cyan-200">
                      {formatCurrency(item.price, "NGN")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={async () =>
                      addToCart({
                        ...item,
                        productId: item.id,
                        qty: 1,
                      })
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 font-semibold text-slate-950"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Move to cart
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
