export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
  created_at: string;
};

export type Score = {
  id: string;
  game_id: string;
  nickname: string;
  score: number;
  created_at: string;
};

export type Profile = {
  id: string;
  nickname: string;
  created_at: string;
};
