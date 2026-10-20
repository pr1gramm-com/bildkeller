"use client";
import { useEffect } from "react";
import { usePreferences } from "@/lib/client/preferences";

export default function SitePreferences() {
  const settings = usePreferences();
  useEffect(() => {
    document.documentElement.dataset.theme = String(settings.themeId);
  }, [settings.themeId]);
  return null;
}
