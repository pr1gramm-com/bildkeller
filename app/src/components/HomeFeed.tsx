"use client";
import Feed from "./Feed";
import { usePreferences } from "@/lib/client/preferences";

export default function HomeFeed() {
  const preferences = usePreferences();
  return <Feed promoted={preferences.defaultToNew ? 0 : 1} base={preferences.defaultToNew ? "/new" : "/top"} />;
}
