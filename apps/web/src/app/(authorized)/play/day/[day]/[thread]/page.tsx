import { listDays, listThreads } from "@/data/loadDay";
import { ChatView } from "./ChatView";

export function generateStaticParams() {
  return listDays().flatMap((d) =>
    listThreads(d.day).map((th) => ({ day: String(d.day), thread: th.id })),
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ day: string; thread: string }>;
}) {
  const { day, thread } = await params;
  return <ChatView day={day} thread={thread} />;
}
