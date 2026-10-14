"use client";
import { useEffect, useState } from "react";

export const FLAGS = [
  { bit: 1, label: "SFW", color: "#5bb91c" },
  { bit: 2, label: "NSFW", color: "#ffc107" },
  { bit: 4, label: "NSFL", color: "#ff0082" },
  { bit: 8, label: "NSFP", color: "#7fc7ff" },
  { bit: 16, label: "POL", color: "#addc8d" },
] as const;

const KEY = "pr1.flags";
const EVENT = "pr1:flags";
const SFW = 1;

export function readFlags(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isInteger(v) && v >= 1 && v <= 31 ? v : SFW;
  } catch {
    return SFW;
  }
}

/** Persists the selection; an empty selection is ignored so the feed never goes blank. */
export function writeFlags(value: number): void {
  if (value < 1 || value > 31) return;
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    // storage blocked: the change only lives until reload
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Selected flag bitmask; `null` until the stored value is read, so callers never fetch with a wrong default. */
export function useFlags(): number | null {
  const [flags, setFlags] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => setFlags(readFlags());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return flags;
}
