"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type User = { name: string } | null;

type SavedScore = {
  game: string;
  score: number;
  name: string;
  at: number;
};

type UserContextValue = {
  user: User;
  login: (name: string) => void;
  signOut: () => void;
  saveScore: (game: string, score: number, name: string) => void;
  scores: SavedScore[];
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [scores, setScores] = useState<SavedScore[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("av_user");
      if (raw) setUser(JSON.parse(raw));
      const rawScores = localStorage.getItem("av_scores");
      if (rawScores) setScores(JSON.parse(rawScores));
    } catch {
      // ignore malformed storage
    }
  }, []);

  const login = (name: string) => {
    const u: User = { name };
    setUser(u);
    localStorage.setItem("av_user", JSON.stringify(u));
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem("av_user");
  };

  const saveScore = (game: string, score: number, name: string) => {
    const entry: SavedScore = { game, score, name, at: Date.now() };
    const next = [...scores, entry];
    setScores(next);
    localStorage.setItem("av_scores", JSON.stringify(next));
  };

  return (
    <UserContext.Provider value={{ user, login, signOut, saveScore, scores }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
