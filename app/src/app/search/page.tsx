import Feed from "@/components/Feed";
export default async function Search({ searchParams }: { searchParams: Promise<{ tags?: string }> }) {
  const { tags = "" } = await searchParams;
  return (
    <>
      <p className="dim">Suche: <code>{tags}</code> — Syntax: <code>! tag -tag -"video" s:100</code></p>
      <Feed promoted={0} tags={tags} />
    </>
  );
}
