import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import softbuyApi from "../lib/softbuyApi";

export default function VerifyEmailSent() {
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextEmail = location.state?.email || params.get("email") || "";

    if (nextEmail) {
      setEmail(nextEmail);
    }
  }, [location.search, location.state]);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCooldown((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resendVerification = async () => {
    if (!email) {
      setError("No email address is available for resending.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await softbuyApi.resendVerification(email);
      setMessage(response.data?.message || "Verification email resent.");
      setCooldown(60);
    } catch (resendError) {
      if (resendError.response?.status === 429) {
        setCooldown(resendError.response?.data?.remaining || 60);
        setError("Please wait before resending.");
      } else {
        setError(resendError.response?.data?.error || "Could not resend verification email.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mx-auto max-w-md py-12 text-center">
        <h2 className="mb-4 text-2xl font-semibold">Verify your email</h2>

        <p className="mb-4 text-gray-300">
          We sent a verification link
          {email ? <span className="font-medium"> to {email}</span> : null}. Click the link in
          your email to activate your account.
        </p>

        <p className="mb-6 text-sm text-gray-400">
          Did not receive the email? Check your spam folder or resend it below.
        </p>

        {message ? <p className="mb-4 text-sm text-green-400">{message}</p> : null}
        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          className="mb-4 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />

        <button
          type="button"
          onClick={resendVerification}
          disabled={loading || cooldown > 0}
          className={`w-full rounded-lg px-4 py-2 transition ${
            loading || cooldown > 0
              ? "cursor-not-allowed bg-gray-600"
              : "bg-indigo-600 hover:bg-indigo-500"
          }`}
        >
          {cooldown > 0
            ? `Resend in ${cooldown}s`
            : loading
            ? "Resending..."
            : "Resend verification email"}
        </button>

        <div className="mt-6 text-sm text-gray-400">
          Already verified?
          <Link to="/login" className="ml-1 text-indigo-400 hover:underline">
            Go to login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
