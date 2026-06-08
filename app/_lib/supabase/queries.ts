import { createClient } from "./server";
import type { Game, Score, Profile } from "./types";

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function getTopScores(
  gameId: string,
  limit: number
): Promise<Score[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function insertScore(
  gameId: string,
  nickname: string,
  score: number
): Promise<void> {
  const supabase = await createClient();
  // Stamp the score with the logged-in user's id when there is a session;
  // guests insert with user_id = null. Source is the trusted server session,
  // never the request body, so it can't be spoofed.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, nickname, score, user_id: user?.id ?? null });
  if (error) throw new Error(error.message);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

export async function isNicknameTaken(nickname: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("nickname", nickname)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}
