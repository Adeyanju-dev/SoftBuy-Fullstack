import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import softbuyApi from "../lib/softbuyApi";

export default function ResetPassword() {
  const { uidb64, token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTimerRef = useRef(null);
  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isTokenReset = Boolean(uidb64 && token);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      let response = null;

      if (isTokenReset) {
        response = await softbuyApi.confirmPasswordReset({
          uidb64,
          token,
          password,
          password2: confirmPassword,
        });
      } else {
        await softbuyApi.verifyResetCode({ email, code });
        response = await softbuyApi.confirmPasswordReset({
          email,
          code,
          password,
          password2: confirmPassword,
        });
      }

      setMessage(response.data?.message || "Password reset successful.");
      redirectTimerRef.current = window.setTimeout(() => navigate("/login"), 1200);
    } catch (resetError) {
      setError(resetError.response?.data?.error || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-white">Reset password</h2>
          <p className="text-sm text-slate-300">
            {isTokenReset
              ? "Choose a new password for your account."
              : "Enter the code sent to your email, then choose a new password."}
          </p>
        </div>

        {!isTokenReset ? (
          <>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-slate-100 outline-none"
              required
            />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="6-digit reset code"
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-slate-100 outline-none"
              required
            />
          </>
        ) : null}
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-slate-100 outline-none"
          required
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm new password"
          className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-slate-100 outline-none"
          required
        />

        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 font-semibold text-slate-950"
        >
          {loading ? "Resetting..." : "Reset password"}
        </button>

        <p className="text-center text-sm text-slate-400">
          Need a new {isTokenReset ? "reset link" : "code"}?{" "}
          <Link to="/forgot-password" className="text-cyan-200">
            Request another one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
