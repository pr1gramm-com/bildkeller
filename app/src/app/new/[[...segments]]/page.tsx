import FeedPage from "@/components/FeedPage";

export default function New(props: { params: Promise<{ segments?: string[] }> }) {
  return <FeedPage {...props} feed="new" />;
}
