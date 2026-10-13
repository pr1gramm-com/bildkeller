import ItemView from "@/components/ItemView";
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemView id={Number(id)} />;
}
