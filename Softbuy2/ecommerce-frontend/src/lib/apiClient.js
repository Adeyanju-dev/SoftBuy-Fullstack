const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || "https://softbuy-fullstack.onrender.com").replace(/\/+$/, "");

const JSON_HEADERS = {
  Accept: "application/json",
};

let refreshPromise = null;

function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(url);
}

function buildUrl(path, query) {
  const normalizedPath = isAbsoluteUrl(path)
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  if (!query || Object.keys(query).length === 0) {
    return normalizedPath;
  }

  const url = new URL(normalizedPath);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function getStoredAccessToken() {
  return localStorage.getItem("access");
}

function getStoredRefreshToken() {
  return localStorage.getItem("refresh");
}

function storeAccessToken(access) {
  if (!access) {
    return;
  }
  localStorage.setItem("access", access);
  window.dispatchEvent(new Event("authChanged"));
}

function extractFirstFieldError(data) {
  if (!data || typeof data !== "object") {
    return "";
  }

  if (Array.isArray(data)) {
    const [first] = data;
    if (typeof first === "string") {
      return first;
    }

    if (first && typeof first === "object") {
      return extractFirstFieldError(first);
    }

    return "";
  }

  for (const [key, value] of Object.entries(data)) {
    if (["error", "detail", "message", "non_field_errors"].includes(key)) {
      continue;
    }

    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      const [first] = value;
      if (typeof first === "string") {
        return first;
      }

      if (first && typeof first === "object") {
        const nestedMessage = extractFirstFieldError(first);
        if (nestedMessage) {
          return nestedMessage;
        }
      }
    }

    if (value && typeof value === "object") {
      const nestedMessage = extractFirstFieldError(value);
      if (nestedMessage) {
        return nestedMessage;
      }
    }
  }

  return "";
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refresh = getStoredRefreshToken();

  if (!refresh) {
    throw new Error("No refresh token available");
  }

  refreshPromise = fetch(buildUrl("/api/auth/refresh/"), {
    method: "POST",
    headers: {
      ...JSON_HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  })
    .then(async (response) => {
      const data = await parseResponse(response);

      if (!response.ok || !data?.access) {
        const error = new Error(data?.detail || data?.error || "Session refresh failed");
        error.response = {
          status: response.status,
          data,
        };
        throw error;
      }

      storeAccessToken(data.access);
      return data.access;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function request(method, path, body, options = {}) {
  const {
    auth = true,
    retryOnAuthFailure = true,
    headers: customHeaders,
    query,
    signal,
  } = options;

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = {
    ...JSON_HEADERS,
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(customHeaders || {}),
  };

  if (auth) {
    const access = getStoredAccessToken();
    if (access) {
      headers.Authorization = `Bearer ${access}`;
    }
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : isFormData
        ? body
        : JSON.stringify(body),
    signal,
  });

  if (response.status === 401 && auth && retryOnAuthFailure && getStoredRefreshToken()) {
    try {
      await refreshAccessToken();
      return request(method, path, body, {
        ...options,
        retryOnAuthFailure: false,
      });
    } catch (refreshError) {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("authChanged"));
      throw refreshError;
    }
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    const error = new Error(
      data?.error ||
        data?.detail ||
        data?.message ||
        data?.non_field_errors?.[0] ||
        extractFirstFieldError(data) ||
        "Request failed"
    );
    error.response = {
      status: response.status,
      data,
    };
    throw error;
  }

  return {
    status: response.status,
    data,
  };
}

const apiClient = {
  baseUrl: API_BASE_URL,
  get(path, options) {
    return request("GET", path, undefined, options);
  },
  post(path, body, options) {
    return request("POST", path, body, options);
  },
  put(path, body, options) {
    return request("PUT", path, body, options);
  },
  patch(path, body, options) {
    return request("PATCH", path, body, options);
  },
  delete(path, options) {
    return request("DELETE", path, undefined, options);
  },
};

export default apiClient;
