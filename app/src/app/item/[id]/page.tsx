import Feed from "@/components/Feed";
import { notFound } from "next/navigation";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let decoded = "";
  try { decoded = decodeURIComponent(id); } catch { notFound(); } // the ":" of "123:comment45" arrives percent-encoded
  const match = /^(\d+)(?::comment\d+)?$/.exec(decoded);
  if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) < 1) notFound();
  return <Feed startAt={Number(match[1])} />;
}
