export function readObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

export function objectToEntries(value, omitKeys = []) {
  const omitSet = new Set(omitKeys);

  return Object.entries(readObject(value))
    .filter(([key, entryValue]) => {
      return !omitSet.has(key) && entryValue !== undefined && entryValue !== null && entryValue !== "";
    })
    .map(([key, entryValue]) => ({
      key,
      value: String(entryValue),
    }));
}

export function entriesToObject(entries) {
  return (entries || []).reduce((result, entry) => {
    const key = entry?.key?.trim();
    const value = entry?.value?.trim();

    if (!key || !value) {
      return result;
    }

    result[key] = value;
    return result;
  }, {});
}

export function cleanObject(value) {
  return Object.entries(readObject(value)).reduce((result, [key, entryValue]) => {
    if (entryValue === undefined || entryValue === null || entryValue === "") {
      return result;
    }

    result[key] = entryValue;
    return result;
  }, {});
}
