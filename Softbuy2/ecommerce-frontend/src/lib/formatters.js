export function formatCurrency(value, currency = "NGN") {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-NG")}`;
  }
}

export function formatDate(value, options = {}) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    ...options,
  }).format(date);
}

export function formatDateTime(value) {
  return formatDate(value, {
    timeStyle: "short",
  });
}

export function formatAddress(address) {
  if (!address) {
    return "";
  }

  return [
    address.street_address,
    address.city,
    address.state,
    address.country,
    address.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
}

export function capitalizeWords(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatObjectSummary(value, fallback = "Not provided") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const entries = Object.entries(value).filter(
    ([key, entryValue]) => key && entryValue !== undefined && entryValue !== null && entryValue !== ""
  );

  if (!entries.length) {
    return fallback;
  }

  return entries
    .map(([key, entryValue]) => `${capitalizeWords(key)}: ${entryValue}`)
    .join(" • ");
}
