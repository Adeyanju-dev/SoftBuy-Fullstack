import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Heart, ShieldCheck, Star, ThumbsUp } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import {
  formatCurrency,
  formatDateTime,
  formatObjectSummary,
} from "../lib/formatters";
import { resolveMediaUrl } from "../lib/media";
import { getProductImage } from "../lib/productMedia";
import softbuyApi from "../lib/softbuyApi";

function isProductAvailable(product) {
  if (typeof product?.is_in_stock === "boolean") {
    return product.is_in_stock;
  }

  return Number(product?.stock || 0) > 0;
}

export default function ProductDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { addToCart } = useCart();
  const { wishlist, addToWishlist, removeFromWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [mainImage, setMainImage] = useState("");

  const loadProductReviews = useCallback(async (productSlug) => {
    const response = await softbuyApi.listAllReviews();
    return softbuyApi
      .extractResults(response.data)
      .filter((review) => review.product_slug === productSlug);
  }, []);

  useEffect(() => {
    let active = true;

    const loadProduct = async () => {
      setLoading(true);
      setError("");

      try {
        const [productResponse, nextReviews] = await Promise.all([
          softbuyApi.getProduct(slug),
          loadProductReviews(slug),
        ]);

        if (!active) {
          return;
        }

        const nextProduct = productResponse.data;

        setProduct(nextProduct);
        setReviews(nextReviews.filter((review) => review.product_slug === nextProduct.slug));
        setMainImage(getProductImage(nextProduct));
      } catch (loadError) {
        if (active) {
          setError(loadError.response?.data?.error || "Could not load this product.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadProduct();

    return () => {
      active = false;
    };
  }, [loadProductReviews, slug]);

  const selectedVariant = useMemo(() => {
    if (!selectedVariantId || !Array.isArray(product?.variants)) {
      return null;
    }

    return (
      product.variants.find((variant) => Number(variant.id) === Number(selectedVariantId)) ||
      null
    );
  }, [product?.variants, selectedVariantId]);

  const isAvailable = isProductAvailable(product);
  const isWishlisted = wishlist.some((item) => Number(item.id) === Number(product?.id));

  const handleHelpfulToggle = async (reviewId) => {
    if (!isLoggedIn) {
      navigate("/login", { state: { from: `/products/${slug}` } });
      return;
    }

    await softbuyApi.markReviewHelpful(reviewId);
    setReviews(await loadProductReviews(product.slug));
  };

  if (loading) {
    return (
      <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto h-[36rem] max-w-6xl animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
      </section>
    );
  }

  if (error || !product) {
    return (
      <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-8 text-center">
          <h1 className="text-2xl font-semibold">Product not available</h1>
          <p className="mt-3 text-sm text-rose-100/80">
            {error || "This product could not be found."}
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-white"
          >
            Back to catalog
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80">
              {mainImage ? (
                <img src={mainImage} alt={product.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-slate-500">
                  No image available
                </div>
              )}
            </div>

            {product.images?.length ? (
              <div className="grid grid-cols-4 gap-3">
                {product.images.map((image) => {
                  const imageUrl = resolveMediaUrl(image.image_url || image.image);
                  return (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setMainImage(imageUrl)}
                      className={`overflow-hidden rounded-2xl border ${
                        mainImage === imageUrl ? "border-cyan-400" : "border-white/10"
                      }`}
                    >
                      <img
                        src={imageUrl}
                        alt={image.alt_text || product.title}
                        className="aspect-square h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="rounded-full border border-white/10 px-3 py-1">
                {product.category_name}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1">
                SKU {product.sku}
              </span>
              <span
                className={`rounded-full px-3 py-1 ${
                  isAvailable
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-rose-500/15 text-rose-200"
                }`}
              >
                {isAvailable ? "In stock" : "Out of stock"}
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-black text-white">{product.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                <span>{product.seller_business_name}</span>
                {product.seller_verified ? (
                  <span className="inline-flex items-center gap-1 text-cyan-200">
                    <ShieldCheck className="h-4 w-4" />
                    Verified seller
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Star className="h-4 w-4 fill-current" />
                  {Number(product.average_rating || 0).toFixed(1)} ({product.review_count} reviews)
                </span>
              </div>
            </div>

            <div>
              <p className="text-3xl font-bold text-cyan-200">
                {formatCurrency(selectedVariant?.price || product.price, product.currency || "NGN")}
              </p>
              {product.compare_price ? (
                <p className="text-sm text-slate-500 line-through">
                  {formatCurrency(product.compare_price, product.currency || "NGN")}
                </p>
              ) : null}
            </div>

            <p className="leading-7 text-slate-300">{product.description}</p>

            {product.tag_names?.length ? (
              <div className="flex flex-wrap gap-2">
                {product.tag_names.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}

            {product.variants?.length ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Select variant</span>
                <select
                  value={selectedVariantId}
                  onChange={(event) => setSelectedVariantId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                >
                  <option value="">Default product option</option>
                  {product.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {formatObjectSummary(variant.attributes, "Product option")} -{" "}
                      {formatCurrency(variant.price, product.currency || "NGN")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="flex items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/70">
                <button
                  type="button"
                  onClick={() => setQty((current) => Math.max(1, current - 1))}
                  className="px-4 py-3 text-lg"
                >
                  -
                </button>
                <span className="min-w-12 text-center text-sm font-semibold">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((current) => current + 1)}
                  className="px-4 py-3 text-lg"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={async () =>
                  addToCart({
                    id: product.id,
                    productId: product.id,
                    variantId: selectedVariantId || null,
                    slug: product.slug,
                    name: product.title,
                    image: getProductImage(product),
                    price: Number(selectedVariant?.price || product.price),
                    qty,
                  })
                }
                disabled={!isAvailable}
                className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add to cart
              </button>

              <button
                type="button"
                onClick={() =>
                  isWishlisted
                    ? removeFromWishlist(product.id)
                    : addToWishlist({
                        id: product.id,
                        slug: product.slug,
                        name: product.title,
                        image: getProductImage(product),
                        price: Number(product.price),
                      })
                }
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-200"
              >
                <Heart className={`h-4 w-4 ${isWishlisted ? "fill-pink-500 text-pink-500" : ""}`} />
                {isWishlisted ? "Saved" : "Save"}
              </button>
            </div>
          </motion.div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Latest reviews</h2>
              <p className="text-sm text-slate-400">See what recent customers had to say.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/reviews?product=${product.slug}&productId=${product.id}`}
                className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100"
              >
                Write a review
              </Link>
              <Link
                to={`/reviews?product=${product.slug}&productId=${product.id}`}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200"
              >
                View all reviews
              </Link>
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/40 p-6 text-sm text-slate-400">
              No reviews for this product yet.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-3xl border border-white/10 bg-slate-900/40 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{review.title || "Customer review"}</p>
                      <p className="text-sm text-slate-400">
                        {review.user_name} • {formatDateTime(review.created_at)}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-3 py-1 text-sm text-amber-200">
                      <Star className="h-4 w-4 fill-current" />
                      {review.rating}/5
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-slate-300">
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
                    {review.is_verified ? (
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                        Verified purchase
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
