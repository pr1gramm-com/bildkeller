import { notFound } from "next/navigation";
import Stalk from "@/components/Stalk";
import { contextRoute } from "@/lib/feed-route";

export default async function Page({ params }: { params: Promise<{ segments?: string[] }> }) {
  const route = contextRoute("/stalk", (await params).segments);
  if (!route) notFound();
  return <Stalk {...route} />;
}
