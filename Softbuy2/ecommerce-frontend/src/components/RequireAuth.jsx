import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireAuth({ children }) {
  const location = useLocation();
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <section className="min-h-screen bg-slate-950 px-6 pt-28 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
          <p className="text-lg font-medium">Checking your account...</p>
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

  return children;
}
