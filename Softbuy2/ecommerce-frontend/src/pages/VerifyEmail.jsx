import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import softbuyApi from "../lib/softbuyApi";

export default function VerifyEmail() {
  const { uidb64, token } = useParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const response = await softbuyApi.verifyEmail(uidb64, token);
        if (active) {
          setStatus("success");
          setMessage(response.data?.message || "Email verified. You can now log in.");
        }
      } catch (error) {
        if (active) {
          setStatus("error");
          setMessage(error.response?.data?.error || "Verification failed or link expired.");
        }
      }
    };

    verify();

    return () => {
      active = false;
    };
  }, [token, uidb64]);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCooldown((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email) {
      setResendMessage("Please enter your email.");
      return;
    }

    setResending(true);
    setResendMessage("");

    try {
      const response = await softbuyApi.resendVerification(email);
      setResendMessage(response.data?.message || "Verification email sent.");
      setCooldown(60);
    } catch (error) {
      if (error.response?.status === 429) {
        setCooldown(error.response.data.remaining || 60);
        setResendMessage("Please wait before resending.");
      } else {
        setResendMessage(error.response?.data?.error || "Failed to resend email.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mx-auto max-w-md space-y-6 py-12 text-center">
        {status === "loading" ? <p className="text-gray-300">Verifying your email...</p> : null}

        {status === "success" ? (
          <>
            <h2 className="text-2xl font-semibold text-green-400">Email verified</h2>
            <p className="text-gray-300">{message}</p>
            <Link
              to="/login"
              className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-white transition hover:bg-indigo-500"
            >
              Go to login
            </Link>
          </>
        ) : null}

        {status === "error" ? (
          <>
            <h2 className="text-2xl font-semibold text-red-400">Verification failed</h2>
            <p className="text-gray-300">{message}</p>

            <div className="mt-6 space-y-4">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <button
                type="button"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className={`w-full rounded-lg py-3 font-semibold transition ${
                  cooldown > 0
                    ? "cursor-not-allowed bg-gray-600 text-gray-300"
                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                }`}
              >
                {cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : resending
                  ? "Sending..."
                  : "Resend verification email"}
              </button>

              {resendMessage ? <p className="text-sm text-gray-300">{resendMessage}</p> : null}
            </div>

            <Link
              to="/signup"
              className="inline-block text-sm text-indigo-400 hover:underline"
            >
              Create a new account
            </Link>
          </>
        ) : null}
      </div>
    </AuthLayout>
  );
}
