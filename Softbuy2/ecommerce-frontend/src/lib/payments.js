const PENDING_PAYMENT_STORAGE_KEY = "softbuy-pending-payment";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

export function extractPaystackUrl(payload) {
  return (
    payload?.authorization_url ||
    payload?.payment_url ||
    payload?.data?.authorization_url ||
    payload?.data?.authorizationUrl ||
    payload?.data?.payment_url ||
    payload?.data?.paymentUrl ||
    null
  );
}

export function getPaystackReferenceFromSearchParams(searchParams) {
  if (!searchParams) {
    return "";
  }

  return (
    normalizeText(searchParams.get("reference")) ||
    normalizeText(searchParams.get("trxref")) ||
    normalizeText(searchParams.get("trxRef")) ||
    normalizeText(searchParams.get("paystack_reference"))
  );
}

export function getPaymentReference(payload) {
  const candidates = [
    payload?.reference,
    payload?.trxref,
    payload?.paystack_reference,
    payload?.payment_reference,
    payload?.transaction_reference,
    payload?.data?.reference,
    payload?.data?.trxref,
    payload?.payment?.reference,
    payload?.payment?.trxref,
    payload?.payment_details?.reference,
    payload?.payment_details?.trxref,
    payload?.metadata?.reference,
  ];

  return candidates.map(normalizeText).find(Boolean) || "";
}

export function getVerificationOrder(payload) {
  return (
    payload?.order ||
    payload?.data?.order ||
    payload?.payment?.order ||
    payload?.data?.payment?.order ||
    null
  );
}

export function getVerificationStatus(payload) {
  return (
    payload?.payment_status ||
    payload?.payment?.status ||
    payload?.data?.payment?.status ||
    payload?.status ||
    payload?.data?.status ||
    ""
  );
}

export function getVerificationMessage(payload) {
  return (
    payload?.message ||
    payload?.detail ||
    payload?.data?.message ||
    payload?.data?.detail ||
    ""
  );
}

export function isSuccessfulPaymentStatus(payload) {
  const status = normalizeStatus(
    typeof payload === "string" ? payload : getVerificationStatus(payload)
  );

  return ["success", "successful", "completed", "paid", "verified"].includes(status);
}

export function isPendingPaymentStatus(payload) {
  const status = normalizeStatus(
    typeof payload === "string" ? payload : getVerificationStatus(payload)
  );

  return ["pending", "pending_payment", "awaiting_payment", "unpaid", "initialized"].includes(
    status
  );
}

export function readPendingPayment() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(PENDING_PAYMENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Failed to read pending payment cache:", error);
    return null;
  }
}

export function writePendingPayment(payload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist pending payment cache:", error);
  }
}

export function clearPendingPayment() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
}
