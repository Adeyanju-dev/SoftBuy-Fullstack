import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { resolveMediaUrl } from "../lib/media";
import { useAuth } from "./AuthContext";
import softbuyApi from "../lib/softbuyApi";

const CartContext = createContext(null);
const GUEST_CART_KEY = "softbuy-cart";

function readGuestCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse guest cart:", error);
    return [];
  }
}

function writeGuestCart(cart) {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  } catch (error) {
    console.warn("Failed to persist guest cart:", error);
  }
}

function clearGuestCart() {
  localStorage.removeItem(GUEST_CART_KEY);
}

function normalizeGuestItem(item) {
  return {
    id: Number(item.id),
    productId: Number(item.productId ?? item.id),
    variantId: item.variantId ? Number(item.variantId) : null,
    slug: item.slug || "",
    name: item.name || "",
    price: Number(item.price || 0),
    image: resolveMediaUrl(item.image),
    qty: Math.max(1, Number(item.qty || 1)),
    remote: false,
  };
}

function normalizeRemoteCart(cartPayload) {
  const items = Array.isArray(cartPayload?.items) ? cartPayload.items : [];

  return items.map((item) => ({
    id: Number(item.id),
    productId: Number(item.product),
    variantId: item.variant ? Number(item.variant) : null,
    slug: item.product_slug || "",
    name: item.product_title || item.product_name || "Product",
    price: Number(item.unit_price || item.price || 0),
    image: resolveMediaUrl(item.product_image),
    qty: Math.max(1, Number(item.quantity || 1)),
    totalPrice: Number(item.total_price || 0),
    remote: true,
  }));
}

function persistAndSetGuestCart(setCart, updater) {
  setCart((previous) => {
    const nextValue = typeof updater === "function" ? updater(previous) : updater;
    writeGuestCart(nextValue);
    return nextValue;
  });
}

export function CartProvider({ children }) {
  const { isLoggedIn, access } = useAuth();
  const [cart, setCart] = useState([]);
  const [cartLoading, setCartLoading] = useState(true);
  const guestMergeAttemptedRef = useRef(false);

  const syncRemoteCart = useCallback(async () => {
    const response = await softbuyApi.getCart();
    const nextCart = normalizeRemoteCart(response.data);
    setCart(nextCart);
    return nextCart;
  }, []);

  useEffect(() => {
    let isActive = true;

    const bootstrapCart = async () => {
      setCartLoading(true);

      if (!isLoggedIn || !access) {
        guestMergeAttemptedRef.current = false;
        if (isActive) {
          setCart(readGuestCart().map(normalizeGuestItem));
          setCartLoading(false);
        }
        return;
      }

      try {
        const guestCart = readGuestCart().map(normalizeGuestItem);

        if (!guestMergeAttemptedRef.current && guestCart.length > 0) {
          guestMergeAttemptedRef.current = true;

          for (const item of guestCart) {
            await softbuyApi.addToCart({
              product_id: item.productId,
              variant_id: item.variantId,
              quantity: item.qty,
            });
          }

          clearGuestCart();
          toast.success("Your guest cart was synced to your account");
        }

        const remoteCart = await softbuyApi.getCart();

        if (isActive) {
          setCart(normalizeRemoteCart(remoteCart.data));
        }
      } catch (error) {
        console.warn("Failed to sync backend cart:", error);
        if (isActive) {
          setCart(readGuestCart().map(normalizeGuestItem));
          toast.error(error.response?.data?.error || "Could not sync your cart right now");
        }
      } finally {
        if (isActive) {
          setCartLoading(false);
        }
      }
    };

    bootstrapCart();

    return () => {
      isActive = false;
    };
  }, [isLoggedIn, access]);

  const addToCart = useCallback(async (product) => {
    const productId = Number(product.productId ?? product.id);
    const quantity = Math.max(1, Number(product.qty || 1));
    const nextItem = normalizeGuestItem({
      ...product,
      id: productId,
      productId,
      qty: quantity,
    });

    if (!isLoggedIn || !access) {
      persistAndSetGuestCart(setCart, (previous) => {
        const existingIndex = previous.findIndex(
          (item) =>
            Number(item.productId ?? item.id) === productId &&
            Number(item.variantId || 0) === Number(nextItem.variantId || 0)
        );

        if (existingIndex >= 0) {
          return previous.map((item, index) =>
            index === existingIndex ? { ...item, qty: item.qty + quantity } : item
          );
        }

        return [...previous, nextItem];
      });

      toast.success(`${nextItem.name || "Item"} added to cart`);
      return;
    }

    try {
      const response = await softbuyApi.addToCart({
        product_id: productId,
        variant_id: nextItem.variantId,
        quantity,
      });

      setCart(normalizeRemoteCart(response.data));
      toast.success(`${nextItem.name || "Item"} added to cart`);
      return true;
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Could not add this item to your cart.";
      toast.error(message);
      return false;
    }
  }, [access, isLoggedIn]);

  const updateQty = useCallback(async (id, qty) => {
    const nextQty = Math.max(1, Number(qty || 1));

    if (!isLoggedIn || !access) {
      persistAndSetGuestCart(setCart, (previous) =>
        previous.map((item) =>
          Number(item.id) === Number(id) ? { ...item, qty: nextQty } : item
        )
      );
      return;
    }

    const response = await softbuyApi.updateCartItem(id, nextQty);
    setCart(normalizeRemoteCart(response.data));
  }, [access, isLoggedIn]);

  const removeFromCart = useCallback(async (id) => {
    if (!isLoggedIn || !access) {
      persistAndSetGuestCart(setCart, (previous) =>
        previous.filter((item) => Number(item.id) !== Number(id))
      );
      return;
    }

    const response = await softbuyApi.removeCartItem(id);
    setCart(normalizeRemoteCart(response.data));
    toast.success("Item removed from cart");
  }, [access, isLoggedIn]);

  const clearCart = useCallback(async () => {
    if (!isLoggedIn || !access) {
      setCart([]);
      clearGuestCart();
      toast.success("Cart cleared");
      return;
    }

    const currentIds = cart.map((item) => item.id);
    await Promise.all(currentIds.map((itemId) => softbuyApi.removeCartItem(itemId)));
    setCart([]);
    toast.success("Cart cleared");
  }, [access, cart, isLoggedIn]);

  const value = {
    cart,
    cartLoading,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    cartCount: cart.reduce((total, item) => total + item.qty, 0),
    subtotal: cart.reduce((total, item) => total + item.price * item.qty, 0),
    syncCart: syncRemoteCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
}

export default CartContext;
