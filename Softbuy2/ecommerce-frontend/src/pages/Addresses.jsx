import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatAddress, formatDateTime } from "../lib/formatters";
import softbuyApi from "../lib/softbuyApi";

const emptyForm = {
  address_type: "shipping",
  street_address: "",
  city: "",
  state: "",
  country: "Nigeria",
  postal_code: "",
  is_default: false,
};

export default function Addresses() {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadAddresses = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await softbuyApi.listAllAddresses();
      setAddresses(softbuyApi.extractResults(response.data));
    } catch (loadError) {
      setError(loadError.response?.data?.error || "Could not load addresses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (editingId) {
        await softbuyApi.updateAddress(editingId, form);
      } else {
        await softbuyApi.createAddress(form);
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadAddresses();
    } catch (saveError) {
      setError(saveError.response?.data?.error || "Could not save address.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (address) => {
    setEditingId(address.id);
    setForm({
      address_type: address.address_type,
      street_address: address.street_address,
      city: address.city,
      state: address.state,
      country: address.country,
      postal_code: address.postal_code,
      is_default: Boolean(address.is_default),
    });
  };

  const handleDelete = async (id) => {
    setError("");

    try {
      await softbuyApi.deleteAddress(id);
      await loadAddresses();
    } catch (deleteError) {
      setError(deleteError.response?.data?.error || "Could not delete address.");
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Addresses</p>
          <h1 className="text-4xl font-black text-white">Manage saved addresses</h1>
          <p className="mt-2 text-sm text-slate-400">
            Connected to `/api/auth/addresses/`.
          </p>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-4">
            {loading ? (
              <div className="h-80 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
            ) : addresses.length > 0 ? (
              addresses.map((address) => (
                <article
                  key={address.id}
                  className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{address.address_type}</p>
                        {address.is_default ? (
                          <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs text-cyan-200">
                            Default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        {formatAddress(address)}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Updated {formatDateTime(address.updated_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(address)}
                        className="rounded-full border border-white/10 p-3 text-slate-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(address.id)}
                        className="rounded-full border border-rose-500/20 bg-rose-500/10 p-3 text-rose-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center text-slate-400">
                No addresses saved yet.
              </div>
            )}
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h2 className="text-xl font-semibold text-white">
              {editingId ? "Update address" : "Add address"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <select
                value={form.address_type}
                onChange={(event) => setForm((current) => ({ ...current, address_type: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
              >
                <option value="shipping">Shipping</option>
                <option value="billing">Billing</option>
                <option value="both">Both</option>
              </select>

              {["street_address", "city", "state", "country", "postal_code"].map((field) => (
                <input
                  key={field}
                  value={form[field]}
                  onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                  placeholder={field.replace(/_/g, " ")}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                  required
                />
              ))}

              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))}
                  className="accent-cyan-400"
                />
                Set as default address
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 font-semibold text-slate-950"
              >
                {saving ? "Saving..." : editingId ? "Update address" : "Add address"}
              </button>

              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                  className="w-full rounded-full border border-white/10 px-5 py-3 text-sm text-slate-200"
                >
                  Cancel editing
                </button>
              ) : null}
            </form>
          </aside>
        </div>
      </div>
    </section>
  );
}
