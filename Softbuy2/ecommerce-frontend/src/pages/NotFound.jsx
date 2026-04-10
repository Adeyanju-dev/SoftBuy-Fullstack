import { useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getPaystackReferenceFromSearchParams } from "../lib/payments";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reference = getPaystackReferenceFromSearchParams(searchParams);

  useEffect(() => {
    if (!reference) {
      return;
    }

    navigate(`/verify-payment?reference=${encodeURIComponent(reference)}`, {
      replace: true,
      state: {
        fromMissingPage: `${location.pathname}${location.search}`,
      },
    });
  }, [location.pathname, location.search, navigate, reference]);

  if (reference) {
    return (
      <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-10 text-center backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Recovering payment</p>
          <h1 className="mt-4 text-4xl font-black text-white">Finishing your Paystack return</h1>
          <p className="mt-4 text-sm text-slate-200">
            A payment reference was found in this URL, so we are sending you to the verification
            page now.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Page not found</p>
        <h1 className="mt-4 text-4xl font-black text-white">That page does not exist here</h1>
        <p className="mt-4 text-sm text-slate-300">
          The link may be outdated or incomplete. Use one of the links below to keep moving.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/products"
            className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950"
          >
            Browse products
          </Link>
          <Link
            to="/orders"
            className="rounded-full border border-white/10 px-6 py-3 font-semibold text-white"
          >
            Open orders
          </Link>
        </div>
      </div>
    </section>
  );
}
