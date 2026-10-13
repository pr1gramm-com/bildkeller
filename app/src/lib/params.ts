/** Strict integer parameter: plain digits only (no 1e30, 1.5, Infinity, NaN), else the default. */
export function int(value: string | null | undefined, def = 0): number {
  return typeof value === "string" && /^-?\d{1,15}$/.test(value.trim()) ? Number(value) : def;
}
