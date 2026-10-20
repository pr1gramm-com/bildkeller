import Profile from "@/components/Profile";
export default async function Collections({ params }: { params: Promise<{ name: string }> }) {
  return <Profile name={decodeURIComponent((await params).name)} section="collections" />;
}
