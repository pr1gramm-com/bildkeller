import { notFound } from "next/navigation";
import Feed from "@/components/Feed";
import { contextRoute } from "@/lib/feed-route";

export default async function SeenPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const route = contextRoute("/seen", (await params).segments);
  if (!route) notFound();
  return <><h1 className="pane-head">Gesehene Hochlads</h1><Feed history chronicle {...route} /></>;
}
