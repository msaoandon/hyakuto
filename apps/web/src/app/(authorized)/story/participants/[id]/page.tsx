import { gameConfig } from "@hyakuto/game";
import { ParticipantProfile } from "./ParticipantProfile";

export function generateStaticParams() {
  return gameConfig.characters.map((c) => ({ id: c.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ParticipantProfile id={id} />;
}
