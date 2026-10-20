import { notFound } from "next/navigation";
import Feed from "./Feed";
import { feedRoute, type FeedName } from "@/lib/feed-route";

export default async function FeedPage({ feed, params }: {
  feed: FeedName;
  params: Promise<{ segments?: string[] }>;
}) {
  const route = feedRoute(feed, (await params).segments);
  if (!route) notFound();
  return <Feed {...route} promoted={feed === "top" ? 1 : 0} junk={feed === "junk"} />;
}
