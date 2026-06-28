import { listDays } from "@/data/loadDay";
import { ChatDayView } from "./ChatDayView";

export function generateStaticParams() {
  return listDays().map((d) => ({ day: String(d.day) }));
}

export default async function Page({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params; // Next 15: params is a Promise
  return <ChatDayView day={day} />;
}
