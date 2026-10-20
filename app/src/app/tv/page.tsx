import Television from "@/components/Television";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ tags?: string | string[] }>;
}) {
  const { tags } = await searchParams;
  return <Television tags={typeof tags === "string" ? tags : ""} />;
}
