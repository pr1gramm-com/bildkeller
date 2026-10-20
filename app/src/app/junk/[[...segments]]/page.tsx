import FeedPage from "@/components/FeedPage";

export default function Junk(props: { params: Promise<{ segments?: string[] }> }) {
  return <FeedPage {...props} feed="junk" />;
}
