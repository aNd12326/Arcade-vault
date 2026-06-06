"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "../../../_lib/data";
import { useUser } from "../../../_lib/user-context";

const TICK_MS = 220;

const COLOR_MAP: Record<string, string> = {
  cyan: "var(--cyan)",
  magenta: "var(--magenta)",
  yellow: "var(--yellow)",
  green: "var(--green)",
};

export default function GamePlayerClient({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useUser();

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [saved, setSaved] = useState(false);
  const [playerName, setPlayerName] = useState(user?.name ?? "");

  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const levelRef = useRef(1);

  const accent = COLOR_MAP[game.color] ?? "var(--cyan)";

  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) return;
      const inc = Math.floor(Math.random() * 80 + 20) * levelRef.current;
      scoreRef.current += inc;
      setScore(scoreRef.current);

      if (scoreRef.current > 0 && scoreRef.current % 5000 < 200) {
        levelRef.current = Math.min(levelRef.current + 1, 9);
        setLevel(levelRef.current);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const handleEnd = () => {
    pausedRef.current = true;
    setPaused(true);
    setGameOver(true);
  };

  const handleSave = () => {
    if (!playerName.trim()) return;
    saveScore(game.id, scoreRef.current, playerName.trim());
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      {/* HUD */}
      <div className="player-hud">
        <div className="hud-stat">
          <span className="l">SCORE</span>
          <span className="v">{score.toLocaleString()}</span>
        </div>
        <div className="hud-stat lives">
          <span className="l">VIDAS</span>
          <span className="v">{"♥".repeat(lives)}</span>
        </div>
        <div className="hud-stat level">
          <span className="l">NIVEL</span>
          <span className="v">{String(level).padStart(2, "0")}</span>
        </div>
        <div className="hud-actions">
          <button className="btn ghost" onClick={togglePause}>
            {paused ? "▶ REANUDAR" : "⏸ PAUSA"}
          </button>
          <button className="btn magenta" onClick={handleEnd}>
            ■ FIN
          </button>
        </div>
      </div>

      {/* CRT */}
      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena">
            <div className="grid-floor" />
            <div className="player-ship" style={{ borderBottomColor: accent }} />
            <div className="enemy e1" />
            <div className="enemy e2" />
            <div className="enemy e3" />
            {paused && !gameOver && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.55)",
                  fontFamily: "var(--pixel)",
                  fontSize: 18,
                  color: "var(--yellow)",
                  letterSpacing: "0.2em",
                  textShadow: "0 0 12px var(--yellow)",
                }}
              >
                PAUSA
              </div>
            )}
          </div>
        </div>
        <div className="crt-bottom">
          <span className="led">{game.title}</span>
          <span>LVL {String(level).padStart(2, "0")}</span>
          <span style={{ color: accent }}>{score.toLocaleString()} PTS</span>
        </div>
      </div>

      {/* Game Over modal */}
      {gameOver && (
        <div className="modal-bd">
          <div className="modal">
            <h2>GAME OVER</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{scoreRef.current.toLocaleString()}</div>

            {!saved ? (
              <>
                <div className="input-row">
                  <input
                    type="text"
                    placeholder="TU NOMBRE"
                    value={playerName}
                    maxLength={12}
                    onChange={(e) =>
                      setPlayerName(e.target.value.toUpperCase())
                    }
                  />
                </div>
                <div className="actions">
                  <button
                    className="btn yellow"
                    onClick={handleSave}
                    disabled={!playerName.trim()}
                  >
                    GUARDAR PUNTUACIÓN
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => router.push(`/games/${game.id}`)}
                  >
                    SALIR
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
                <div className="actions" style={{ marginTop: 24 }}>
                  <button
                    className="btn"
                    onClick={() => {
                      setScore(0);
                      setLevel(1);
                      setLives(3);
                      setSaved(false);
                      setGameOver(false);
                      scoreRef.current = 0;
                      levelRef.current = 1;
                      pausedRef.current = false;
                      setPaused(false);
                    }}
                  >
                    ▶ OTRA PARTIDA
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => router.push(`/games/${game.id}`)}
                  >
                    VOLVER
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
