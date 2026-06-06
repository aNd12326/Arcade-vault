import { notFound } from "next/navigation";
import { GAMES, seededScores } from "../../_lib/data";
import GameDetailClient from "./GameDetailClient";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  const scores = seededScores(game.id.length * 17 + 3, 10);

  return <GameDetailClient game={game} scores={scores} />;
}
