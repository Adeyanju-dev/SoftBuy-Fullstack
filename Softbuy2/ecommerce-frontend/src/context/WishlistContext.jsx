import { createContext, useCallback, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getProductImage } from "../lib/productMedia";
import { useAuth } from "./AuthContext";
import softbuyApi from "../lib/softbuyApi";

const WishlistContext = createContext(null);
const WISHLIST_STORAGE_KEY = "softbuy-wishlist";

function readStoredWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to read wishlist cache:", error);
    return [];
  }
}

function writeStoredWishlist(items) {
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("Failed to persist wishlist cache:", error);
  }
}

function extractWishlistPayloadItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.results,
    payload?.items,
    payload?.wishlist,
    payload?.wishlist_items,
    payload?.data,
    payload?.data?.results,
    payload?.data?.items,
    payload?.data?.wishlist,
    payload?.data?.wishlist_items,
  ];

  return candidates.find(Array.isArray) || [];
}

function normalizeWishlistItem(item) {
  const nestedProduct =
    item?.product && typeof item.product === "object" && !Array.isArray(item.product)
      ? item.product
      : null;

  const product = nestedProduct || item;
  const productId = Number(
    nestedProduct?.id ||
      product?.product_id ||
      product?.product ||
      product?.id
  );

  if (!productId) {
    return null;
  }

  const remoteItemId =
    nestedProduct && item?.id && Number(item.id) !== productId ? Number(item.id) : null;

  return {
    wishlistItemId: remoteItemId || Number(product?.wishlistItemId || product?.wishlist_item_id) || null,
    id: productId,
    slug: product?.slug || product?.product_slug || "",
    name: product?.title || product?.name || product?.product_title || "Product",
    image: getProductImage(product),
    price: Number(product?.price || product?.unit_price || 0),
  };
}

function dedupeWishlist(items) {
  return items.reduce((result, item) => {
    const normalized = normalizeWishlistItem(item);

    if (!normalized || result.some((entry) => Number(entry.id) === Number(normalized.id))) {
      return result;
    }

    result.push(normalized);
    return result;
  }, []);
}

export function WishlistProvider({ children }) {
  const { isLoggedIn, access } = useAuth();
  const [wishlist, setWishlist] = useState(() => readStoredWishlist());
  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [usesRemoteWishlist, setUsesRemoteWishlist] = useState(false);

  const updateWishlist = useCallback((items) => {
    const nextItems = dedupeWishlist(items);
    setWishlist(nextItems);
    writeStoredWishlist(nextItems);
    return nextItems;
  }, []);

  const fetchRemoteWishlist = useCallback(async () => {
    const response = await softbuyApi.listWishlist();
    return dedupeWishlist(extractWishlistPayloadItems(response.data));
  }, []);

  const syncRemoteWishlist = useCallback(async () => {
    const results = await fetchRemoteWishlist();
    const nextItems = updateWishlist(results);
    setUsesRemoteWishlist(true);
    return nextItems;
  }, [fetchRemoteWishlist, updateWishlist]);

  useEffect(() => {
    let active = true;

    const bootstrapWishlist = async () => {
      setWishlistLoading(true);

      if (!isLoggedIn || !access) {
        setUsesRemoteWishlist(false);
        if (active) {
          updateWishlist(readStoredWishlist());
          setWishlistLoading(false);
        }
        return;
      }

      try {
        const localItems = dedupeWishlist(readStoredWishlist());
        let remoteItems = await fetchRemoteWishlist();
        let remoteWishlistReady = true;

        if (localItems.length) {
          const missingItems = localItems.filter(
            (localItem) =>
              !remoteItems.some((remoteItem) => Number(remoteItem.id) === Number(localItem.id))
          );

          for (const item of missingItems) {
            try {
              await softbuyApi.addToWishlist(item.id);
            } catch (itemError) {
              remoteWishlistReady = false;
              console.warn("Failed to sync a wishlist item remotely:", itemError);
            }
          }

          if (missingItems.length && remoteWishlistReady) {
            remoteItems = await fetchRemoteWishlist();

            const stillMissingItems = missingItems.filter(
              (localItem) =>
                !remoteItems.some((remoteItem) => Number(remoteItem.id) === Number(localItem.id))
            );

            if (stillMissingItems.length) {
              remoteWishlistReady = false;
            }
          }
        }

        if (active) {
          if (remoteWishlistReady) {
            updateWishlist(remoteItems);
            setUsesRemoteWishlist(true);
          } else {
            updateWishlist([...remoteItems, ...localItems]);
            setUsesRemoteWishlist(false);
          }
        }
      } catch (error) {
        console.warn("Failed to sync wishlist with backend:", error);
        setUsesRemoteWishlist(false);

        if (active) {
          updateWishlist(readStoredWishlist());
        }
      } finally {
        if (active) {
          setWishlistLoading(false);
        }
      }
    };

    bootstrapWishlist();

    return () => {
      active = false;
    };
  }, [access, fetchRemoteWishlist, isLoggedIn, syncRemoteWishlist, updateWishlist]);

  const addToWishlist = useCallback(
    async (product) => {
      const nextItem = normalizeWishlistItem(product);

      if (!nextItem || wishlist.some((item) => Number(item.id) === Number(nextItem.id))) {
        return;
      }

      if (!isLoggedIn || !access || !usesRemoteWishlist) {
        updateWishlist([...wishlist, nextItem]);
        toast.success(`${nextItem.name} saved to your wishlist`);
        return;
      }

      try {
        await softbuyApi.addToWishlist(nextItem.id);
        await syncRemoteWishlist();
        toast.success(`${nextItem.name} saved to your wishlist`);
      } catch (error) {
        console.warn("Failed to add wishlist item remotely:", error);
        setUsesRemoteWishlist(false);
        updateWishlist([...wishlist, nextItem]);
        toast.success(`${nextItem.name} saved to your wishlist`);
      }
    },
    [access, isLoggedIn, syncRemoteWishlist, updateWishlist, usesRemoteWishlist, wishlist]
  );

  const removeFromWishlist = useCallback(
    async (productId) => {
      const existingItem = wishlist.find((item) => Number(item.id) === Number(productId));

      if (!existingItem) {
        return;
      }

      if (!isLoggedIn || !access || !usesRemoteWishlist) {
        updateWishlist(wishlist.filter((item) => Number(item.id) !== Number(productId)));
        toast.success("Removed from wishlist");
        return;
      }

      try {
        await softbuyApi.removeFromWishlist({
          wishlistItemId: existingItem.wishlistItemId,
          productId,
        });
        await syncRemoteWishlist();
        toast.success("Removed from wishlist");
      } catch (error) {
        console.warn("Failed to remove wishlist item remotely:", error);
        setUsesRemoteWishlist(false);
        updateWishlist(wishlist.filter((item) => Number(item.id) !== Number(productId)));
        toast.success("Removed from wishlist");
      }
    },
    [access, isLoggedIn, syncRemoteWishlist, updateWishlist, usesRemoteWishlist, wishlist]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        wishlistLoading,
        usesRemoteWishlist,
        addToWishlist,
        removeFromWishlist,
        refreshWishlist: syncRemoteWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
