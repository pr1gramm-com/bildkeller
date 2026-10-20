import FeedPage from "@/components/FeedPage";

export default function Top(props: { params: Promise<{ segments?: string[] }> }) {
  return <FeedPage {...props} feed="top" />;
}
