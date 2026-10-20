import { notFound } from "next/navigation";
import UserCollection from "@/components/UserCollection";
import { contextRoute } from "@/lib/feed-route";

export default async function CollectionPage({ params }: { params: Promise<{ name: string; id: string; segments?: string[] }> }) {
  const { name, id, segments } = await params;
  const route = contextRoute(`/user/${encodeURIComponent(name)}/collections/${id}`, segments);
  if (!route || !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) notFound();
  return <UserCollection id={Number(id)} {...route} />;
}
