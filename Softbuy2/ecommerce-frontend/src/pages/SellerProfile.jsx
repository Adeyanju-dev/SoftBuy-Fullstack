import { useEffect, useState } from "react";
import { Mail, RefreshCw, Send, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import SellerWorkspaceNav from "../components/SellerWorkspaceNav";
import KeyValueEditor from "../components/KeyValueEditor";
import { useAuth } from "../context/AuthContext";
import { capitalizeWords, formatDateTime, formatObjectSummary } from "../lib/formatters";
import { cleanObject, entriesToObject, objectToEntries, readObject } from "../lib/objectFields";
import softbuyApi from "../lib/softbuyApi";

const kycKeys = [
  "document_type",
  "document_number",
  "cac_number",
  "document_url",
  "issuing_country",
];

const payoutKeys = [
  "bank_name",
  "account_name",
  "account_number",
  "wallet_provider",
  "wallet_number",
];

const initialForm = {
  business_name: "",
  business_description: "",
  business_address: "",
  business_phone: "",
  document_type: "",
  document_number: "",
  cac_number: "",
  document_url: "",
  issuing_country: "",
  kyc_extra: [],
  bank_name: "",
  account_name: "",
  account_number: "",
  wallet_provider: "",
  wallet_number: "",
  payout_extra: [],
};

function mapProfileToForm(profile) {
  const kycDocuments = readObject(profile?.kyc_documents);
  const payoutInfo = readObject(profile?.payout_info);

  return {
    business_name: profile?.business_name || "",
    business_description: profile?.business_description || "",
    business_address: profile?.business_address || "",
    business_phone: profile?.business_phone || "",
    document_type: kycDocuments.document_type || "",
    document_number: kycDocuments.document_number || "",
    cac_number: kycDocuments.cac_number || "",
    document_url: kycDocuments.document_url || "",
    issuing_country: kycDocuments.issuing_country || "",
    kyc_extra: objectToEntries(kycDocuments, kycKeys),
    bank_name: payoutInfo.bank_name || "",
    account_name: payoutInfo.account_name || "",
    account_number: payoutInfo.account_number || "",
    wallet_provider: payoutInfo.wallet_provider || "",
    wallet_number: payoutInfo.wallet_number || "",
    payout_extra: objectToEntries(payoutInfo, payoutKeys),
  };
}

export default function SellerProfile() {
  const { refreshProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await softbuyApi.getSellerProfile();

        if (active) {
          setProfile(response.data);
          setForm(mapProfileToForm(response.data));
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.response?.data?.error || "Could not load seller profile.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        business_name: form.business_name.trim(),
        business_description: form.business_description.trim(),
        business_address: form.business_address.trim(),
        business_phone: form.business_phone.trim(),
        kyc_documents: cleanObject({
          document_type: form.document_type.trim(),
          document_number: form.document_number.trim(),
          cac_number: form.cac_number.trim(),
          document_url: form.document_url.trim(),
          issuing_country: form.issuing_country.trim(),
          ...entriesToObject(form.kyc_extra),
        }),
        payout_info: cleanObject({
          bank_name: form.bank_name.trim(),
          account_name: form.account_name.trim(),
          account_number: form.account_number.trim(),
          wallet_provider: form.wallet_provider.trim(),
          wallet_number: form.wallet_number.trim(),
          ...entriesToObject(form.payout_extra),
        }),
      };

      const response = await softbuyApi.updateSellerProfile(payload);
      setProfile(response.data);
      setForm(mapProfileToForm(response.data));
      await refreshProfile();
      toast.success("Seller profile updated");
    } catch (saveError) {
      setError(saveError.response?.data?.error || saveError.message || "Could not save seller profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerification = async () => {
    setSendingVerification(true);
    setError("");

    try {
      const response = await softbuyApi.sendSellerVerificationEmail();
      toast.success(response.data?.message || "Seller verification email sent");
    } catch (sendError) {
      setError(sendError.response?.data?.error || "Could not send the seller verification email.");
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <SellerWorkspaceNav
          title="Seller profile"
          description="Keep your store identity, verification details, and payout preferences up to date."
          action={
            <button
              type="button"
              onClick={handleSendVerification}
              disabled={sendingVerification}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Send className="h-4 w-4" />
              {sendingVerification ? "Sending..." : "Send verification email"}
            </button>
          }
        />

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="h-96 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <form
              onSubmit={handleSubmit}
              className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Business details</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Update the information customers and the marketplace will rely on.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Save seller profile"}
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm text-slate-300">Business name</span>
                  <input
                    name="business_name"
                    value={form.business_name}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                    placeholder="SoftBuy Stores"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Business phone</span>
                  <input
                    name="business_phone"
                    value={form.business_phone}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                    placeholder="+234..."
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Business address</span>
                  <input
                    name="business_address"
                    value={form.business_address}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                    placeholder="Lagos, Nigeria"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm text-slate-300">Business description</span>
                  <textarea
                    name="business_description"
                    value={form.business_description}
                    onChange={handleChange}
                    rows={5}
                    className="w-full rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                    placeholder="Describe your store, product focus, and service promise."
                  />
                </label>
              </div>

              <div className="mt-8 space-y-5 rounded-[2rem] border border-white/10 bg-slate-900/40 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-white">KYC details</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Keep your verification details in a clear, editable format.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Document type</span>
                    <input
                      name="document_type"
                      value={form.document_type}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                      placeholder="National ID"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Document number</span>
                    <input
                      name="document_number"
                      value={form.document_number}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                      placeholder="Document number"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">CAC number</span>
                    <input
                      name="cac_number"
                      value={form.cac_number}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                      placeholder="RC1234567"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Issuing country</span>
                    <input
                      name="issuing_country"
                      value={form.issuing_country}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                      placeholder="Nigeria"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm text-slate-300">Document link</span>
                    <input
                      name="document_url"
                      value={form.document_url}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <KeyValueEditor
                  label="Additional KYC details"
                  helperText="Add any extra verification details you want to keep on file."
                  entries={form.kyc_extra}
                  onChange={(entries) => setForm((current) => ({ ...current, kyc_extra: entries }))}
                  keyPlaceholder="Field name"
                  valuePlaceholder="Field value"
                />
              </div>

              <div className="mt-8 space-y-5 rounded-[2rem] border border-white/10 bg-slate-900/40 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-white">Payout details</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Add the bank or wallet details you want used for payouts.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Bank name</span>
                    <input
                      name="bank_name"
                      value={form.bank_name}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                      placeholder="GTBank"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Account name</span>
                    <input
                      name="account_name"
                      value={form.account_name}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                      placeholder="SoftBuy Stores"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Account number</span>
                    <input
                      name="account_number"
                      value={form.account_number}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                      placeholder="0123456789"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Wallet provider</span>
                    <input
                      name="wallet_provider"
                      value={form.wallet_provider}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                      placeholder="Paystack"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm text-slate-300">Wallet number or handle</span>
                    <input
                      name="wallet_number"
                      value={form.wallet_number}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                      placeholder="Wallet number"
                    />
                  </label>
                </div>

                <KeyValueEditor
                  label="Additional payout details"
                  helperText="Add any other payout details you want saved for your store."
                  entries={form.payout_extra}
                  onChange={(entries) => setForm((current) => ({ ...current, payout_extra: entries }))}
                  keyPlaceholder="Field name"
                  valuePlaceholder="Field value"
                />
              </div>
            </form>

            <aside className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck className="h-4 w-4 text-cyan-200" />
                  Verification status
                </p>
                <p className="mt-4 text-sm text-slate-300">
                  Business verified: {profile?.verified ? "Yes" : "No"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  KYC review: {capitalizeWords(profile?.kyc_status || "pending")}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Updated {formatDateTime(profile?.updated_at)}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <Mail className="h-4 w-4 text-cyan-200" />
                  Seller identity
                </p>
                <p className="mt-4 text-sm text-slate-300">{profile?.user_email}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {[profile?.user_first_name, profile?.user_last_name].filter(Boolean).join(" ")}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Created {formatDateTime(profile?.created_at)}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                <p className="font-semibold text-white">Saved KYC summary</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {formatObjectSummary(readObject(profile?.kyc_documents), "No KYC details saved yet.")}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                <p className="font-semibold text-white">Saved payout summary</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {formatObjectSummary(readObject(profile?.payout_info), "No payout details saved yet.")}
                </p>
                <button
                  type="button"
                  onClick={() => refreshProfile()}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh account profile
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
