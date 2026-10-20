import Feed from "@/components/Feed";

export default async function UserUploads({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <Feed user={decodeURIComponent(name)} />;
}
