import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import softbuyApi from "../lib/softbuyApi";

const AuthContext = createContext(null);

function persistSession({ user, access, refresh }) {
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  }

  if (access) {
    localStorage.setItem("access", access);
  }

  if (refresh) {
    localStorage.setItem("refresh", refresh);
  }

  window.dispatchEvent(new Event("authChanged"));
}

function clearSession() {
  localStorage.removeItem("user");
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  window.dispatchEvent(new Event("authChanged"));
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [access, setAccess] = useState(null);
  const [refresh, setRefresh] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncAuthFromStorage = useCallback(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedAccess = localStorage.getItem("access");
      const storedRefresh = localStorage.getItem("refresh");

      setUser(storedUser ? JSON.parse(storedUser) : null);
      setAccess(storedAccess || null);
      setRefresh(storedRefresh || null);
    } catch (error) {
      console.warn("Failed to restore auth:", error);
      setUser(null);
      setAccess(null);
      setRefresh(null);
    }
  }, []);

  const updateUserState = useCallback((nextUser) => {
    setUser(nextUser);

    if (nextUser) {
      localStorage.setItem("user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("user");
    }

    window.dispatchEvent(new Event("authChanged"));
  }, []);

  useEffect(() => {
    syncAuthFromStorage();
    setLoading(false);
  }, [syncAuthFromStorage]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (!event.key || ["user", "access", "refresh"].includes(event.key)) {
        syncAuthFromStorage();
      }
    };

    const handleAuthChanged = () => {
      syncAuthFromStorage();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("authChanged", handleAuthChanged);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("authChanged", handleAuthChanged);
    };
  }, [syncAuthFromStorage]);

  const login = useCallback(async (email, password) => {
    const response = await softbuyApi.login({ email, password });
    const nextUser = response.data?.user;
    const nextAccess = response.data?.access;
    const nextRefresh = response.data?.refresh;

    persistSession({
      user: nextUser,
      access: nextAccess,
      refresh: nextRefresh,
    });

    setUser(nextUser);
    setAccess(nextAccess);
    setRefresh(nextRefresh);

    toast.success(`Welcome back${nextUser?.first_name ? `, ${nextUser.first_name}` : ""}`);

    const redirectTo = location.state?.from || "/";
    navigate(redirectTo, { replace: true });
  }, [location.state, navigate]);

  const refreshProfile = useCallback(async () => {
    const response = await softbuyApi.getProfile();
    updateUserState(response.data);
    return response.data;
  }, [updateUserState]);

  const updateProfile = useCallback(async (payload) => {
    const response = await softbuyApi.updateProfile(payload);
    updateUserState(response.data);
    toast.success("Profile updated");
    return response.data;
  }, [updateUserState]);

  const enableSellerAccess = useCallback(async () => {
    const response = await softbuyApi.becomeSeller();
    const nextUser = response.data?.user;

    if (nextUser) {
      updateUserState(nextUser);
    } else {
      await refreshProfile();
    }

    toast.success(response.data?.message || "Seller access enabled");
    return response.data;
  }, [refreshProfile, updateUserState]);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setAccess(null);
    setRefresh(null);
    toast.success("Logged out");
    navigate("/login");
  }, [navigate]);

  const isSeller = Boolean(user?.is_seller || user?.seller_profile);

  return (
    <AuthContext.Provider
      value={{
        user,
        access,
        refresh,
        loading,
        isLoggedIn: Boolean(user && access),
        isSeller,
        login,
        logout,
        refreshProfile,
        updateProfile,
        enableSellerAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
