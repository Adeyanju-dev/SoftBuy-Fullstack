import { ShieldCheck, Store } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

export default function RequireSeller({ children }) {
  const location = useLocation();
  const { loading, isLoggedIn, isSeller, enableSellerAccess } = useAuth();
  const [enablingSeller, setEnablingSeller] = useState(false);

  if (loading) {
    return (
      <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-200">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-black text-white">Checking seller access</h1>
          <p className="mt-2 text-sm text-slate-400">
            We are validating your SoftBuy seller permissions.
          </p>
        </div>
      </section>
    );
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (!isSeller) {
    return (
      <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/5 p-10 backdrop-blur-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-200">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="mt-2 text-4xl font-black text-white">
            This account is not marked as a seller yet
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            This sign-in can shop normally, but seller tools stay locked until the account
            has seller access enabled.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                setEnablingSeller(true);
                try {
                  await enableSellerAccess();
                } finally {
                  setEnablingSeller(false);
                }
              }}
              disabled={enablingSeller}
              className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enablingSeller ? "Enabling seller access..." : "Become a seller"}
            </button>
            <Link
              to="/settings"
              className="rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-slate-100"
            >
              Open settings
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return children;
}
