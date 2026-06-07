import { notFound } from "next/navigation";
import { getGame, getTopScores } from "../../_lib/supabase/queries";
import GameDetailClient from "./GameDetailClient";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, scores] = await Promise.all([getGame(id), getTopScores(id, 5)]);
  if (!game) notFound();

  return <GameDetailClient game={game} scores={scores} />;
}
