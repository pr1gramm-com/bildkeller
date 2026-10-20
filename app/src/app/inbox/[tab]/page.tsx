import Inbox from "@/components/Inbox";

const TABS = ["all", "comments", "notifications", "digests", "follows", "messages", "blocklist"];

export default async function InboxTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return <Inbox tab={TABS.includes(tab) ? tab : "messages"} />;
}
