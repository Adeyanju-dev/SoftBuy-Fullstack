import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, CreditCard, Landmark, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import SellerWorkspaceNav from "../components/SellerWorkspaceNav";
import KeyValueEditor from "../components/KeyValueEditor";
import {
  capitalizeWords,
  formatCurrency,
  formatDateTime,
  formatObjectSummary,
} from "../lib/formatters";
import { cleanObject, entriesToObject, readObject } from "../lib/objectFields";
import softbuyApi from "../lib/softbuyApi";

const initialForm = {
  amount: "",
  currency: "NGN",
  payment_method: "bank_transfer",
  bank_name: "",
  account_name: "",
  account_number: "",
  wallet_provider: "",
  wallet_number: "",
  payment_extra: [],
};

function sumAmounts(items, transactionType) {
  return items.reduce((total, item) => {
    if (transactionType && item.transaction_type !== transactionType) {
      return total;
    }

    return total + Number(item.amount || 0);
  }, 0);
}

export default function SellerPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      softbuyApi.listAllPayouts(),
      softbuyApi.listAllTransactions(),
    ]);

    const nextWarnings = [];

    if (results[0].status === "rejected") {
      nextWarnings.push("Payout history could not be loaded.");
    }

    if (results[1].status === "rejected") {
      nextWarnings.push("Transaction history could not be loaded.");
    }

    setPayouts(
      results[0].status === "fulfilled" ? softbuyApi.extractResults(results[0].value.data) : []
    );
    setTransactions(
      results[1].status === "fulfilled" ? softbuyApi.extractResults(results[1].value.data) : []
    );
    setWarnings(nextWarnings);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const stats = useMemo(() => {
    const currency = payouts[0]?.currency || transactions[0]?.currency || "NGN";

    return [
      {
        label: "Pending payouts",
        value: formatCurrency(
          payouts
            .filter((item) => item.status === "pending" || item.status === "processing")
            .reduce((sum, item) => sum + Number(item.amount || 0), 0),
          currency
        ),
        icon: Landmark,
      },
      {
        label: "Completed payouts",
        value: formatCurrency(
          payouts
            .filter((item) => item.status === "completed" || item.status === "processed")
            .reduce((sum, item) => sum + Number(item.amount || 0), 0),
          currency
        ),
        icon: Wallet,
      },
      {
        label: "Recorded sales",
        value: formatCurrency(sumAmounts(transactions, "sale"), currency),
        icon: CreditCard,
      },
      {
        label: "Recorded fees",
        value: formatCurrency(sumAmounts(transactions, "fee"), currency),
        icon: ArrowRightLeft,
      },
    ];
  }, [payouts, transactions]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await softbuyApi.createPayout({
        amount: form.amount,
        currency: form.currency,
        payment_method: form.payment_method,
        payment_details: cleanObject({
          bank_name: form.bank_name.trim(),
          account_name: form.account_name.trim(),
          account_number: form.account_number.trim(),
          wallet_provider: form.wallet_provider.trim(),
          wallet_number: form.wallet_number.trim(),
          ...entriesToObject(form.payment_extra),
        }),
        status: "pending",
      });

      toast.success("Payout request submitted");
      setForm(initialForm);
      await loadPageData();
    } catch (saveError) {
      setError(
        saveError.response?.data?.error ||
          saveError.message ||
          "Could not submit payout request."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <SellerWorkspaceNav
          title="Payouts and transactions"
          description="Request payouts, review payment destinations, and keep an eye on store activity."
        />

        {warnings.length ? (
          <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="h-96 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <article
                    key={stat.label}
                    className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm text-slate-400">{stat.label}</p>
                    <p className="mt-2 text-3xl font-black text-white">{stat.value}</p>
                  </article>
                );
              })}
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <form
                onSubmit={handleSubmit}
                className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
              >
                <h2 className="text-2xl font-semibold text-white">Request a payout</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Choose how you want your store earnings sent.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Amount</span>
                    <input
                      name="amount"
                      value={form.amount}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      placeholder="100000.00"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Currency</span>
                    <select
                      name="currency"
                      value={form.currency}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                    >
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm text-slate-300">Payment method</span>
                    <select
                      name="payment_method"
                      value={form.payment_method}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                    >
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="digital_wallet">Digital wallet</option>
                      <option value="card">Card</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Bank name</span>
                    <input
                      name="bank_name"
                      value={form.bank_name}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      placeholder="GTBank"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Account name</span>
                    <input
                      name="account_name"
                      value={form.account_name}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      placeholder="SoftBuy Stores"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Account number</span>
                    <input
                      name="account_number"
                      value={form.account_number}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      placeholder="0123456789"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Wallet provider</span>
                    <input
                      name="wallet_provider"
                      value={form.wallet_provider}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      placeholder="Paystack"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm text-slate-300">Wallet number or handle</span>
                    <input
                      name="wallet_number"
                      value={form.wallet_number}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      placeholder="Wallet number"
                    />
                  </label>
                </div>

                <div className="mt-6">
                  <KeyValueEditor
                    label="Additional payout details"
                    helperText="Add any other payout details you want stored with this request."
                    entries={form.payment_extra}
                    onChange={(entries) => setForm((current) => ({ ...current, payment_extra: entries }))}
                    keyPlaceholder="Field name"
                    valuePlaceholder="Field value"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-6 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Submitting..." : "Submit payout request"}
                </button>
              </form>

              <div className="space-y-6">
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold text-white">Payout history</h2>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                      {payouts.length} records
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {payouts.map((payout) => (
                      <article
                        key={payout.id}
                        className="rounded-3xl border border-white/10 bg-slate-900/50 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-white">
                            {formatCurrency(payout.amount, payout.currency || "NGN")}
                          </p>
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                            {capitalizeWords(payout.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          {capitalizeWords(payout.payment_method)} •{" "}
                          {payout.seller_business_name || "Seller payout"}
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          {formatObjectSummary(readObject(payout.payment_details), "Payment details pending")}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {formatDateTime(payout.created_at)}
                        </p>
                      </article>
                    ))}
                    {!payouts.length ? (
                      <p className="text-sm text-slate-400">
                        No payouts yet. Create your first payout request from the form.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold text-white">Transactions</h2>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                      {transactions.length} records
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {transactions.map((transaction) => (
                      <article
                        key={transaction.id}
                        className="rounded-3xl border border-white/10 bg-slate-900/50 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-white">
                            {formatCurrency(transaction.amount, transaction.currency || "NGN")}
                          </p>
                          <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200">
                            {capitalizeWords(transaction.transaction_type)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          {transaction.description || "No transaction description provided."}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {capitalizeWords(transaction.payment_method)} •{" "}
                          {formatDateTime(transaction.created_at)}
                        </p>
                      </article>
                    ))}
                    {!transactions.length ? (
                      <p className="text-sm text-slate-400">
                        Transaction records will appear here as store activity grows.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
