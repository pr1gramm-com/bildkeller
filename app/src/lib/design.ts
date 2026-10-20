"use client";
import { useEffect, useLayoutEffect } from "react";

export type Design = "classic" | "app";

export const DESIGN_KEY = "pr1.design";

/** The design is a pure CSS theme on <html data-design>; no server state involved. */
export function readDesign(): Design {
  try {
    return localStorage.getItem(DESIGN_KEY) === "app" ? "app" : "classic";
  } catch {
    return "classic";
  }
}

export function writeDesign(value: Design): void {
  try {
    localStorage.setItem(DESIGN_KEY, value);
  } catch {
    // storage blocked: the choice only lives until reload
  }
  applyDesign(value);
}

/** Writes the theme onto <html>; React re-applies its own value on re-render, so this gets called again. */
export function applyDesign(value: Design = readDesign()): void {
  if (document.documentElement.dataset.design !== value) {
    document.documentElement.dataset.design = value;
  }
}

/**
 * React re-applies the server-rendered `data-design` while it hydrates, so the
 * stored choice has to be put back before the browser paints again.
 */
export const useDesignLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
