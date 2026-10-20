export function itemHistory(raw: string): number[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0))].slice(0, 1000) : [];
  } catch { return []; }
}
