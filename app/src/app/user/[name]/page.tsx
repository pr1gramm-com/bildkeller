import Profile from "@/components/Profile";
export default async function UserPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <Profile name={decodeURIComponent(name)} />;
}
