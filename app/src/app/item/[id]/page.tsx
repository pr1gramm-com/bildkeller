import Feed from "@/components/Feed";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Feed startAt={Number(id)} />;
}
