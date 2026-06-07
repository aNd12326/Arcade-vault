import { getGames, getTopScores } from "../_lib/supabase/queries";
import HallOfFameClient from "./_components/HallOfFameClient";

export default async function HallOfFamePage() {
  const games = await getGames();
  const scoresPerGame = await Promise.all(
    games.map((g) => getTopScores(g.id, 10))
  );
  const data = games.map((game, i) => ({ game, scores: scoresPerGame[i] }));

  return <HallOfFameClient data={data} />;
}
