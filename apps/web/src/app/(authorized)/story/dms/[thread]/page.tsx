import { dmThreadIds } from "@/data/loadDay";
import { DmView } from "./DmView";

export function generateStaticParams() {
  return dmThreadIds().map((thread) => ({ thread }));
}

export default async function Page({ params }: { params: Promise<{ thread: string }> }) {
  const { thread } = await params;
  return <DmView thread={thread} />;
}
