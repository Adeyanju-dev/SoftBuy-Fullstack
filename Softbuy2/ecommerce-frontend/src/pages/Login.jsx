import { useMemo, useState } from "react";
import AuthLayout from "../components/AuthLayout";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerificationHelp, setShowVerificationHelp] = useState(false);
  const { login } = useAuth();

  const resendVerificationHref = useMemo(() => {
    const params = new URLSearchParams();

    if (formData.email) {
      params.set("email", formData.email);
    }

    const query = params.toString();
    return query ? `/verify-email-sent?${query}` : "/verify-email-sent";
  }, [formData.email]);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      return;
    }

    setError("");
    setShowVerificationHelp(false);
    setLoading(true);

    try {
      await login(formData.email, formData.password);
    } catch (loginError) {
      const nextError =
        loginError.response?.data?.error || loginError.message || "Could not log in right now.";

      setError(nextError);
      setShowVerificationHelp(
        loginError.response?.status === 403 && /verify/i.test(String(nextError))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
        <div className="space-y-4">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="email"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg placeholder-gray-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#00ffd5]"
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="current-password"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg placeholder-gray-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#00ffd5]"
          />
        </div>

        {error ? <p className="text-sm text-center text-rose-300">{error}</p> : null}

        {showVerificationHelp ? (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            <p>Your account exists, but the email still needs to be verified.</p>
            <Link
              to={resendVerificationHref}
              state={{ email: formData.email }}
              className="mt-2 inline-block font-semibold text-[#00ffd5] hover:underline"
            >
              Resend verification email
            </Link>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#00ffd5] to-[#0077ff] text-gray-900 font-semibold py-3 rounded-lg shadow-md hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <div className="flex justify-between text-sm text-gray-400">
          <Link to="/forgot-password" className="hover:text-[#00ffd5]">
            Forgot Password?
          </Link>
          <Link to="/signup" className="hover:text-[#00ffd5]">
            Create Account
          </Link>
        </div>

        <p className="text-center text-sm text-gray-400">
          Need a new verification link?{" "}
          <Link
            to={resendVerificationHref}
            state={{ email: formData.email }}
            className="text-[#00ffd5] hover:underline"
          >
            Resend email
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;
