import apiClient from "./apiClient";

export function resolveMediaUrl(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  if (/^(?:blob:|data:|https?:\/\/|\/\/)/i.test(value)) {
    return value;
  }

  const normalizedBaseUrl = apiClient.baseUrl.replace(/\/+$/, "");
  return value.startsWith("/") ? `${normalizedBaseUrl}${value}` : `${normalizedBaseUrl}/${value}`;
}
