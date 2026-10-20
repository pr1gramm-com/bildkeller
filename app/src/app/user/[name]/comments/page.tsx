import Profile from "@/components/Profile";
export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  return <Profile name={decodeURIComponent((await params).name)} section="comments" />;
}
