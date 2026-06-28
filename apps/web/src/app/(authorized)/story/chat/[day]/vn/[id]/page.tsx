import { listDays, listThreads } from "@/data/loadDay";
import { VnView } from "./VnView";

export function generateStaticParams() {
  return listDays().flatMap((d) =>
    listThreads(d.day)
      .filter((th) => th.kind === "vn")
      .map((th) => ({ day: String(d.day), id: th.id })),
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ day: string; id: string }>;
}) {
  const { day, id } = await params;
  return <VnView day={day} id={id} />;
}
