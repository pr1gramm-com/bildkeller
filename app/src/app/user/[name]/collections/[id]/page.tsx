import UserCollection from "@/components/UserCollection";

export default async function UserCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserCollection id={Number(id)} />;
}
