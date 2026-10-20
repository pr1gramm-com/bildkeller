import Inbox from "@/components/Inbox";

export default async function InboxConversation({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <Inbox key={name} tab="messages" peer={decodeURIComponent(name)} />;
}
