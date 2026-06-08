"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { createClient } from "./supabase/client";

type User = { name: string; isGuest: boolean } | null;

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

function readScores(): SavedScore[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("av_scores");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  // Lazy init from localStorage (guarded for SSR) so we never setState
  // synchronously inside an effect just to hydrate persisted scores.
  const [scores, setScores] = useState<SavedScore[]>(readScores);
  const [supabase] = useState(createClient);

  useEffect(() => {
    let active = true;

    const readGuest = (): User => {
      try {
        const raw = localStorage.getItem("av_user");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };

    // Resolve a real Supabase session into a profile nickname; fall back to the
    // localStorage guest if there is no session.
    const resolve = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", authUser.id)
          .single();
        if (!active) return;
        setUser({
          name: profile?.nickname ?? authUser.email ?? "PLAYER",
          isGuest: false,
        });
      } else {
        setUser(readGuest());
      }
    };

    resolve();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        resolve();
      } else {
        setUser(readGuest());
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Guest-only login: persists a local nickname with no Supabase session.
  const login = (name: string) => {
    const u: User = { name, isGuest: true };
    setUser(u);
    localStorage.setItem("av_user", JSON.stringify(u));
  };

  const signOut = () => {
    if (user && !user.isGuest) {
      supabase.auth.signOut();
    } else {
      localStorage.removeItem("av_user");
    }
    setUser(null);
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
