import { notFound } from "next/navigation";
import { GAMES } from "../../../_lib/data";
import GamePlayerClient from "./GamePlayerClient";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <GamePlayerClient game={game} />;
}
