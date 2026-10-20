import UserComments from "@/components/UserComments";

export default async function UserLikesPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <UserComments name={decodeURIComponent(name)} likes />;
}
