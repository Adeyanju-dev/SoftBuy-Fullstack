import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import softbuyApi from "../lib/softbuyApi";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await softbuyApi.requestPasswordReset(email);
      setMessage(response.data?.message || "Reset code sent to your email.");
      navigate("/reset-password", {
        state: { email },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not request a password reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-white">Forgot password</h2>
          <p className="text-sm text-slate-300">
            Request a reset code and secure your account quickly.
          </p>
        </div>

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
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
          {loading ? "Sending..." : "Send reset code"}
        </button>
      </form>
    </AuthLayout>
  );
}
