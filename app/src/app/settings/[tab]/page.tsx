import Settings from "@/components/Settings";

const TABS = ["site", "account", "invites", "collections", "notifications", "apps", "appearance", "behavior", "comments", "privacy", "filters"];

export default async function SettingsTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return <Settings tab={TABS.includes(tab) ? tab : "site"} />;
}
