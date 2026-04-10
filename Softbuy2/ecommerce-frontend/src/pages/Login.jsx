import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth} from "../context/AuthContext";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const { login } = useAuth();

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      alert("Both email and password are required.");
      return;
    }

    setLoading(true);

    try {
      await login(formData.email, formData.password);
      setShowLoader(true);

    } catch {
      setLoading(false);
      alert("Invalid email or password.");
    }
  };

  return (
    <AuthLayout>
      <AnimatePresence>
        {showLoader && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/80 backdrop-blur-sm z-50"
          >
            <div className="w-12 h-12 border-4 border-[#00ffd5] border-t-transparent rounded-full animate-spin"></div>
          </motion.div>
        )}
      </AnimatePresence>

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
      </form>
    </AuthLayout>
  );
};

export default Login;
