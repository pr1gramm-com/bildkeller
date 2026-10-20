import { notFound } from "next/navigation";
import Feed from "@/components/Feed";
import { contextRoute } from "@/lib/feed-route";

export default async function Page({ params }: { params: Promise<{ segments?: string[] }> }) {
  const route = contextRoute("/chronicle", (await params).segments);
  if (!route) notFound();
  return <><h1 className="pane-head">Chronik</h1><Feed chronicle {...route} /></>;
}
