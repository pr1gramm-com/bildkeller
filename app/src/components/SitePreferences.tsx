"use client";
import { useEffect } from "react";
import { usePreferences } from "@/lib/client/preferences";

export default function SitePreferences() {
  const settings = usePreferences();
  useEffect(() => {
    document.documentElement.dataset.theme = String(settings.themeId);
    const width = ["1100", "1400", "1800", "2200"].includes(settings.contentMaxWidth) ? `${settings.contentMaxWidth}px` : "none";
    document.documentElement.style.setProperty("--content-max-width", width);
  }, [settings.themeId, settings.contentMaxWidth]);
  return null;
}
