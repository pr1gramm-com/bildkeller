import { notFound } from "next/navigation";
import Feed from "@/components/Feed";
import { contextRoute } from "@/lib/feed-route";

export default async function UserUploads({ params }: { params: Promise<{ name: string; segments?: string[] }> }) {
  const { name, segments } = await params;
  const route = contextRoute(`/user/${encodeURIComponent(name)}/uploads`, segments);
  if (!route) notFound();
  return <Feed user={name} {...route} />;
}
