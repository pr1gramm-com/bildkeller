import AdvancedSearch from "@/components/AdvancedSearch";
import Feed from "@/components/Feed";

export default async function Search({ searchParams }: { searchParams: Promise<{ tags?: string; promoted?: string; junk?: string }> }) {
  const { tags = "", promoted = "0", junk = "0" } = await searchParams;
  if (!tags.trim()) return <AdvancedSearch />;
  return <Feed promoted={promoted === "1" ? 1 : 0} junk={junk === "1"} tags={tags} />;
}
