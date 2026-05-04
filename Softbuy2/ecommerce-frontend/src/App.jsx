import { Suspense, lazy, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "react-hot-toast";
import Loader from "./components/Loader";
import Navbar from "./components/Navbar";
import ScrollToTop from "./components/ScrollToTop";
import RequireAuth from "./components/RequireAuth";
import RequireSeller from "./components/RequireSeller";
import { WishlistProvider } from "./context/WishlistContext";

const Home = lazy(() => import("./components/Home"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const Settings = lazy(() => import("./pages/Settings"));
const Addresses = lazy(() => import("./pages/Addresses"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Payments = lazy(() => import("./pages/Payments"));
const Reviews = lazy(() => import("./pages/Reviews"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const SignUp = lazy(() => import("./pages/SignUp"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const VerifyEmailSent = lazy(() => import("./pages/VerifyEmailSent"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const SellerProfile = lazy(() => import("./pages/SellerProfile"));
const SellerProducts = lazy(() => import("./pages/SellerProducts"));
const SellerPayouts = lazy(() => import("./pages/SellerPayouts"));
const SellerRefunds = lazy(() => import("./pages/SellerRefunds"));
const SellerReviews = lazy(() => import("./pages/SellerReviews"));

function RouteLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-200">
        <span className="h-3 w-3 animate-pulse rounded-full bg-cyan-300" />
        Loading page
      </div>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const previousOverflow = document.body.style.overflowY;
    document.body.style.overflowY = loading ? "hidden" : "auto";

    const timer = setTimeout(() => {
      setLoading(false);
    }, 900);

    return () => {
      clearTimeout(timer);
      document.body.style.overflowY = previousOverflow;
    };
  }, [loading]);

  return (
    <WishlistProvider>
      <Toaster position="top-right" />

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-screen items-center justify-center bg-slate-950"
          >
            <Loader />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-slate-950 text-slate-100"
          >
            <Navbar />
            <ScrollToTop />

            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:slug" element={<ProductDetails />} />
                <Route path="/product/:slug" element={<ProductDetails />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/cart" element={<Cart />} />

                <Route
                  path="/checkout"
                  element={
                    <RequireAuth>
                      <Checkout />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <RequireAuth>
                      <Orders />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders/:orderNumber"
                  element={
                    <RequireAuth>
                      <OrderDetails />
                    </RequireAuth>
                  }
                />
                <Route path="/order-success" element={<OrderSuccess />} />
                <Route path="/verify-payment" element={<OrderSuccess />} />
                <Route path="/payment/ver" element={<OrderSuccess />} />
                <Route path="/payment/verify" element={<OrderSuccess />} />
                <Route path="/payments/verify" element={<OrderSuccess />} />
                <Route path="/paystack/callback" element={<OrderSuccess />} />
                <Route path="/checkout/verify" element={<OrderSuccess />} />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <ProfilePage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/seller"
                  element={
                    <RequireSeller>
                      <SellerDashboard />
                    </RequireSeller>
                  }
                />
                <Route
                  path="/seller/profile"
                  element={
                    <RequireSeller>
                      <SellerProfile />
                    </RequireSeller>
                  }
                />
                <Route
                  path="/seller/products"
                  element={
                    <RequireSeller>
                      <SellerProducts />
                    </RequireSeller>
                  }
                />
                <Route
                  path="/seller/payouts"
                  element={
                    <RequireSeller>
                      <SellerPayouts />
                    </RequireSeller>
                  }
                />
                <Route
                  path="/seller/refunds"
                  element={
                    <RequireSeller>
                      <SellerRefunds />
                    </RequireSeller>
                  }
                />
                <Route
                  path="/seller/reviews"
                  element={
                    <RequireSeller>
                      <SellerReviews />
                    </RequireSeller>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RequireAuth>
                      <Settings />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/addresses"
                  element={
                    <RequireAuth>
                      <Addresses />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <RequireAuth>
                      <Notifications />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/payments"
                  element={
                    <RequireAuth>
                      <Payments />
                    </RequireAuth>
                  }
                />

                <Route path="/signup" element={<SignUp />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reset-password/:uidb64/:token" element={<ResetPassword />} />
                <Route path="/verify-email/:uidb64/:token" element={<VerifyEmail />} />
                <Route path="/verify-email-sent" element={<VerifyEmailSent />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </WishlistProvider>
  );
}
