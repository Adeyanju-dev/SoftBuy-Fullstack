import { Plus, Trash2 } from "lucide-react";

export default function KeyValueEditor({
  label,
  helperText,
  entries,
  onChange,
  keyPlaceholder = "Label",
  valuePlaceholder = "Value",
}) {
  const handleEntryChange = (index, field, value) => {
    onChange(
      entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      )
    );
  };

  const handleAdd = () => {
    onChange([...(entries || []), { key: "", value: "" }]);
  };

  const handleRemove = (index) => {
    onChange(entries.filter((_, entryIndex) => entryIndex !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-200">{label}</p>
          {helperText ? <p className="mt-1 text-xs text-slate-500">{helperText}</p> : null}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/5"
        >
          <Plus className="h-4 w-4" />
          Add field
        </button>
      </div>

      {entries?.length ? (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div key={`${label}-${index}`} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={entry.key}
                onChange={(event) => handleEntryChange(index, "key", event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                placeholder={keyPlaceholder}
              />
              <input
                value={entry.value}
                onChange={(event) => handleEntryChange(index, "value", event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                placeholder={valuePlaceholder}
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="inline-flex items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-200 transition hover:bg-rose-500/15"
                aria-label={`Remove ${label} field ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
          No extra details added yet.
        </div>
      )}
    </div>
  );
}
