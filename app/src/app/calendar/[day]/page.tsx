import Feed from "@/components/Feed";

/** All uploads of one day. */
export default async function CalendarDay({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  return (
    <>
      <h1 className="pane-head">{day}</h1>
      <Feed tags={`d:${day}`} base={`/calendar/${day}`} />
    </>
  );
}
