import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Search, ShieldCheck, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { formatCurrency, formatDate } from "../lib/formatters";
import { getProductImage } from "../lib/productMedia";
import softbuyApi from "../lib/softbuyApi";

function isProductAvailable(product) {
  if (typeof product?.is_in_stock === "boolean") {
    return product.is_in_stock;
  }

  return Number(product?.stock || 0) > 0;
}

export default function Products() {
  const { addToCart } = useCart();
  const { wishlist, addToWishlist, removeFromWishlist } = useWishlist();

  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [pageSize, setPageSize] = useState(0);
  const [search, setSearch] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await softbuyApi.listProducts(page);
        const nextProducts = softbuyApi.extractResults(response.data);

        if (!active) {
          return;
        }

        setProducts(nextProducts);
        setCount(softbuyApi.extractCount(response.data));
        setHasNextPage(Boolean(response.data?.next));
        setPageSize((current) => {
          if (page === 1 && nextProducts.length > 0) {
            return nextProducts.length;
          }

          return current || nextProducts.length || 0;
        });
      } catch (loadError) {
        if (active) {
          setError(loadError.response?.data?.error || "Could not load products right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, [page]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const haystack = `${product.title} ${product.category_name} ${product.seller_business_name}`
        .toLowerCase()
        .trim();
      const matchesSearch = !search || haystack.includes(search.toLowerCase().trim());
      const matchesStock = !onlyInStock || isProductAvailable(product);

      return matchesSearch && matchesStock;
    });
  }, [onlyInStock, products, search]);

  const totalPages =
    count > 0 && pageSize > 0 ? Math.max(1, Math.ceil(count / pageSize)) : page;

  const isWishlisted = (productId) =>
    wishlist.some((item) => Number(item.id) === Number(productId));

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Products</p>
              <h1 className="text-4xl font-black text-white sm:text-5xl">
                Browse the SoftBuy catalog
              </h1>
              <p className="text-slate-300">
                Discover standout products, trusted sellers, and your next favorite find.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search current page"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                />
              </label>

              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(event) => setOnlyInStock(event.target.checked)}
                  className="accent-cyan-400"
                />
                In stock only
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[28rem] animate-pulse rounded-[2rem] border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-8 text-rose-100">
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm text-rose-100/80">{error}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center text-slate-300">
            <p className="text-lg font-medium">No products matched this filter.</p>
            <p className="mt-2 text-sm">Try a different search or load another page.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product, index) => {
              const available = isProductAvailable(product);
              const productImage = getProductImage(product);

              return (
                <motion.article
                  key={product.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="group overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl"
                >
                  <div className="relative">
                  <Link to={`/products/${product.slug}`} className="block">
                    <div className="aspect-[4/3] overflow-hidden bg-slate-900/70">
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={product.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500">
                          No image available
                        </div>
                      )}
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      isWishlisted(product.id)
                        ? removeFromWishlist(product.id)
                        : addToWishlist({
                            id: product.id,
                            slug: product.slug,
                            name: product.title,
                            image: productImage,
                            price: Number(product.price),
                          })
                    }
                    className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-950/80 p-2 text-slate-100 backdrop-blur"
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        isWishlisted(product.id) ? "fill-pink-500 text-pink-500" : ""
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-4 p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      {product.category_name}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      Added {formatDate(product.created_at)}
                    </span>
                  </div>

                  <div>
                    <Link to={`/products/${product.slug}`} className="text-xl font-semibold text-white">
                      {product.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                      <span>{product.seller_business_name}</span>
                      {product.seller_verified ? (
                        <span className="inline-flex items-center gap-1 text-cyan-200">
                          <ShieldCheck className="h-4 w-4" />
                          Verified seller
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-cyan-200">
                        {formatCurrency(product.price, product.currency || "NGN")}
                      </p>
                      {product.compare_price ? (
                        <p className="text-sm text-slate-500 line-through">
                          {formatCurrency(product.compare_price, product.currency || "NGN")}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right text-sm text-slate-300">
                      <p className="inline-flex items-center gap-1 text-amber-300">
                        <Star className="h-4 w-4 fill-current" />
                        {Number(product.average_rating || 0).toFixed(1)}
                      </p>
                      <p>{product.review_count} reviews</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        available
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-rose-500/15 text-rose-200"
                      }`}
                    >
                      {available ? "In stock" : "Out of stock"}
                    </span>
                    <button
                      type="button"
                      disabled={!available}
                      onClick={async () =>
                        addToCart({
                          id: product.id,
                          productId: product.id,
                          slug: product.slug,
                          name: product.title,
                          image: productImage,
                          price: Number(product.price),
                          qty: 1,
                        })
                      }
                      className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add to cart
                    </button>
                  </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/5 px-6 py-4">
          <p className="text-sm text-slate-300">
            Showing {filteredProducts.length} of {count} products from page {page}.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || loading}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400">
              Page {page} of {Number.isFinite(totalPages) ? totalPages : 1}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={loading || !hasNextPage}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
