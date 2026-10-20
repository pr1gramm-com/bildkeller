import Feed from "@/components/Feed";
import { notFound } from "next/navigation";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = /^(\d+)(?::comment\d+)?$/.exec(id);
  if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) < 1) notFound();
  return <Feed startAt={Number(match[1])} />;
}
