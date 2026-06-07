import { getGames } from "../_lib/supabase/queries";
import LibraryClient from "./_components/LibraryClient";

export default async function LibraryPage() {
  const games = await getGames();
  return <LibraryClient games={games} />;
}
