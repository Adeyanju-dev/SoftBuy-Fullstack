import apiClient from "./apiClient";

const wishlistPaths = (
  import.meta.env.VITE_WISHLIST_PATHS ||
  "/api/wishlist/,/api/wishlist/items/,/api/products/wishlist/"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => (value.endsWith("/") ? value : `${value}/`));

function extractResults(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  return [];
}

function extractCount(payload) {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  return Number(payload?.count || 0);
}

function extractNextPage(payload) {
  if (!payload || Array.isArray(payload) || !payload.next) {
    return null;
  }

  try {
    const nextUrl = new URL(payload.next, apiClient.baseUrl);
    const nextPage = Number(nextUrl.searchParams.get("page"));
    return Number.isFinite(nextPage) && nextPage > 0 ? nextPage : null;
  } catch {
    return null;
  }
}

async function collectPaginatedResults(loadPage, options = {}) {
  const visitedPages = new Set();
  const maxPages = Math.max(1, Number(options.maxPages || 25));
  let page = Math.max(1, Number(options.page || 1));
  let pagesLoaded = 0;
  let lastResponse = null;
  let count = 0;
  const results = [];

  while (pagesLoaded < maxPages && !visitedPages.has(page)) {
    visitedPages.add(page);
    lastResponse = await loadPage(page);
    pagesLoaded += 1;

    const pagePayload = lastResponse?.data;
    const pageResults = extractResults(pagePayload);
    const nextPage = extractNextPage(pagePayload);

    results.push(...pageResults);
    count = extractCount(pagePayload) || count || results.length;

    if (!nextPage || pageResults.length === 0) {
      break;
    }

    page = nextPage;
  }

  return {
    status: lastResponse?.status || 200,
    data: {
      count: count || results.length,
      next: null,
      previous: null,
      results,
    },
  };
}

function buildChildPath(path, id) {
  return `${path}${id}/`;
}

async function tryRequestVariants(factories, retryStatuses = [404, 405]) {
  let lastError = null;

  for (const factory of factories) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;

      if (!retryStatuses.includes(status)) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Request could not be completed.");
}

const softbuyApi = {
  extractResults,
  extractCount,

  login(payload) {
    return apiClient.post("/api/auth/login/", payload, { auth: false });
  },

  register(payload) {
    return apiClient.post("/api/auth/register/", payload, { auth: false });
  },

  requestPasswordReset(email) {
    return apiClient.post(
      "/api/auth/password-reset/request/",
      { email },
      { auth: false }
    );
  },

  verifyResetCode(payload) {
    return apiClient.post("/api/auth/password-reset/verify-code/", payload, {
      auth: false,
    });
  },

  confirmPasswordReset(payload) {
    if (payload?.uidb64 && payload?.token) {
      const password = payload.password || "";
      const password2 = payload.password2 || password;

      return tryRequestVariants([
        () =>
          apiClient.post(
            "/api/auth/password-reset/confirm/",
            {
              uidb64: payload.uidb64,
              token: payload.token,
              password,
              password2,
            },
            { auth: false }
          ),
        () =>
          apiClient.post(
            `/api/auth/password-reset/confirm/${payload.uidb64}/${payload.token}/`,
            {
              password,
              password2,
            },
            { auth: false }
          ),
      ]);
    }

    return apiClient.post("/api/auth/password-reset/confirm/", payload, {
      auth: false,
    });
  },

  resendVerification(email) {
    return apiClient.post(
      "/api/auth/resend-verification/",
      { email },
      { auth: false }
    );
  },

  verifyEmail(uidb64, token) {
    return apiClient.get(`/api/auth/verify-email/${uidb64}/${token}/`, {
      auth: false,
    });
  },

  getProfile() {
    return apiClient.get("/api/auth/profile/");
  },

  updateProfile(payload) {
    return apiClient.patch("/api/auth/profile/", payload);
  },

  becomeSeller() {
    return apiClient.post("/api/auth/become-seller/");
  },

  getSellerProfile() {
    return apiClient.get("/api/auth/seller/profile/");
  },

  updateSellerProfile(payload) {
    return apiClient.patch("/api/auth/seller/profile/", payload);
  },

  sendSellerVerificationEmail() {
    return apiClient.post("/api/auth/send-verification/");
  },

  listAddresses(page = 1) {
    return apiClient.get("/api/auth/addresses/", { query: { page } });
  },

  listAllAddresses(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listAddresses(page), options);
  },

  createAddress(payload) {
    return apiClient.post("/api/auth/addresses/", payload);
  },

  updateAddress(id, payload) {
    return apiClient.patch(`/api/auth/addresses/${id}/`, payload);
  },

  deleteAddress(id) {
    return apiClient.delete(`/api/auth/addresses/${id}/`);
  },

  listProducts(page = 1, options = {}) {
    const { auth = false, query = {} } = options || {};

    return apiClient.get("/api/products/", {
      auth,
      query: { ...query, page },
    });
  },

  listAllProducts(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listProducts(page, options), options);
  },

  listSellerProducts(page = 1) {
    return tryRequestVariants([
      () => apiClient.get("/api/products/seller/", { query: { page } }),
      () => apiClient.get("/api/products/my-products/", { query: { page } }),
      () => apiClient.get("/api/auth/seller/products/", { query: { page } }),
      () => softbuyApi.listProducts(page, { auth: true }),
    ]);
  },

  listAllSellerProducts(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listSellerProducts(page), options);
  },

  getProduct(slug, options = {}) {
    return apiClient.get(`/api/products/${slug}/`, { auth: false, ...(options || {}) });
  },

  createProduct(payload) {
    return apiClient.post("/api/products/", payload);
  },

  updateProduct(slug, payload) {
    return tryRequestVariants([
      () => apiClient.patch(`/api/products/${slug}/`, payload),
      () => apiClient.put(`/api/products/${slug}/`, payload),
    ]);
  },

  deleteProduct(slug) {
    return apiClient.delete(`/api/products/${slug}/`);
  },

  listProductImages(productId) {
    return apiClient.get(`/api/products/${productId}/images/`);
  },

  uploadProductImage(productId, formData) {
    return apiClient.post(`/api/products/${productId}/images/`, formData);
  },

  deleteProductImage(productId, imageId) {
    return apiClient.delete(`/api/products/${productId}/images/${imageId}/`);
  },

  listCategories(page = 1) {
    return apiClient.get("/api/products/categories/", {
      query: { page },
    });
  },

  listAllCategories(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listCategories(page), options);
  },

  listTags(page = 1) {
    return apiClient.get("/api/products/tags/", {
      query: { page },
    });
  },

  listAllTags(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listTags(page), options);
  },

  listReviews(page = 1) {
    return apiClient.get("/api/reviews/", {
      auth: false,
      query: { page },
    });
  },

  listAllReviews(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listReviews(page), options);
  },

  createReview(payload) {
    return apiClient.post("/api/reviews/", payload);
  },

  markReviewHelpful(id) {
    return apiClient.post(`/api/reviews/${id}/helpful/`);
  },

  listWishlist() {
    return tryRequestVariants(wishlistPaths.map((path) => () => apiClient.get(path)));
  },

  addToWishlist(productId) {
    const payloads = [{ product: productId }, { product_id: productId }, { id: productId }];

    return tryRequestVariants(
      wishlistPaths.flatMap((path) =>
        payloads.map((payload) => () => apiClient.post(path, payload))
      )
    );
  },

  removeFromWishlist({ wishlistItemId, productId }) {
    const variants = [];

    wishlistPaths.forEach((path) => {
      if (wishlistItemId) {
        variants.push(() => apiClient.delete(buildChildPath(path, wishlistItemId)));
      }

      if (productId) {
        variants.push(() =>
          apiClient.post(`${path}remove/`, {
            product: productId,
          })
        );
        variants.push(() =>
          apiClient.post(`${path}remove/`, {
            product_id: productId,
          })
        );
        variants.push(() => apiClient.delete(buildChildPath(path, productId)));
      }
    });

    return tryRequestVariants(variants);
  },

  listSellerReviews(page = 1) {
    return apiClient.get("/api/reviews/sellers/", {
      query: { page },
    });
  },

  listAllSellerReviews(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listSellerReviews(page), options);
  },

  updateSellerReview(id, payload) {
    return apiClient.patch(`/api/reviews/sellers/${id}/`, payload);
  },

  getCart() {
    return apiClient.get("/api/orders/cart/");
  },

  addToCart(payload) {
    return apiClient.post("/api/orders/cart/", payload);
  },

  updateCartItem(id, quantity) {
    return apiClient.put(`/api/orders/cart/item/${id}/`, { quantity });
  },

  removeCartItem(id) {
    return apiClient.delete(`/api/orders/cart/item/${id}/`);
  },

  listShippingMethods(page = 1) {
    return apiClient.get("/api/orders/shipping-methods/", {
      auth: false,
      query: { page },
    });
  },

  listAllShippingMethods(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listShippingMethods(page), options);
  },

  createOrder(payload) {
    return apiClient.post("/api/orders/create/", payload);
  },

  updateOrderShipping(orderNumber, shippingMethodId) {
    return apiClient.post(`/api/orders/shipping/${orderNumber}/`, {
      shipping_method_id: shippingMethodId,
    });
  },

  listOrders(page = 1) {
    return apiClient.get("/api/orders/my-orders/", { query: { page } });
  },

  listAllOrders(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listOrders(page), options);
  },

  getOrder(orderNumber) {
    return apiClient.get(`/api/orders/${orderNumber}/`);
  },

  listNotifications(page = 1) {
    return apiClient.get("/api/notifications/", { query: { page } });
  },

  listAllNotifications(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listNotifications(page), options);
  },

  getUnreadNotificationCount() {
    return apiClient.get("/api/notifications/unread-count/");
  },

  markNotificationRead(id) {
    return apiClient.post(`/api/notifications/${id}/mark-read/`);
  },

  markAllNotificationsRead() {
    return apiClient.post("/api/notifications/mark-all-read/");
  },

  listPayments(page = 1) {
    return apiClient.get("/api/payments/", { query: { page } });
  },

  listAllPayments(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listPayments(page), options);
  },

  listPayouts(page = 1) {
    return apiClient.get("/api/payments/payouts/", { query: { page } });
  },

  listAllPayouts(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listPayouts(page), options);
  },

  createPayout(payload) {
    return apiClient.post("/api/payments/payouts/", payload);
  },

  listRefunds(page = 1) {
    return apiClient.get("/api/payments/refunds/", { query: { page } });
  },

  listAllRefunds(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listRefunds(page), options);
  },

  createRefund(payload) {
    return apiClient.post("/api/payments/refunds/", payload);
  },

  listTransactions(page = 1) {
    return apiClient.get("/api/payments/transactions/", { query: { page } });
  },

  listAllTransactions(options = {}) {
    return collectPaginatedResults((page) => softbuyApi.listTransactions(page), options);
  },

  initializePaystack(orderId) {
    return apiClient.post("/api/payments/paystack/initialize/", {
      order_id: orderId,
    });
  },

  verifyPaystack(reference) {
    return apiClient.get("/api/payments/paystack/verify/", {
      auth: false,
      query: { reference },
    });
  },
};

export default softbuyApi;
