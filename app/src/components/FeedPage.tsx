import { notFound } from "next/navigation";
import Feed from "./Feed";
import { feedRoute, type FeedName } from "@/lib/feed-route";

export default async function FeedPage({ feed, params }: {
  feed: FeedName;
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments } = await params;
  let decoded: string[] | undefined;
  try { decoded = segments?.map(decodeURIComponent); }
  catch { notFound(); }
  const route = feedRoute(feed, decoded);
  if (!route) notFound();
  return <Feed {...route} promoted={feed === "top" ? 1 : 0} junk={feed === "junk"} />;
}
