import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  BriefcaseBusiness,
  CreditCard,
  Heart,
  Home,
  LogOut,
  MapPinned,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  UserCircle2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import softbuyApi from "../lib/softbuyApi";
import { sellerWorkspaceLinks } from "./SellerWorkspaceNav";

const basePrimaryLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/products", label: "Products", icon: Search },
  { to: "/reviews", label: "Reviews", icon: Package },
];

const accountLinks = [
  { to: "/profile", label: "Profile", icon: UserCircle2 },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/addresses", label: "Addresses", icon: MapPinned },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavItem({ to, icon: Icon, label, active, badge, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
        active
          ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {badge ? (
        <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-200">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function MobileMenuTile({ to, icon: Icon, label, active, badge, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
        active
          ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {badge ? (
        <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-200">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export default function Navbar() {
  const { pathname } = useLocation();
  const { user, isLoggedIn, isSeller, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlist } = useWishlist();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileMenuPosition, setProfileMenuPosition] = useState({ top: 76, right: 24 });

  const profileRef = useRef(null);
  const profileButtonRef = useRef(null);

  const wishlistCount = wishlist.length;
  const primaryLinks = isSeller
    ? [...basePrimaryLinks, { to: "/seller", label: "Seller", icon: BriefcaseBusiness }]
    : basePrimaryLinks;
  const displayName = useMemo(() => {
    if (user?.first_name) {
      return `${user.first_name}${user.last_name ? ` ${user.last_name}` : ""}`;
    }
    return user?.email || "Account";
  }, [user]);

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  const syncProfileMenuPosition = useCallback(() => {
    const button = profileButtonRef.current;

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    setProfileMenuPosition({
      top: Math.round(rect.bottom + 12),
      right: Math.max(16, Math.round(window.innerWidth - rect.right)),
    });
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!profileOpen) {
      return undefined;
    }

    syncProfileMenuPosition();

    const handleViewportChange = () => {
      syncProfileMenuPosition();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [profileOpen, syncProfileMenuPosition]);

  useEffect(() => {
    let active = true;

    const loadUnreadCount = async () => {
      if (!isLoggedIn) {
        setUnreadCount(0);
        return;
      }

      try {
        const response = await softbuyApi.getUnreadNotificationCount();
        if (active) {
          setUnreadCount(Number(response.data?.unread_count || 0));
        }
      } catch {
        if (active) {
          setUnreadCount(0);
        }
      }
    };

    const handleNotificationsChanged = () => {
      loadUnreadCount();
    };

    loadUnreadCount();
    window.addEventListener("notificationsChanged", handleNotificationsChanged);

    return () => {
      active = false;
      window.removeEventListener("notificationsChanged", handleNotificationsChanged);
    };
  }, [isLoggedIn]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20">
            SB
          </div>
          <p className="text-lg font-semibold text-white">SoftBuy</p>
        </Link>

        <nav className="hidden items-center gap-2 lg:flex">
          {primaryLinks.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              active={pathname === item.to || pathname.startsWith(`${item.to}/`)}
            />
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <NavItem
            to="/wishlist"
            label="Wishlist"
            icon={Heart}
            active={pathname === "/wishlist"}
            badge={wishlistCount || undefined}
          />
          <NavItem
            to="/cart"
            label="Cart"
            icon={ShoppingCart}
            active={pathname === "/cart" || pathname === "/checkout"}
            badge={cartCount || undefined}
          />
          {isLoggedIn ? (
            <>
              <NavItem
                to="/notifications"
                label="Alerts"
                icon={Bell}
                active={pathname === "/notifications"}
                badge={unreadCount || undefined}
              />

              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  ref={profileButtonRef}
                  onClick={() => setProfileOpen((previous) => !previous)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                >
                  <UserCircle2 className="h-4 w-4" />
                  <span className="max-w-40 truncate">{displayName}</span>
                </button>

                <AnimatePresence>
                  {profileOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      style={profileMenuPosition}
                      className="softbuy-scrollbar fixed z-[60] w-64 max-h-[calc(100vh-5.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl"
                    >
                      <div className="border-b border-white/10 px-3 pb-3">
                        <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                        <p className="truncate text-xs text-slate-400">{user?.email}</p>
                      </div>

                      <div className="mt-2 flex flex-col gap-1">
                        {accountLinks.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                            >
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>

                      {isSeller ? (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          <p className="px-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                            Seller tools
                          </p>
                          <div className="mt-2 flex flex-col gap-1">
                            {sellerWorkspaceLinks.map((item) => {
                              const Icon = item.icon;
                              return (
                                <Link
                                  key={item.to}
                                  to={item.to}
                                  onClick={() => setProfileOpen(false)}
                                  className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                                >
                                  <Icon className="h-4 w-4" />
                                  <span>{item.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={logout}
                        className="mt-2 flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/10"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
              >
                Create account
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((previous) => !previous)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 md:hidden"
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="border-t border-white/10 bg-slate-950/95 px-4 py-4 md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-4">
              {isLoggedIn ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                  <p className="truncate text-xs text-slate-400">{user?.email}</p>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                {primaryLinks.map((item) => (
                  <MobileMenuTile
                    key={item.to}
                    {...item}
                    active={pathname === item.to || pathname.startsWith(`${item.to}/`)}
                    onClick={() => setMenuOpen(false)}
                  />
                ))}
                <MobileMenuTile
                  to="/wishlist"
                  label="Wishlist"
                  icon={Heart}
                  active={pathname === "/wishlist"}
                  badge={wishlistCount || undefined}
                  onClick={() => setMenuOpen(false)}
                />
                <MobileMenuTile
                  to="/cart"
                  label="Cart"
                  icon={ShoppingCart}
                  active={pathname === "/cart" || pathname === "/checkout"}
                  badge={cartCount || undefined}
                  onClick={() => setMenuOpen(false)}
                />
              </div>

              {isLoggedIn ? (
                <>
                  <details className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                      Account
                    </summary>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {accountLinks.map((item) => (
                        <MobileMenuTile
                          key={item.to}
                          {...item}
                          active={pathname === item.to}
                          badge={
                            item.to === "/notifications" && unreadCount
                              ? unreadCount
                              : undefined
                          }
                          onClick={() => setMenuOpen(false)}
                        />
                      ))}
                    </div>
                  </details>

                  {isSeller ? (
                    <details className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                        Seller tools
                      </summary>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {sellerWorkspaceLinks.map((item) => (
                          <MobileMenuTile
                            key={item.to}
                            {...item}
                            active={
                              item.to === "/seller"
                                ? pathname === item.to
                                : pathname === item.to || pathname.startsWith(`${item.to}/`)
                            }
                            onClick={() => setMenuOpen(false)}
                          />
                        ))}
                      </div>
                    </details>
                  ) : null}

                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-left text-sm font-medium text-rose-200"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-2xl border border-cyan-400/40 px-4 py-3 text-center text-sm text-cyan-200"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 px-4 py-3 text-center text-sm font-semibold text-slate-950"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
