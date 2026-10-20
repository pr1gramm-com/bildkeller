"use client";
import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/site-settings";
import { api, getMe, SESSION_EVENT } from "./api";

let settings: Settings = { ...DEFAULT_SETTINGS };
let owner = "";
let pending: Promise<void> | null = null;
let loaded = false;
let generation = 0;
const listeners = new Set<() => void>();

function publish(value: Settings): void {
  settings = { ...DEFAULT_SETTINGS, ...value };
  listeners.forEach((notify) => notify());
}

export function publishPreferences(value: Settings): void {
  owner = getMe()?.n ?? "";
  generation += 1;
  pending = null;
  loaded = true;
  publish(value);
}

async function loadPreferences() {
  const name = getMe()?.n ?? "";
  if (name !== owner) {
    owner = name;
    pending = null;
    loaded = false;
    generation += 1;
    publish({ ...DEFAULT_SETTINGS });
  }
  if (!name || loaded || pending) return pending;
  const version = generation;
  const request = api.get("user/settings").then((r: { settings: Settings }) => {
    if (owner === name && generation === version) { loaded = true; publish(r.settings); }
  }).catch(() => undefined).finally(() => { if (pending === request) pending = null; });
  pending = request;
  return request;
}

/** Shared account preferences; one read serves all consumers and login invalidates the cache. */
export function usePreferences(): Settings {
  const [value, setValue] = useState<Settings>({ ...DEFAULT_SETTINGS });
  useEffect(() => {
    const sync = () => setValue(settings);
    listeners.add(sync);
    sync();
    void loadPreferences();
    const session = () => { void loadPreferences(); };
    window.addEventListener(SESSION_EVENT, session);
    window.addEventListener("online", session);
    window.addEventListener("focus", session);
    return () => {
      listeners.delete(sync); window.removeEventListener(SESSION_EVENT, session);
      window.removeEventListener("online", session); window.removeEventListener("focus", session);
    };
  }, []);
  return value;
}
