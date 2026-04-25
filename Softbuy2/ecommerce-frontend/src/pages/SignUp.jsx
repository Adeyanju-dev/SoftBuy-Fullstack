import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import AuthLayout from "../components/AuthLayout";
import softbuyApi from "../lib/softbuyApi";

export default function SignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [error, setError] = useState("");

  const verificationHref = formData.email
    ? `/verify-email-sent?email=${encodeURIComponent(formData.email)}`
    : "/verify-email-sent";

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    setShowLoader(true);

    try {
      const response = await softbuyApi.register({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
        password2: formData.confirm_password,
      });

      if (response.status === 201) {
        setShowLoader(false);
        navigate(verificationHref, { state: { email: formData.email } });
      }
    } catch (signupError) {
      if (signupError.response?.data) {
        const data = signupError.response.data;
        const firstError =
          typeof data === "string"
            ? data
            : Array.isArray(data)
            ? data[0]
            : typeof data === "object"
            ? Object.values(data)[0]?.[0] || Object.values(data)[0]
            : "Failed to sign up.";

        setError(String(firstError));
      } else {
        setError("Network error. Check your connection.");
      }

      setShowLoader(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AnimatePresence>
        {showLoader ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0a0f]/80 backdrop-blur-sm"
          >
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#00ffd5] border-t-transparent" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="relative z-10 mx-auto w-full max-w-md space-y-6">
        <div className="space-y-4">
          <input
            type="text"
            name="first_name"
            placeholder="First Name"
            value={formData.first_name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00ffd5]"
          />
          <input
            type="text"
            name="last_name"
            placeholder="Last Name"
            value={formData.last_name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00ffd5]"
          />
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00ffd5]"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00ffd5]"
          />
          <input
            type="password"
            name="confirm_password"
            placeholder="Confirm Password"
            value={formData.confirm_password}
            onChange={handleChange}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00ffd5]"
          />
        </div>

        {error ? <p className="text-center text-sm font-medium text-red-500">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-to-r from-[#00ffd5] to-[#0077ff] py-3 font-semibold text-gray-900 shadow-md transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>

        <p className="text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link to="/login" className="text-[#00ffd5] transition hover:underline">
            Login
          </Link>
        </p>

        <p className="text-center text-sm text-gray-400">
          Did not get your verification email?{" "}
          <Link
            to={verificationHref}
            state={{ email: formData.email }}
            className="text-[#00ffd5] transition hover:underline"
          >
            Resend it
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
